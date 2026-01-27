from datetime import datetime
from models import db
from sqlalchemy import Enum

class Report(db.Model):
    __tablename__ = 'reports'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    reporter_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    target_type = db.Column(Enum('post', 'comment', 'user', name='report_target_type_enum'), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False, index=True)
    
    reason = db.Column(Enum('spam', 'violence', 'hate_speech', 'nudity', 'scam', 'terrorism', 'other', name='report_reason_enum'), nullable=False)
    description = db.Column(db.Text)
    
    status = db.Column(Enum('pending', 'reviewing', 'resolved', 'dismissed', name='report_status_enum'), default='pending', index=True)
    
    # Resolution
    resolved_by = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'))
    resolution_note = db.Column(db.Text)
    resolved_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'reporter_id': self.reporter_id,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'reason': self.reason,
            'description': self.description,
            'status': self.status,
            'resolved_by': self.resolved_by,
            'resolution_note': self.resolution_note,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
