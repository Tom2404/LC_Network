from datetime import datetime
from models import db

class UserBlock(db.Model):
    __tablename__ = 'user_blocks'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    blocker_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    blocked_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('blocker_id', 'blocked_id', name='unique_block'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'blocker_id': self.blocker_id,
            'blocked_id': self.blocked_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
