from datetime import datetime
from models import db
from sqlalchemy import Enum

class UserRole(db.Model):
    __tablename__ = 'user_roles'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = db.Column(Enum('user', 'moderator', 'admin', name='user_role_enum'), default='user', index=True)
    
    granted_by = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'))
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], back_populates='roles')
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'role', name='unique_user_role'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'role': self.role,
            'granted_by': self.granted_by,
            'granted_at': self.granted_at.isoformat() if self.granted_at else None
        }
    
    def __repr__(self):
        return f'<UserRole {self.role} for User {self.user_id}>'
