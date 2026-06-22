from flask import Flask, jsonify, request
from flask_cors import CORS
from extensions import db
from dotenv import load_dotenv
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import os
import secrets

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# Local SQLite for development before we move to AWS RDS PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///local_db.sqlite')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Import models after db is configured
from models import User, Product, Order, OrderItem, ShipmentDetail

# ─── Auth Helpers ─────────────────────────────────────────────────────────────

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        if not token:
            return jsonify({'error': 'Authentication token required. Please log in.'}), 401
        user = User.query.filter_by(auth_token=token).first()
        if not user:
            return jsonify({'error': 'Invalid or expired token. Please log in again.'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required.'}), 400
    user = User.query.filter_by(username=data['username']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid username or password.'}), 401
    # Generate a new session token
    token = secrets.token_hex(32)
    user.auth_token = token
    db.session.commit()
    return jsonify({'token': token, 'username': user.username, 'role': user.role})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        user = User.query.filter_by(auth_token=token).first()
        if user:
            user.auth_token = None
            db.session.commit()
    return jsonify({'message': 'Logged out successfully.'})

# ─── Health ───────────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "agriculture-b2b-api"})

# ─── Products (login required) ────────────────────────────────────────────────

@app.route('/api/products', methods=['GET'])
@token_required
def get_products():
    category = request.args.get('category')
    query = Product.query
    if category:
        query = query.filter_by(category=category)
    products = query.all()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "unit": p.unit,
        "description": p.description,
        "image_url": p.image_url,
        "in_stock": p.in_stock,
        # price is intentionally excluded from customer-facing response
    } for p in products])

@app.route('/api/products/<int:product_id>', methods=['GET'])
@token_required
def get_product(product_id):
    p = Product.query.get_or_404(product_id)
    return jsonify({
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "unit": p.unit,
        "description": p.description,
        "image_url": p.image_url,
        "in_stock": p.in_stock,
    })

@app.route('/api/products', methods=['POST'])
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
    return jsonify({"id": product.id, "message": "Product created"}), 201

# ─── Orders ───────────────────────────────────────────────────────────────────

@app.route('/api/orders', methods=['GET'])
def get_orders():
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
            "awb_number": shipment.awb_number if shipment else None,
            "items": [{"product_id": i.product_id, "quantity": i.quantity} for i in items],
        })
    return jsonify(result)

@app.route('/api/orders/<int:order_id>/status', methods=['PATCH'])
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()
    order.status = data['status']
    db.session.commit()
    return jsonify({"id": order.id, "status": order.status})

# ─── Stats ────────────────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_orders = Order.query.count()
    pending = Order.query.filter_by(status='pending').count()
    packing = Order.query.filter_by(status='packing').count()
    dispatched = Order.query.filter_by(status='shipped').count()
    qc_ready = Order.query.filter_by(status='qc').count()
    return jsonify({
        "total_orders": total_orders,
        "to_pack": pending,
        "packing_now": packing,
        "ready_for_qc": qc_ready,
        "dispatched_today": dispatched,
    })

# ─── Seed data (dev only) ─────────────────────────────────────────────────────

def seed_data():
    # Seed default users
    if User.query.count() == 0:
        users = [
            User(username='customer', email='customer@agrib2b.com',
                 password_hash=generate_password_hash('demo123'), role='customer'),
            User(username='admin', email='admin@agrib2b.com',
                 password_hash=generate_password_hash('admin123'), role='admin'),
        ]
        db.session.bulk_save_objects(users)
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
