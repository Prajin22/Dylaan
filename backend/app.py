from flask import Flask, jsonify, request
from flask_cors import CORS
from extensions import db
from dotenv import load_dotenv
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import jwt
import json

load_dotenv()

from flask import Flask, jsonify, request, make_response
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

# Local SQLite for development before we move to AWS RDS PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///local_db.sqlite')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# JWT configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'agrib2b-dev-secret-change-in-production')
JWT_ALGORITHM = 'HS256'

# Role-specific token expiry
TOKEN_EXPIRY = {
    'customer': timedelta(hours=24),
    'admin':    timedelta(hours=4),
    'packhouse': timedelta(hours=12),  # ~shift length
}

db.init_app(app)

# Import models after db is configured
from models import (
    User, BuyerProfile, Product, Order, OrderItem,
    ShipmentDetail, Inquiry, InquiryItem, AuditLog,
)

# ─── Rate Limiting (in-memory for dev, use Redis in prod) ─────────────────────

_rate_limit_store = {}  # { ip_or_user: { count: int, window_start: datetime } }

def check_rate_limit(key, max_requests=10, window_seconds=60):
    """Simple in-memory rate limiter. Returns True if within limits."""
    now = datetime.utcnow()
    entry = _rate_limit_store.get(key)
    if not entry or (now - entry['window_start']).total_seconds() > window_seconds:
        _rate_limit_store[key] = {'count': 1, 'window_start': now}
        return True
    if entry['count'] >= max_requests:
        return False
    entry['count'] += 1
    return True


# ─── Audit Log Helper ─────────────────────────────────────────────────────────

def log_action(user_id, username, role, action, resource_type, resource_id=None,
               old_values=None, new_values=None):
    """Write an immutable audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        username=username,
        role=role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)
    db.session.commit()


# ─── JWT Auth Helpers ─────────────────────────────────────────────────────────

def create_jwt(user):
    """Generate a JWT with role claim and role-specific expiry."""
    expiry = TOKEN_EXPIRY.get(user.role, timedelta(hours=24))
    payload = {
        'sub': user.id,
        'username': user.username,
        'role': user.role,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + expiry,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token):
    """Decode and validate a JWT. Returns the payload dict or None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def get_current_user():
    """Extract user from the Authorization header or cookie. Returns (payload, user) or (None, None)."""
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    elif 'auth_token' in request.cookies:
        token = request.cookies.get('auth_token')
        
    if not token:
        return None, None
        
    payload = decode_jwt(token)
    if not payload:
        return None, None
    user = User.query.get(payload['sub'])
    if not user:
        return None, None
    return payload, user


def token_required(f):
    """Require a valid JWT — any role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload, user = get_current_user()
        if not payload:
            return jsonify({'error': 'Authentication required. Please log in.'}), 401
        request._user_payload = payload
        request._user = user
        return f(*args, **kwargs)
    return decorated


def role_required(allowed_roles):
    """
    Require a valid JWT with a specific role.
    Usage: @role_required(['admin'])
    Returns 403 if role doesn't match — handler never executes.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            payload, user = get_current_user()
            if not payload:
                return jsonify({'error': 'Authentication required. Please log in.'}), 401
            if payload['role'] not in allowed_roles:
                return jsonify({'error': 'Access denied. Insufficient permissions.'}), 403
            request._user_payload = payload
            request._user = user
            return f(*args, **kwargs)
        return decorated
    return decorator


def verified_buyer_required(f):
    """Require token + verified buyer profile."""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload, user = get_current_user()
        if not payload:
            return jsonify({'error': 'Authentication required.'}), 401
        # Admins and production users bypass verification
        if payload['role'] in ('admin', 'production'):
            request._user_payload = payload
            request._user = user
            return f(*args, **kwargs)
        # Buyers must be verified
        profile = BuyerProfile.query.filter_by(user_id=user.id).first()
        if not profile or not profile.is_verified:
            return jsonify({'error': 'Your account is pending verification. Please wait for admin approval.'}), 403
        request._user_payload = payload
        request._user = user
        return f(*args, **kwargs)
    return decorated


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Buyer self-registration with company documents."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required.'}), 400

    required = ['username', 'email', 'password', 'company_name']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required.'}), 400

    # Rate limit registration by IP
    if not check_rate_limit(f'register:{request.remote_addr}', max_requests=5, window_seconds=3600):
        return jsonify({'error': 'Too many registration attempts. Try again later.'}), 429

    # Check for existing user
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken.'}), 409
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered.'}), 409

    # Create user + buyer profile
    user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        role='customer',
    )
    db.session.add(user)
    db.session.flush()  # Get user.id

    profile = BuyerProfile(
        user_id=user.id,
        company_name=data['company_name'],
        business_registration_number=data.get('business_registration_number'),
        gstin_vat_number=data.get('gstin_vat_number'),
        importer_license_url=data.get('importer_license_url'),
        verification_status='pending',
    )
    db.session.add(profile)
    db.session.commit()

    return jsonify({
        'message': 'Registration submitted. Your account is pending admin verification.',
        'user_id': user.id,
    }), 201

