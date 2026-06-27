from extensions import db
from datetime import datetime, timedelta


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='customer')  # customer, admin, production

    # JWT auth — no stored token; we use stateless JWTs now
    # Legacy field kept for backward-compat during migration
    auth_token = db.Column(db.String(256), nullable=True)

    # Brute-force protection
    failed_login_count = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    
    # Multi-Factor Authentication (MFA)
    mfa_enabled = db.Column(db.Boolean, default=False, nullable=False)
    mfa_secret = db.Column(db.String(32), nullable=True) # For TOTP logic

    @property
    def is_locked(self):
        if self.locked_until and datetime.utcnow() < self.locked_until:
            return True
        return False

    def record_failed_login(self):
        self.failed_login_count = (self.failed_login_count or 0) + 1
        if self.failed_login_count >= 5:
            self.locked_until = datetime.utcnow() + timedelta(minutes=15)

    def reset_login_attempts(self):
        self.failed_login_count = 0
        self.locked_until = None


class BuyerProfile(db.Model):
    """Buyer verification documents — admin must approve before catalog access."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    company_name = db.Column(db.String(200), nullable=False)
    business_registration_number = db.Column(db.String(100), nullable=True)
    gstin_vat_number = db.Column(db.String(50), nullable=True)
    importer_license_url = db.Column(db.String(500), nullable=True)  # S3 document URL
    verification_status = db.Column(db.String(20), nullable=False, default='pending')  # pending, approved, rejected
    rejection_reason = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    verified_at = db.Column(db.DateTime, nullable=True)
    verified_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Admin who approved

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('buyer_profile', uselist=False))

    @property
    def is_verified(self):
        return self.verification_status == 'approved'


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # flower, leaf, vegetable
    price = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(30), nullable=False, default='kg')
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)  # S3 URL
    in_stock = db.Column(db.Boolean, default=True)


# ─── Inquiry → Quote → Deposit → Confirmed Order Flow ─────────────────────────

class Inquiry(db.Model):
    """
    A buyer submits an inquiry (quote_request). Admin reviews and quotes.
    After deposit payment, inquiry converts to a confirmed Order.
    
    Status flow: open → quoted → deposit_pending → confirmed → expired/cancelled
    """
    id = db.Column(db.Integer, primary_key=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='open')
    # open, quoted, deposit_pending, confirmed, expired, cancelled

    # Admin sets these during quoting
    admin_notes = db.Column(db.Text, nullable=True)
    quoted_total = db.Column(db.Float, nullable=True)
    deposit_percentage = db.Column(db.Float, nullable=True, default=20.0)  # 10-30%
    deposit_amount = db.Column(db.Float, nullable=True)

    # Payment tracking
    deposit_paid = db.Column(db.Boolean, default=False)
    deposit_transaction_id = db.Column(db.String(200), nullable=True)
    deposit_paid_at = db.Column(db.DateTime, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    quoted_at = db.Column(db.DateTime, nullable=True)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    buyer = db.relationship('User', backref='inquiries')
    items = db.relationship('InquiryItem', backref='inquiry', cascade='all, delete-orphan')

    @property
    def is_expired(self):
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return True
        return False


class InquiryItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    inquiry_id = db.Column(db.Integer, db.ForeignKey('inquiry.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit = db.Column(db.String(30), nullable=True)

    product = db.relationship('Product')


# ─── Confirmed Orders (production pipeline) ───────────────────────────────────

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_name = db.Column(db.String(150), nullable=False, default='Unknown Client')
    status = db.Column(db.String(50), nullable=False, default='pending')
    # pending, packing, qc, shipped, delivered
    priority = db.Column(db.String(20), nullable=False, default='medium')  # high, medium, low
    total_boxes = db.Column(db.Integer, nullable=False, default=0)
    destination_airport = db.Column(db.String(10), nullable=True)
    flight_time = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Link to buyer and source inquiry
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    source_inquiry_id = db.Column(db.Integer, db.ForeignKey('inquiry.id'), nullable=True)

    # Deposit tracking
    deposit_paid = db.Column(db.Boolean, default=False)
    deposit_transaction_id = db.Column(db.String(200), nullable=True)


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)


class ShipmentDetail(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    awb_number = db.Column(db.String(100), nullable=False)
    flight_status = db.Column(db.String(100), nullable=True)  # Fetched from AWB API


# ─── Immutable Audit Log ──────────────────────────────────────────────────────

class AuditLog(db.Model):
    """
    Append-only audit log. Every admin/production action is recorded here.
    No UPDATE or DELETE operations are exposed — this table is write-once.
    """
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    username = db.Column(db.String(80), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    action = db.Column(db.String(100), nullable=False)  # e.g. "product.create", "order.status_change"
    resource_type = db.Column(db.String(50), nullable=False)  # e.g. "product", "order", "inquiry"
    resource_id = db.Column(db.Integer, nullable=True)
    old_values = db.Column(db.Text, nullable=True)  # JSON string
    new_values = db.Column(db.Text, nullable=True)  # JSON string
    ip_address = db.Column(db.String(45), nullable=True)
