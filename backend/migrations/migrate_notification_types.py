"""
Migration Script: Update Notification Types
===========================================
Run this script to update the notifications table ENUM type 
with new notification types.

Requirements:
- Database connection configured in config.py
- MySQL/MariaDB database

New notification types added:
- reply: For comment replies
- post_flagged: When post is flagged for review
- account_suspended: Account suspension notification
- account_banned: Account ban notification  
- account_warning: Account warning notification

Usage:
    python backend/migrations/migrate_notification_types.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from extensions import db
from flask import Flask
from config import Config

def run_migration():
    """Run the notification types migration"""
    
    # Create minimal Flask app for db context
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        try:
            print("=" * 60)
            print("Starting Notification Types Migration")
            print("=" * 60)
            
            # Read the SQL migration file
            migration_file = os.path.join(os.path.dirname(__file__), 'update_notification_types.sql')
            
            with open(migration_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # Split by semicolon and execute each statement
            statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
            
            for i, statement in enumerate(statements):
                if 'SELECT COLUMN_TYPE' in statement:
                    # This is the verification query
                    print(f"\n[{i+1}] Verifying changes...")
                    result = db.session.execute(db.text(statement))
                    column_type = result.fetchone()[0]
                    print(f"✓ Column type updated to:\n  {column_type}")
                elif 'ALTER TABLE' in statement:
                    print(f"\n[{i+1}] Updating notifications table ENUM...")
                    db.session.execute(db.text(statement))
                    db.session.commit()
                    print("✓ ENUM type updated successfully")
            
            print("\n" + "=" * 60)
            print("✓ Migration completed successfully!")
            print("=" * 60)
            print("\nNew notification types available:")
            print("  • reply")
            print("  • post_flagged")
            print("  • account_suspended")
            print("  • account_banned")
            print("  • account_warning")
            print()
            
        except Exception as e:
            print(f"\n✗ Migration failed: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return False
    
    return True

if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)
