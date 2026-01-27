"""
Migration script to add OTP columns to users table
"""
import pymysql
from config import config

def add_otp_columns():
    """Add OTP columns to users table"""
    try:
        # Get database config
        db_config = config['development']
        db_url = db_config.SQLALCHEMY_DATABASE_URI
        
        # Parse connection details
        # Format: mysql+pymysql://user:password@host:port/database?charset=utf8mb4
        parts = db_url.replace('mysql+pymysql://', '').split('@')
        user_pass = parts[0].split(':')
        host_port_db = parts[1].split('/')
        host_port = host_port_db[0].split(':')
        
        # Remove query parameters from database name
        database_full = host_port_db[1]
        database = database_full.split('?')[0]
        
        user = user_pass[0]
        password = user_pass[1]
        host = host_port[0]
        port = int(host_port[1])
        
        # Connect to database
        connection = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            charset='utf8mb4'
        )
        
        print(f"Connected to database: {database}")
        
        cursor = connection.cursor()
        
        # Check if columns already exist
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME IN ('otp_code', 'otp_created_at', 'otp_verified')
        """, (database,))
        
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        if len(existing_columns) == 3:
            print("✓ All OTP columns already exist!")
            return
        
        print(f"Found {len(existing_columns)} OTP columns, adding missing ones...")
        
        # Add otp_code column if not exists
        if 'otp_code' not in existing_columns:
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN otp_code VARCHAR(6) NULL
            """)
            print("✓ Added otp_code column")
        
        # Add otp_created_at column if not exists
        if 'otp_created_at' not in existing_columns:
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN otp_created_at DATETIME NULL
            """)
            print("✓ Added otp_created_at column")
        
        # Add otp_verified column if not exists
        if 'otp_verified' not in existing_columns:
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN otp_verified BOOLEAN DEFAULT FALSE
            """)
            print("✓ Added otp_verified column")
        
        connection.commit()
        print("\n✓ Migration completed successfully!")
        
        cursor.close()
        connection.close()
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise

if __name__ == '__main__':
    add_otp_columns()
