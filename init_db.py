from app import app, db
from models import User

def init_db():
    with app.app_context():
        # Create all database tables
        db.create_all()
        
        # Create an admin user if it doesn't exist
        admin = User.query.filter_by(email='admin@example.com').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@example.com',
                role='admin'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("Admin user created successfully")

if __name__ == '__main__':
    init_db()
