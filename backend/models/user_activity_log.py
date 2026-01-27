from datetime import datetime
from models import db
from sqlalchemy import Enum

class UserActivityLog(db.Model):
    __tablename__ = 'user_activity_logs'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    activity_type = db.Column(
        Enum('login', 'logout', 'post_create', 'post_update', 'post_delete', 'profile_update', 'password_change', name='activity_type_enum'),
        nullable=False
    )
    
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    device_info = db.Column(db.Text)
    activity_metadata = db.Column(db.JSON)  # Additional activity details (renamed from metadata)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'activity_type': self.activity_type,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'device_info': self.device_info,
            'metadata': self.activity_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