@app.route('/api/admin/staff', methods=['POST'])
@role_required(['admin'])
def create_staff():
    """Admin creates a new staff account (admin or packhouse)."""
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password') or not data.get('role'):
        return jsonify({'error': 'Username, password, and role are required.'}), 400

    if data['role'] not in ['admin', 'packhouse']:
        return jsonify({'error': 'Role must be admin or packhouse.'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken.'}), 409
        
    email = data.get('email', f"{data['username']}@dylaan.internal")

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered.'}), 409

    user = User(
        username=data['username'],
        email=email,
        password_hash=generate_password_hash(data['password']),
        role=data['role'],
    )
    db.session.add(user)
    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role='admin',
        action='staff.create',
        resource_type='user',
        resource_id=user.id,
        old_values=None,
        new_values={'username': user.username, 'role': user.role},
    )

    return jsonify({'message': f"{data['role'].capitalize()} account created successfully."}), 201



@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required.'}), 400

    # Rate limit login attempts by IP
    if not check_rate_limit(f'login:{request.remote_addr}', max_requests=20, window_seconds=60):
        return jsonify({'error': 'Too many login attempts. Please wait and try again.'}), 429

    user = User.query.filter_by(username=data['username']).first()
    if not user:
        return jsonify({'error': 'Invalid username or password.'}), 401

    # Check account lockout
    if user.is_locked:
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds())
        return jsonify({
            'error': f'Account locked due to too many failed attempts. Try again in {remaining // 60 + 1} minute(s).'
        }), 423

    if not check_password_hash(user.password_hash, data['password']):
        user.record_failed_login()
        db.session.commit()
        attempts_left = max(0, 5 - (user.failed_login_count or 0))
        if attempts_left == 0:
            return jsonify({'error': 'Account locked due to too many failed attempts. Try again in 15 minutes.'}), 423
        return jsonify({'error': f'Invalid username or password. {attempts_left} attempt(s) remaining.'}), 401

    # Success — reset lockout and generate JWT
    user.reset_login_attempts()
    db.session.commit()

    token = create_jwt(user)

    # Check verification status for buyers
    verification_status = None
    if user.role == 'customer':
        profile = BuyerProfile.query.filter_by(user_id=user.id).first()
        verification_status = profile.verification_status if profile else 'no_profile'

    response = jsonify({
        'username': user.username,
        'role': user.role,
        'verification_status': verification_status,
        'message': 'Logged in securely.'
    })
    
    # Set HttpOnly cookie
    response.set_cookie(
        'auth_token',
        token,
        httponly=True,
        secure=False, # Set to True in production with HTTPS
        samesite='Strict',
        max_age=int(TOKEN_EXPIRY[user.role].total_seconds())
    )
    return response


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    # With stateless JWTs via cookies, logout means deleting the cookie
    response = jsonify({'message': 'Logged out successfully.'})
    response.set_cookie('auth_token', '', expires=0, httponly=True, samesite='Strict')
    return response


@app.route('/api/auth/me', methods=['GET'])
@token_required
def auth_me():
    """Return current user info from JWT."""
    user = request._user
    result = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role,
    }
    if user.role == 'customer':
        profile = BuyerProfile.query.filter_by(user_id=user.id).first()
        result['verification_status'] = profile.verification_status if profile else 'no_profile'
        result['company_name'] = profile.company_name if profile else None
    return jsonify(result)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "agriculture-b2b-api"})


# ─── Products (verified buyers + admin) ───────────────────────────────────────

@app.route('/api/products', methods=['GET'])
@verified_buyer_required
def get_products():
    category = request.args.get('category')
    query = Product.query
    if category:
        query = query.filter_by(category=category)
    products = query.all()

    # Admin sees prices; buyers don't
    include_price = request._user_payload['role'] == 'admin'

    result = []
    for p in products:
        item = {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "unit": p.unit,
            "description": p.description,
            "image_url": p.image_url,
            "in_stock": p.in_stock,
        }
        if include_price:
            item["price"] = p.price
        result.append(item)

    return jsonify(result)


