from datetime import datetime
from models import db
from sqlalchemy import Enum

class Like(db.Model):
    __tablename__ = 'likes'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    target_type = db.Column(Enum('post', 'comment', name='like_target_type_enum'), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False, index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'target_type', 'target_id', name='unique_like'),
        db.Index('idx_target', 'target_type', 'target_id'),
        db.Index('idx_user_likes', 'user_id', 'created_at')
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Like by User {self.user_id} on {self.target_type} {self.target_id}>'
