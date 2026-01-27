from datetime import datetime
from models import db
from sqlalchemy import Enum

class Appeal(db.Model):
    __tablename__ = 'appeals'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    appeal_type = db.Column(Enum('post_rejection', 'account_warning', 'account_ban', name='appeal_type_enum'), nullable=False)
    target_id = db.Column(db.BigInteger)  # post_id if post_rejection
    
    reason = db.Column(db.Text, nullable=False)
    evidence_urls = db.Column(db.JSON)  # User can provide proof
    
    status = db.Column(Enum('pending', 'under_review', 'approved', 'rejected', name='appeal_status_enum'), default='pending', index=True)
    
    # Resolution
    reviewed_by = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'))
    moderator_decision = db.Column(db.Text)
    reviewed_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'appeal_type': self.appeal_type,
            'target_id': self.target_id,
            'reason': self.reason,
            'evidence_urls': self.evidence_urls,
            'status': self.status,
            'reviewed_by': self.reviewed_by,
            'moderator_decision': self.moderator_decision,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
