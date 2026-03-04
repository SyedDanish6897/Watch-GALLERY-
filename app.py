from flask import Flask, render_template, request, jsonify, session, redirect
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from flask_mail import Mail, Message
from flask import send_file
import io
import os
import cloudinary
import cloudinary.uploader
import razorpay
import json

app = Flask(__name__)
app.secret_key = "supersecretkey"

basedir = os.path.abspath(os.path.dirname(__file__))

# ================= RAZORPAY CONFIG =================
razorpay_client = razorpay.Client(
    auth=("rzp_test_RvB0GTienxup7o", "Ygdoz1ROhDMSCTHTCOR3QLR5"),
    timeout=30
)

# ================= ADMIN CONFIG =================
ADMIN_EMAIL = "admin@watchgallery.com"
ADMIN_PASSWORD = "admin123"

# ================= CLOUDINARY CONFIG =================
cloudinary.config(
    cloud_name="dwcyjebla",
    api_key="188228825888121",
    api_secret="i5__Q9Lw8GYhD7DRyfv3ZWroCoE"
)

# ================= DATABASE CONFIG =================
import os

db_url = os.environ.get("DATABASE_URL")

if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
else:
    # Local fallback
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'watchgallery.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
# ================= MAIL CONFIG =================
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME='syeddanish6897@gmail.com',
    MAIL_PASSWORD='Danish@2005'
)
mail = Mail(app)

# ================= MODELS =================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(300), unique=True, nullable=False)
    password = db.Column(db.String(300), nullable=False)
    full_name = db.Column(db.String(300))
    dob = db.Column(db.Date)
    address = db.Column(db.String(300))
    contact_no = db.Column(db.String(20))
    profile_complete = db.Column(db.Boolean, default=False)
    orders = db.relationship('Order', backref='user', lazy=True)


class Watch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    brand = db.Column(db.String(100), nullable=False)
    model = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    discount_price = db.Column(db.Float)
    category = db.Column(db.String(50))
    image = db.Column(db.String(300))
    images = db.Column(db.Text, nullable=True)
    description = db.Column(db.Text)   # ✅ ADD THIS


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    watch_brand_model = db.Column(db.String(300), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    buyer_name = db.Column(db.String(150), nullable=False)
    buyer_email = db.Column(db.String(150), nullable=False)
    buyer_phone = db.Column(db.String(20), nullable=False)
    buyer_address = db.Column(db.String(300), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

with app.app_context():
    db.create_all()

# ================= INVOICE PDF =================
def generate_invoice(order):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.drawString(100, 800, "Watch Gallery Invoice")
    c.drawString(100, 760, f"Invoice: {order.invoice_number}")
    c.drawString(100, 740, f"Name: {order.buyer_name}")
    c.drawString(100, 720, f"Email: {order.buyer_email}")
    c.drawString(100, 700, f"Amount: ₹{order.amount}")
    c.save()
    buffer.seek(0)
    return buffer.read()

# ================= ROUTES =================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/cart')
def cart():
    return render_template('cart.html')

# ================= AUTH =================
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json(force=True)
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "User exists"}), 400
    user = User(email=data['email'], password=generate_password_hash(data['password']))
    db.session.add(user)
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(force=True)
    user = User.query.filter_by(email=data.get('email')).first()
    if not user or not check_password_hash(user.password, data.get('password')):
        return jsonify({"error": "Invalid credentials"}), 401
    session['user_id'] = user.id
    return jsonify({"status": "success", "profile_complete": user.profile_complete})

@app.route('/api/logout')
def logout():
    session.clear()
    return jsonify({"status": "success"})

# ================= PROFILE =================
@app.route('/api/profile', methods=['POST'])
def profile():
    user = User.query.get(session['user_id'])
    data = request.get_json(force=True)
    user.full_name = data['full_name']
    user.address = data['address']
    user.contact_no = data['contact_no']
    user.dob = datetime.strptime(data['dob'], '%Y-%m-%d')
    user.profile_complete = True
    db.session.commit()
    return jsonify({"status": "success"})

# ================= WATCHES =================
@app.route('/api/watches')
def watches():
    return jsonify({"watches": [
        {
            "id": w.id,
            "brand": w.brand,
            "model": w.model,
            "price": w.price,
            "discount_price": w.discount_price,
            "category": w.category,
            "image": w.image
        } for w in Watch.query.all()
    ]})

# ================= 🔧 FIX: CREATE ORDER (GLUE ROUTE) =================
@app.route('/api/create-order', methods=['POST'])
def create_order():
    if 'user_id' not in session:
        return jsonify({"error": "Login required"}), 401

    user = User.query.get(session['user_id'])
    if not user.profile_complete:
        return jsonify({"error": "Complete profile first"}), 400

    data = request.get_json(force=True)
    cart = data.get("cart")

    total = 0
    summary = []
    for item in cart:
        total += item["price"] * item["qty"]
        summary.append(f"{item['brand']} {item['model']} x{item['qty']}")

    invoice = f"INV{int(datetime.utcnow().timestamp())}"

    session["pending_invoice"] = {
        "invoice": invoice,
        "amount": total,
        "summary": ", ".join(summary)
    }

    return jsonify({
        "status": "success",
        "invoice": invoice
    })

# ================= RAZORPAY ORDER =================
@app.route('/api/create-razorpay-order', methods=['POST'])
def create_razorpay_order():
    data = request.get_json()
    order = razorpay_client.order.create({
        "amount": int(data['amount']),
        "currency": "INR",
        "payment_capture": 1
    })
    return jsonify(order)

