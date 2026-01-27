from datetime import datetime
from models import db
from sqlalchemy import Enum

class ViolationHistory(db.Model):
    __tablename__ = 'violation_history'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    violation_type = db.Column(
        Enum('spam', 'hate_speech', 'nudity', 'violence', 'scam', 'deepfake', 'other', name='violation_type_enum'),
        nullable=False
    )
    severity = db.Column(Enum('minor', 'moderate', 'severe', 'critical', name='violation_severity_enum'), nullable=False, index=True)
    
    # Related content
    post_id = db.Column(db.BigInteger, db.ForeignKey('posts.id', ondelete='SET NULL'))
    comment_id = db.Column(db.BigInteger)
    
    description = db.Column(db.Text)
    
    # Action taken
    action_taken = db.Column(
        Enum('warning', 'mute_1d', 'mute_3d', 'mute_7d', 'temporary_ban', 'permanent_ban', 'content_removal', name='violation_action_enum'),
        nullable=False
    )
    action_by = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'))  # Moderator or NULL for AI
    
    expires_at = db.Column(db.DateTime)  # For temporary actions
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'violation_type': self.violation_type,
            'severity': self.severity,
            'post_id': self.post_id,
            'comment_id': self.comment_id,
            'description': self.description,
            'action_taken': self.action_taken,
            'action_by': self.action_by,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
