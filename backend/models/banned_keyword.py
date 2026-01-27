from datetime import datetime
from models import db
from sqlalchemy import Enum

class BannedKeyword(db.Model):
    __tablename__ = 'banned_keywords'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    keyword = db.Column(db.String(255), nullable=False)
    keyword_normalized = db.Column(db.String(255), nullable=False, unique=True, index=True)
    
    severity = db.Column(Enum('block', 'flag', 'review', name='keyword_severity_enum'), default='flag')
    category = db.Column(
        Enum('profanity', 'hate_speech', 'violence', 'sexual', 'spam', 'scam', 'other', name='keyword_category_enum'),
        nullable=False
    )
    
    is_regex = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True, index=True)
    
    added_by = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'keyword': self.keyword,
            'severity': self.severity,
            'category': self.category,
            'is_regex': self.is_regex,
            'is_active': self.is_active,
            'added_by': self.added_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