# ================= PAYMENT SUCCESS =================
@app.route('/api/payment-success', methods=['POST'])
def payment_success():
    user = User.query.get(session['user_id'])
    data = request.get_json()

    order = Order(
        invoice_number=session["pending_invoice"]["invoice"],
        watch_brand_model=data['summary'],
        amount=data['amount'],
        buyer_name=user.full_name,
        buyer_email=user.email,
        buyer_phone=user.contact_no,
        buyer_address=user.address,
        user_id=user.id
    )
    db.session.add(order)
    db.session.commit()

    pdf = generate_invoice(order)

    msg = Message(
        subject="Watch Gallery Invoice",
        recipients=[user.email],
        body="Thank you for your purchase."
    )
    msg.attach("invoice.pdf", "application/pdf", pdf)
    mail.send(msg)

    session.pop("pending_invoice", None)

    return jsonify({"status": "success"})


# ================= ADMIN ROUTES (RESTORED) =================

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        if email == ADMIN_EMAIL and password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return redirect('/admin/dashboard')

        return "Invalid admin credentials", 401

    return render_template('admin/login.html')

#================= ADMIN LOGOUT =================
@app.route('/admin/logout')
def admin_logout():
    session.pop('admin_logged_in', None)
    return redirect('/admin/login')

#================= ADMIN DASHBOARD =================
@app.route('/admin/dashboard')
def admin_dashboard():
    if not session.get('admin_logged_in'):
        return redirect('/admin/login')

    watches = Watch.query.all()
    return render_template('admin/dashboard.html', watches=watches)

# ================= ADD WATCH =================
@app.route('/admin/add-watch', methods=['GET', 'POST'])
def admin_add_watch():
    if not session.get('admin_logged_in'):
        return redirect('/admin/login')

    if request.method == 'POST':
        import json

        # ---------- PRICE ----------
        price = float(request.form['price'].replace(',', ''))

        discount_text = request.form.get('discount_price')
        discount_price = float(discount_text.replace(',', '')) if discount_text else None

        # ---------- MAIN IMAGE ----------
        image_url = None
        if 'image' in request.files and request.files['image'].filename:
            result = cloudinary.uploader.upload(request.files['image'])
            image_url = result['secure_url']

        # ---------- EXTRA IMAGES ----------
        extra_images = request.files.getlist('images')
        extra_urls = []

        for img in extra_images:
            if img and img.filename:
                res = cloudinary.uploader.upload(img)
                extra_urls.append(res['secure_url'])

        # ---------- SAVE WATCH ----------
        watch = Watch(
            brand=request.form['brand'],
            model=request.form['model'],
            price=price,
            discount_price=discount_price,
            category=request.form['category'],
            image=image_url,
            images=json.dumps(extra_urls),
            description=request.form.get('description')  # ✅ ADD THIS
            
        )

        db.session.add(watch)
        db.session.commit()

        return redirect('/admin/dashboard')

    return render_template('admin/add_watch.html')


#================= EDIT WATCH =================
@app.route('/admin/edit-watch/<int:watch_id>', methods=['GET', 'POST'])
def admin_edit_watch(watch_id):
    if not session.get('admin_logged_in'):
        return redirect('/admin/login')

    watch = Watch.query.get_or_404(watch_id)

    if request.method == 'POST':
        watch.brand = request.form['brand']
        watch.model = request.form['model']
        watch.category = request.form['category']
        watch.price = float(request.form['price'].replace(',', ''))

        discount_text = request.form.get('discount_price')
        watch.discount_price = float(discount_text.replace(',', '')) if discount_text else None

        if 'image' in request.files and request.files['image'].filename:
            watch.image = cloudinary.uploader.upload(
                request.files['image']
            )['secure_url']
        watch.description = request.form.get('description')
        db.session.commit()
        return redirect('/admin/dashboard')

    return render_template('admin/edit_watch.html', watch=watch)

#================= DELETE WATCH =================
@app.route('/admin/delete-watch/<int:watch_id>')
def admin_delete_watch(watch_id):
    if not session.get('admin_logged_in'):
        return redirect('/admin/login')

    watch = Watch.query.get_or_404(watch_id)
    db.session.delete(watch)
    db.session.commit()
    return redirect('/admin/dashboard')


# ================= ADMIN: ORDER LIST =================
@app.route('/admin/orders')
def admin_orders():
    if not session.get('admin_logged_in'):
        return redirect('/admin/login')

    orders = Order.query.order_by(Order.date.desc()).all()
    return render_template('admin/orders.html', orders=orders)



# ================= ADMIN: DOWNLOAD INVOICE =================
@app.route('/admin/invoice/<int:order_id>')
def admin_invoice(order_id):
    if not session.get('admin_logged_in'):
        return redirect('/admin/login')

    order = Order.query.get_or_404(order_id)
    pdf = generate_invoice(order)

    return send_file(
        io.BytesIO(pdf),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{order.invoice_number}.pdf"
    )


# ================= WATCH DETAIL =================

@app.route('/watch/<int:watch_id>')
def watch_detail(watch_id):
    watch = Watch.query.get_or_404(watch_id)

    # ✅ Convert JSON string → Python list
    images = []
    if watch.images:
        try:
            images = json.loads(watch.images)
        except:
            images = []

    return render_template(
        "watch_detail.html",
        watch=watch,
        images=images
    )



if __name__ == '__main__':
    app.run(debug=True,)
    
with app.app_context():
    db.create_all()

