from datetime import datetime
from models import db
from sqlalchemy import Enum

class ModerationQueue(db.Model):
    __tablename__ = 'moderation_queue'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    
    target_type = db.Column(Enum('post', 'avatar', 'appeal', name='mod_queue_target_type_enum'), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False, index=True)
    
    source = db.Column(Enum('ai_flagged', 'user_report', 'manual_review', 'appeal', name='mod_queue_source_enum'), nullable=False)
    
    priority = db.Column(db.Integer, default=0, index=True)  # Higher = more urgent
    
    # Assignment
    assigned_to = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'))
    status = db.Column(Enum('pending', 'locked', 'completed', name='mod_queue_status_enum'), default='pending', index=True)
    
    # AI suggestions
    ai_recommendation = db.Column(Enum('approve', 'reject', 'escalate', name='ai_recommendation_enum'))
    ai_confidence = db.Column(db.Numeric(5, 2))
    ai_detected_issues = db.Column(db.JSON)
    
    locked_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'source': self.source,
            'priority': self.priority,
            'assigned_to': self.assigned_to,
            'status': self.status,
            'ai_recommendation': self.ai_recommendation,
            'ai_confidence': float(self.ai_confidence) if self.ai_confidence else None,
            'ai_detected_issues': self.ai_detected_issues,
            'locked_at': self.locked_at.isoformat() if self.locked_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
