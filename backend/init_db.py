"""
Script to initialize the database and create all tables
Run this after setting up MySQL database
"""

from app import create_app, db

def init_database():
    """Initialize database and create all tables"""
    app = create_app('development')
    
    with app.app_context():
        # Drop all tables (be careful in production!)
        print("Dropping all existing tables...")
        db.drop_all()
        
        # Create all tables
        print("Creating all tables...")
        db.create_all()
        
        print("✓ Database initialized successfully!")
        print("✓ All tables created!")
        
        # Print created tables
        print("\nCreated tables:")
        for table in db.metadata.sorted_tables:
            print(f"  - {table.name}")

if __name__ == '__main__':
    init_database()