@app.route('/api/products/<int:product_id>', methods=['GET'])
@verified_buyer_required
def get_product(product_id):
    p = Product.query.get_or_404(product_id)
    result = {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "unit": p.unit,
        "description": p.description,
        "image_url": p.image_url,
        "in_stock": p.in_stock,
    }
    if request._user_payload['role'] == 'admin':
        result["price"] = p.price
    return jsonify(result)


@app.route('/api/products', methods=['POST'])
@role_required(['admin'])
def create_product():
    data = request.get_json()
    product = Product(
        name=data['name'],
        category=data['category'],
        price=data.get('price', 0.0),
        image_url=data.get('image_url'),
        description=data.get('description', ''),
        unit=data.get('unit', 'kg'),
        in_stock=data.get('in_stock', True),
    )
    db.session.add(product)
    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role='admin',
        action='product.create',
        resource_type='product',
        resource_id=product.id,
        new_values={'name': product.name, 'category': product.category, 'price': product.price},
    )

    return jsonify({"id": product.id, "message": "Product created"}), 201


@app.route('/api/products/<int:product_id>', methods=['PUT'])
@role_required(['admin'])
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json()

    old_values = {'name': product.name, 'price': product.price, 'in_stock': product.in_stock}

    product.name = data.get('name', product.name)
    product.category = data.get('category', product.category)
    product.price = data.get('price', product.price)
    product.unit = data.get('unit', product.unit)
    product.description = data.get('description', product.description)
    product.image_url = data.get('image_url', product.image_url)
    product.in_stock = data.get('in_stock', product.in_stock)
    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role='admin',
        action='product.update',
        resource_type='product',
        resource_id=product.id,
        old_values=old_values,
        new_values={'name': product.name, 'price': product.price, 'in_stock': product.in_stock},
    )

    return jsonify({"id": product.id, "message": "Product updated"})


# ─── Inquiry Flow (Buyer → Admin → Deposit → Order) ──────────────────────────

@app.route('/api/inquiries', methods=['POST'])
@role_required(['customer'])
def create_inquiry():
    """Buyer submits a new inquiry. Max 3 active (open/quoted/deposit_pending) at a time."""
    user = request._user

    # Check verification
    profile = BuyerProfile.query.filter_by(user_id=user.id).first()
    if not profile or not profile.is_verified:
        return jsonify({'error': 'Account must be verified before submitting inquiries.'}), 403

    # Rate limit: max 3 active inquiries per buyer
    active_count = Inquiry.query.filter(
        Inquiry.buyer_id == user.id,
        Inquiry.status.in_(['open', 'quoted', 'deposit_pending'])
    ).count()
    if active_count >= 3:
        return jsonify({
            'error': 'You already have 3 active inquiries. Please wait for existing ones to be processed or cancel them.'
        }), 429

    data = request.get_json()
    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'At least one product item is required.'}), 400

    inquiry = Inquiry(
        buyer_id=user.id,
        status='open',
        expires_at=datetime.utcnow() + timedelta(hours=48),  # Auto-expire if no admin action
    )
    db.session.add(inquiry)
    db.session.flush()

    for item in items:
        product = Product.query.get(item.get('product_id'))
        if not product:
            db.session.rollback()
            return jsonify({'error': f'Product ID {item.get("product_id")} not found.'}), 404
        inquiry_item = InquiryItem(
            inquiry_id=inquiry.id,
            product_id=product.id,
            quantity=item.get('quantity', 1),
            unit=item.get('unit', product.unit),
        )
        db.session.add(inquiry_item)

    db.session.commit()

    return jsonify({
        'id': inquiry.id,
        'status': 'open',
        'message': 'Inquiry submitted. Our team will review and provide a quote within 48 hours.',
        'expires_at': inquiry.expires_at.isoformat(),
    }), 201


@app.route('/api/inquiries', methods=['GET'])
@token_required
def get_inquiries():
    """Buyers see their own inquiries. Admins see all."""
    payload = request._user_payload

    if payload['role'] == 'admin':
        inquiries = Inquiry.query.order_by(Inquiry.created_at.desc()).all()
    else:
        inquiries = Inquiry.query.filter_by(buyer_id=payload['sub']).order_by(Inquiry.created_at.desc()).all()

    result = []
    for inq in inquiries:
        result.append({
            'id': inq.id,
            'buyer_id': inq.buyer_id,
            'buyer_name': inq.buyer.username if inq.buyer else 'Unknown',
            'company_name': inq.buyer.buyer_profile.company_name if inq.buyer and inq.buyer.buyer_profile else None,
            'status': inq.status,
            'quoted_total': inq.quoted_total,
            'deposit_amount': inq.deposit_amount,
            'deposit_paid': inq.deposit_paid,
            'admin_notes': inq.admin_notes,
            'created_at': inq.created_at.isoformat(),
            'quoted_at': inq.quoted_at.isoformat() if inq.quoted_at else None,
            'expires_at': inq.expires_at.isoformat() if inq.expires_at else None,
            'items': [{
                'product_id': item.product_id,
                'product_name': item.product.name if item.product else 'Unknown',
                'quantity': item.quantity,
                'unit': item.unit,
            } for item in inq.items],
        })

    return jsonify(result)


