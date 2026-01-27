from datetime import datetime
from models import db
from sqlalchemy import Enum

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    type = db.Column(
        Enum('like', 'comment', 'share', 'friend_request', 'friend_accept', 
             'violation_warning', 'post_approved', 'post_rejected', 'appeal_result', 
             name='notification_type_enum'),
        nullable=False
    )
    
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    
    related_id = db.Column(db.BigInteger)  # post_id, user_id, etc.
    related_type = db.Column(db.String(50))
    
    is_read = db.Column(db.Boolean, default=False, index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'related_id': self.related_id,
            'related_type': self.related_type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
