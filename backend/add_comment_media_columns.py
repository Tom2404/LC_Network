"""
Script to add media columns to comments table
Run this script to update the database schema
"""
from app import create_app
from models import db

def add_comment_media_columns():
    """Add media_url and media_type columns to comments table"""
    app = create_app()
    with app.app_context():
        try:
            # Check if columns already exist
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('comments')]
            
            if 'media_url' not in columns or 'media_type' not in columns:
                print("Adding media columns to comments table...")
                
                # Add columns using raw SQL
                with db.engine.connect() as conn:
                    if 'media_url' not in columns:
                        conn.execute(db.text("ALTER TABLE comments ADD COLUMN media_url VARCHAR(500)"))
                        print("✓ Added media_url column")
                    
                    if 'media_type' not in columns:
                        conn.execute(db.text("ALTER TABLE comments ADD COLUMN media_type VARCHAR(10)"))
                        print("✓ Added media_type column")
                    
                    conn.commit()
                
                print("\n✅ Database updated successfully!")
            else:
                print("ℹ Media columns already exist in comments table")
                
        except Exception as e:
            print(f"❌ Error updating database: {str(e)}")
            raise

if __name__ == '__main__':
    add_comment_media_columns()