@app.route('/api/admin/inquiries/<int:inquiry_id>/quote', methods=['PATCH'])
@role_required(['admin'])
def quote_inquiry(inquiry_id):
    """Admin sets the quote price and deposit amount."""
    inquiry = Inquiry.query.get_or_404(inquiry_id)
    if inquiry.status != 'open':
        return jsonify({'error': f'Cannot quote an inquiry with status "{inquiry.status}".'}), 400

    data = request.get_json()
    if not data.get('quoted_total') or data['quoted_total'] <= 0:
        return jsonify({'error': 'quoted_total must be a positive number.'}), 400

    old_values = {'status': inquiry.status}

    inquiry.quoted_total = data['quoted_total']
    inquiry.deposit_percentage = data.get('deposit_percentage', 20.0)
    inquiry.deposit_amount = inquiry.quoted_total * (inquiry.deposit_percentage / 100)
    inquiry.admin_notes = data.get('admin_notes', inquiry.admin_notes)
    inquiry.status = 'quoted'
    inquiry.quoted_at = datetime.utcnow()
    # Reset expiry — buyer has 72 hours to pay deposit
    inquiry.expires_at = datetime.utcnow() + timedelta(hours=72)
    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role='admin',
        action='inquiry.quote',
        resource_type='inquiry',
        resource_id=inquiry.id,
        old_values=old_values,
        new_values={'status': 'quoted', 'quoted_total': inquiry.quoted_total, 'deposit_amount': inquiry.deposit_amount},
    )

    return jsonify({
        'id': inquiry.id,
        'status': 'quoted',
        'quoted_total': inquiry.quoted_total,
        'deposit_amount': inquiry.deposit_amount,
        'expires_at': inquiry.expires_at.isoformat(),
        'message': 'Quote sent. Buyer has 72 hours to pay the deposit.',
    })


@app.route('/api/admin/inquiries/<int:inquiry_id>/confirm-deposit', methods=['POST'])
@role_required(['admin'])
def confirm_deposit(inquiry_id):
    """Admin confirms deposit received and converts inquiry to a confirmed order."""
    inquiry = Inquiry.query.get_or_404(inquiry_id)
    if inquiry.status not in ('quoted', 'deposit_pending'):
        return jsonify({'error': f'Cannot confirm deposit for inquiry with status "{inquiry.status}".'}), 400

    data = request.get_json() or {}

    # Mark deposit as paid
    inquiry.deposit_paid = True
    inquiry.deposit_transaction_id = data.get('transaction_id', 'manual-confirmation')
    inquiry.deposit_paid_at = datetime.utcnow()
    inquiry.status = 'confirmed'
    inquiry.confirmed_at = datetime.utcnow()

    # Create a confirmed Order from this inquiry
    buyer = User.query.get(inquiry.buyer_id)
    profile = BuyerProfile.query.filter_by(user_id=inquiry.buyer_id).first()
    client_name = profile.company_name if profile else (buyer.username if buyer else 'Unknown')

    order = Order(
        client_name=client_name,
        status='pending',
        priority=data.get('priority', 'medium'),
        total_boxes=data.get('total_boxes', 0),
        destination_airport=data.get('destination_airport'),
        flight_time=data.get('flight_time'),
        user_id=inquiry.buyer_id,
        source_inquiry_id=inquiry.id,
        deposit_paid=True,
        deposit_transaction_id=inquiry.deposit_transaction_id,
    )
    db.session.add(order)
    db.session.flush()

    # Copy inquiry items to order items
    for item in inquiry.items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            quantity=item.quantity,
        )
        db.session.add(order_item)

    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role='admin',
        action='inquiry.confirm_deposit',
        resource_type='inquiry',
        resource_id=inquiry.id,
        new_values={'order_id': order.id, 'transaction_id': inquiry.deposit_transaction_id},
    )

    return jsonify({
        'inquiry_id': inquiry.id,
        'order_id': order.id,
        'status': 'confirmed',
        'message': f'Deposit confirmed. Order #{order.id} created and ready for production.',
    })


