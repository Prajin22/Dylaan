from extensions import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='customer')  # customer, admin, production
    auth_token = db.Column(db.String(256), nullable=True)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # flower, leaf, vegetable
    price = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(30), nullable=False, default='kg')
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)  # S3 URL
    in_stock = db.Column(db.Boolean, default=True)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_name = db.Column(db.String(150), nullable=False, default='Unknown Client')
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, packing, qc, shipped, delivered
    priority = db.Column(db.String(20), nullable=False, default='medium')  # high, medium, low
    total_boxes = db.Column(db.Integer, nullable=False, default=0)
    destination_airport = db.Column(db.String(10), nullable=True)
    flight_time = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # user_id is optional for B2B (orders can be admin-created)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

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