@app.route('/api/admin/inquiries/<int:inquiry_id>/cancel', methods=['POST'])
@role_required(['admin'])
def cancel_inquiry(inquiry_id):
    """Admin cancels an inquiry."""
    inquiry = Inquiry.query.get_or_404(inquiry_id)
    if inquiry.status in ('confirmed', 'cancelled', 'expired'):
        return jsonify({'error': f'Cannot cancel inquiry with status "{inquiry.status}".'}), 400

    old_status = inquiry.status
    inquiry.status = 'cancelled'
    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role='admin',
        action='inquiry.cancel',
        resource_type='inquiry',
        resource_id=inquiry.id,
        old_values={'status': old_status},
        new_values={'status': 'cancelled'},
    )

    return jsonify({'id': inquiry.id, 'status': 'cancelled', 'message': 'Inquiry cancelled.'})


# ─── Auto-Expiry (called on each request or by a background job) ─────────────

def expire_stale_inquiries():
    """Auto-expire inquiries past their deadline."""
    now = datetime.utcnow()
    stale = Inquiry.query.filter(
        Inquiry.status.in_(['open', 'quoted', 'deposit_pending']),
        Inquiry.expires_at <= now,
    ).all()

    count = 0
    for inq in stale:
        inq.status = 'expired'
        count += 1

    if count > 0:
        db.session.commit()
    return count


@app.before_request
def before_request_hook():
    """Run auto-expiry check periodically (every request in dev; use cron in prod)."""
    # Only run every ~60 seconds to avoid overhead
    if not hasattr(app, '_last_expiry_check'):
        app._last_expiry_check = datetime.min
    if (datetime.utcnow() - app._last_expiry_check).total_seconds() > 60:
        with app.app_context():
            expire_stale_inquiries()
        app._last_expiry_check = datetime.utcnow()


# ─── Orders (admin + production only for management) ─────────────────────────

@app.route('/api/orders', methods=['GET'])
@role_required(['admin', 'packhouse'])
def get_orders():
    """Only show confirmed orders to admin/production."""
    orders = Order.query.order_by(Order.created_at.desc()).all()
    result = []
    for o in orders:
        items = OrderItem.query.filter_by(order_id=o.id).all()
        shipment = ShipmentDetail.query.filter_by(order_id=o.id).first()
        result.append({
            "id": o.id,
            "client_name": o.client_name,
            "status": o.status,
            "created_at": o.created_at.isoformat(),
            "total_boxes": o.total_boxes,
            "destination_airport": o.destination_airport,
            "flight_time": o.flight_time,
            "priority": o.priority,
            "deposit_paid": o.deposit_paid,
            "source_inquiry_id": o.source_inquiry_id,
            "awb_number": shipment.awb_number if shipment else None,
            "items": [{"product_id": i.product_id, "quantity": i.quantity} for i in items],
        })
    return jsonify(result)


@app.route('/api/orders/<int:order_id>/status', methods=['PATCH'])
@role_required(['admin', 'packhouse'])
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()

    old_status = order.status
    order.status = data['status']
    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role=request._user_payload['role'],
        action='order.status_change',
        resource_type='order',
        resource_id=order.id,
        old_values={'status': old_status},
        new_values={'status': order.status},
    )

    return jsonify({"id": order.id, "status": order.status})


# ─── Buyer Verification (admin only) ─────────────────────────────────────────

@app.route('/api/admin/buyers', methods=['GET'])
@role_required(['admin'])
def list_buyers():
    """List all buyer profiles with verification status."""
    status_filter = request.args.get('status')  # pending, approved, rejected
    query = BuyerProfile.query
    if status_filter:
        query = query.filter_by(verification_status=status_filter)
    profiles = query.order_by(BuyerProfile.submitted_at.desc()).all()

    return jsonify([{
        'id': p.id,
        'user_id': p.user_id,
        'username': p.user.username,
        'email': p.user.email,
        'company_name': p.company_name,
        'business_registration_number': p.business_registration_number,
        'gstin_vat_number': p.gstin_vat_number,
        'importer_license_url': p.importer_license_url,
        'verification_status': p.verification_status,
        'rejection_reason': p.rejection_reason,
        'submitted_at': p.submitted_at.isoformat(),
        'verified_at': p.verified_at.isoformat() if p.verified_at else None,
    } for p in profiles])


@app.route('/api/admin/buyers/<int:profile_id>/verify', methods=['PATCH'])
@role_required(['admin'])
def verify_buyer(profile_id):
    """Admin approves or rejects a buyer profile."""
    profile = BuyerProfile.query.get_or_404(profile_id)
    data = request.get_json()
    action = data.get('action')  # 'approve' or 'reject'

    if action not in ('approve', 'reject'):
        return jsonify({'error': 'Action must be "approve" or "reject".'}), 400

    old_status = profile.verification_status

    if action == 'approve':
        profile.verification_status = 'approved'
        profile.verified_at = datetime.utcnow()
        profile.verified_by = request._user_payload['sub']
    else:
        profile.verification_status = 'rejected'
        profile.rejection_reason = data.get('reason', 'Documents insufficient.')

    db.session.commit()

    log_action(
        user_id=request._user_payload['sub'],
        username=request._user_payload['username'],
        role='admin',
        action=f'buyer.{action}',
        resource_type='buyer_profile',
        resource_id=profile.id,
        old_values={'status': old_status},
        new_values={'status': profile.verification_status},
    )

    return jsonify({
        'id': profile.id,
        'verification_status': profile.verification_status,
        'message': f'Buyer {"approved" if action == "approve" else "rejected"} successfully.',
    })


# ─── Stats ────────────────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
@role_required(['admin', 'packhouse'])
def get_stats():
    total_orders = Order.query.count()
    pending = Order.query.filter_by(status='pending').count()
    packing = Order.query.filter_by(status='packing').count()
    dispatched = Order.query.filter_by(status='shipped').count()
    qc_ready = Order.query.filter_by(status='qc').count()

    # Inquiry stats
    open_inquiries = Inquiry.query.filter_by(status='open').count()
    quoted_inquiries = Inquiry.query.filter_by(status='quoted').count()
    pending_buyers = BuyerProfile.query.filter_by(verification_status='pending').count()

    return jsonify({
        "total_orders": total_orders,
        "to_pack": pending,
        "packing_now": packing,
        "ready_for_qc": qc_ready,
        "dispatched_today": dispatched,
        "open_inquiries": open_inquiries,
        "quoted_inquiries": quoted_inquiries,
        "pending_buyers": pending_buyers,
    })


# ─── Audit Log (admin only) ──────────────────────────────────────────────────

@app.route('/api/admin/audit-log', methods=['GET'])
@role_required(['admin'])
def get_audit_log():
    """Paginated, filterable audit log."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    action_filter = request.args.get('action')
    resource_filter = request.args.get('resource_type')
    user_filter = request.args.get('username')

    query = AuditLog.query.order_by(AuditLog.timestamp.desc())

    if action_filter:
        query = query.filter(AuditLog.action.contains(action_filter))
    if resource_filter:
        query = query.filter_by(resource_type=resource_filter)
    if user_filter:
        query = query.filter(AuditLog.username.contains(user_filter))

    total = query.count()
    logs = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'total': total,
        'page': page,
        'per_page': per_page,
        'entries': [{
            'id': log.id,
            'timestamp': log.timestamp.isoformat(),
            'user_id': log.user_id,
            'username': log.username,
            'role': log.role,
            'action': log.action,
            'resource_type': log.resource_type,
            'resource_id': log.resource_id,
            'old_values': json.loads(log.old_values) if log.old_values else None,
            'new_values': json.loads(log.new_values) if log.new_values else None,
            'ip_address': log.ip_address,
        } for log in logs],
    })


# ─── Seed data (dev only) ─────────────────────────────────────────────────────

def seed_data():
    # Seed default users with proper roles
    if User.query.count() == 0:
        users = [
            User(username='customer', email='customer@agrib2b.com',
                 password_hash=generate_password_hash('demo123'), role='customer'),
            User(username='admin', email='admin@agrib2b.com',
                 password_hash=generate_password_hash('admin123'), role='admin'),
            User(username='packhouse', email='packhouse@agrib2b.com',
                 password_hash=generate_password_hash('pack123'), role='production'),
        ]
        db.session.bulk_save_objects(users)
        db.session.commit()

    # Auto-verify the demo customer account
    demo_user = User.query.filter_by(username='customer').first()
    if demo_user and not BuyerProfile.query.filter_by(user_id=demo_user.id).first():
        profile = BuyerProfile(
            user_id=demo_user.id,
            company_name='Demo Trading Co.',
            business_registration_number='DEMO-REG-001',
            gstin_vat_number='DEMO-GST-001',
            verification_status='approved',
            verified_at=datetime.utcnow(),
        )
        db.session.add(profile)
        db.session.commit()

    # Seed 50 Flowers & Leaves products
    if Product.query.count() == 0:
        products = [
            # ── Flowers ──────────────────────────────────────────────────────
            Product(name="Arali Red", category="flower", price=0.0, unit="bundle",
                    description="Vibrant red Arali (Nerium oleander) flowers for export.", in_stock=True),
            Product(name="Arali Pink", category="flower", price=0.0, unit="bundle",
                    description="Beautiful pink Arali (Nerium oleander) flowers.", in_stock=True),
            Product(name="Arali White", category="flower", price=0.0, unit="bundle",
                    description="Pure white Arali (Nerium oleander) flowers.", in_stock=True),
            Product(name="Button Rose - Red", category="flower", price=0.0, unit="bundle",
                    description="Premium red miniature roses, ideal for events and export.", in_stock=True),
            Product(name="Button Rose - Yellow", category="flower", price=0.0, unit="bundle",
                    description="Premium yellow miniature roses for ceremonies.", in_stock=True),
            Product(name="Button Rose - Orange", category="flower", price=0.0, unit="bundle",
                    description="Premium orange miniature roses, Grade-A export quality.", in_stock=True),
            Product(name="Carnation", category="flower", price=0.0, unit="bundle",
                    description="Classic carnations in mixed colours, Grade-A export quality.", in_stock=True),
            Product(name="Datura", category="flower", price=0.0, unit="bundle",
                    description="Datura flowers, traditionally used in sacred rituals.", in_stock=True),
            Product(name="Erukkam Poo", category="flower", price=0.0, unit="bundle",
                    description="Traditional Erukkam (Calotropis gigantea) flowers.", in_stock=True),
            Product(name="Erukkam Poo - White", category="flower", price=0.0, unit="bundle",
                    description="White variety of Erukkam (Calotropis procera) flowers.", in_stock=True),
            Product(name="Kozhikondai", category="flower", price=0.0, unit="bundle",
                    description="Kozhikondai flowers, ideal for temple ceremonies.", in_stock=True),
            Product(name="Lotus - Pink", category="flower", price=0.0, unit="bundle",
                    description="Sacred pink lotus flowers, freshly harvested.", in_stock=True),
            Product(name="Lotus - White", category="flower", price=0.0, unit="bundle",
                    description="Sacred white lotus flowers for worship and export.", in_stock=True),
            Product(name="Malli - Loose", category="flower", price=0.0, unit="kg",
                    description="Freshly harvested loose jasmine (Malli) flowers, highly fragrant.", in_stock=True),
            Product(name="Mullai - Loose", category="flower", price=0.0, unit="kg",
                    description="Fragrant loose Mullai (Arabian jasmine) flowers.", in_stock=True),
            Product(name="Marugu", category="flower", price=0.0, unit="bundle",
                    description="Marugu (Tanner's cassia) flowers for floral arrangements.", in_stock=True),
            Product(name="Marikolundhu", category="flower", price=0.0, unit="bundle",
                    description="Fresh Marikolundhu aromatic flowers.", in_stock=True),
            Product(name="Marigold - Yellow", category="flower", price=0.0, unit="kg",
                    description="Bright yellow marigold flowers, export-ready.", in_stock=True),
            Product(name="Marigold - Orange", category="flower", price=0.0, unit="kg",
                    description="Vibrant orange marigold flowers, Grade-A quality.", in_stock=True),
            Product(name="Nanthiyavattai", category="flower", price=0.0, unit="bundle",
                    description="Fragrant Nanthiyavattai (Crape Jasmine) flowers.", in_stock=True),
            Product(name="Petals - Red Rose", category="flower", price=0.0, unit="kg",
                    description="Fresh red rose petals, ideal for distillation and export.", in_stock=True),
            Product(name="Petals - Yellow Rose", category="flower", price=0.0, unit="kg",
                    description="Fresh yellow rose petals, premium grade.", in_stock=True),
            Product(name="Petals - Panneer Rose", category="flower", price=0.0, unit="kg",
                    description="Premium Panneer (Damascus) rose petals.", in_stock=True),
            Product(name="Panneer Rose", category="flower", price=0.0, unit="bundle",
                    description="Full bloom Panneer roses, highly aromatic.", in_stock=True),
            Product(name="Pavazha Malli", category="flower", price=0.0, unit="bundle",
                    description="Pavazha Malli (Coral Jasmine) flowers for ceremonies.", in_stock=True),
            Product(name="Samanthi", category="flower", price=0.0, unit="kg",
                    description="Samanthi (Chrysanthemum) flowers, freshly packed.", in_stock=True),
            Product(name="Sangupoo", category="flower", price=0.0, unit="bundle",
                    description="Sangupoo (Conch flower) for ritual use.", in_stock=True),
            Product(name="Sampanki", category="flower", price=0.0, unit="bundle",
                    description="Fragrant Sampanki (Champak) flowers.", in_stock=True),
            Product(name="Thumbai Poo", category="flower", price=0.0, unit="bundle",
                    description="Thumbai (Leucas aspera) flowers used in worship.", in_stock=True),
            Product(name="Vadamalli", category="flower", price=0.0, unit="kg",
                    description="Fragrant Vadamalli flowers for garlands.", in_stock=True),
            Product(name="Viritchi Poo", category="flower", price=0.0, unit="bundle",
                    description="Viritchi Poo flowers for traditional use.", in_stock=True),
            # ── Leaves ───────────────────────────────────────────────────────
            Product(name="Arugampul", category="leaf", price=0.0, unit="kg",
                    description="Fresh Arugampul (Bermuda grass), used in Hindu rituals.", in_stock=True),
            Product(name="Akasha Garuda Kizhangu", category="leaf", price=0.0, unit="kg",
                    description="Akasha Garuda Kizhangu leaves, traditionally sourced.", in_stock=True),
            Product(name="Arasan Leaves", category="leaf", price=0.0, unit="kg",
                    description="Sacred Arasan (Peepal) leaves for worship.", in_stock=True),
            Product(name="Banana Leaves", category="leaf", price=0.0, unit="kg",
                    description="Fresh large banana leaves, ideal for ceremonies and export.", in_stock=True),
            Product(name="Banana Leaves - Round", category="leaf", price=0.0, unit="kg",
                    description="Round variety banana leaves, perfect for serving.", in_stock=True),
            Product(name="Curry Leaves", category="leaf", price=0.0, unit="kg",
                    description="Fresh curry leaves, organically farmed.", in_stock=True),
            Product(name="Erukkam Leaves", category="leaf", price=0.0, unit="kg",
                    description="Erukkam (Calotropis) leaves for traditional use.", in_stock=True),
            Product(name="Gauva Leaves", category="leaf", price=0.0, unit="kg",
                    description="Fresh guava leaves, known for medicinal properties.", in_stock=True),
            Product(name="Jackfruit Leaves", category="leaf", price=0.0, unit="kg",
                    description="Fresh jackfruit leaves for ritual and culinary use.", in_stock=True),
            Product(name="Mango Leaves", category="leaf", price=0.0, unit="kg",
                    description="Tender mango leaves, freshly harvested and packed.", in_stock=True),
            Product(name="Neem Leaves", category="leaf", price=0.0, unit="kg",
                    description="Fresh neem leaves from certified organic farms.", in_stock=True),
            Product(name="Pan Leaves", category="leaf", price=0.0, unit="kg",
                    description="Fresh Pan (Betel) leaves, export-grade quality.", in_stock=True),
            Product(name="Thennam Thoranam", category="leaf", price=0.0, unit="kg",
                    description="Coconut palm torana leaves for decorations and ceremonies.", in_stock=True),
            Product(name="Thennam Palai", category="leaf", price=0.0, unit="kg",
                    description="Tender coconut palm leaves for weaving and décor.", in_stock=True),
            Product(name="Tharppai Pul", category="leaf", price=0.0, unit="kg",
                    description="Sacred Darbha (Tharppai) grass for Vedic rituals.", in_stock=True),
            Product(name="Thuthuvalai", category="leaf", price=0.0, unit="kg",
                    description="Thuthuvalai (Turkey berry) leaves with medicinal value.", in_stock=True),
            Product(name="Thulashi", category="leaf", price=0.0, unit="kg",
                    description="Sacred Tulsi (Holy Basil) leaves, freshly harvested.", in_stock=True),
            Product(name="Vilvam", category="leaf", price=0.0, unit="kg",
                    description="Sacred Bael (Vilvam) leaves from certified organic farms.", in_stock=True),
            Product(name="Vanni Leaves", category="leaf", price=0.0, unit="kg",
                    description="Sacred Vanni (Prosopis) leaves for ceremonial use.", in_stock=True),
        ]
        db.session.bulk_save_objects(products)

    if Order.query.count() == 0:
        orders = [
            Order(client_name="London Florist Ltd", status="pending", total_boxes=14,
                  destination_airport="LHR", flight_time="18:45", priority="high"),
            Order(client_name="Dubai Fresh LLC", status="packing", total_boxes=32,
                  destination_airport="DXB", flight_time="21:00", priority="medium"),
            Order(client_name="Paris Bloom SA", status="qc", total_boxes=10,
                  destination_airport="CDG", flight_time="07:00", priority="medium"),
            Order(client_name="Toronto Greens Inc", status="shipped", total_boxes=20,
                  destination_airport="YYZ", flight_time="08:00", priority="low"),
            Order(client_name="Singapore Imports", status="shipped", total_boxes=8,
                  destination_airport="SIN", flight_time="09:00", priority="low"),
        ]
        db.session.bulk_save_objects(orders)

    db.session.commit()


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_data()
    app.run(debug=True, port=5000)
