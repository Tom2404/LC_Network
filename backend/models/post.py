from datetime import datetime, timedelta
from models import db

class Post(db.Model):
    __tablename__ = 'posts'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Content
    caption = db.Column(db.Text)
    content_type = db.Column(db.Enum('text', 'image', 'video', 'mixed', name='content_type_enum'), default='text')
    
    # Moderation status
    status = db.Column(
        db.Enum('pending', 'published', 'rejected', 'flagged', 'deleted', 'under_review', name='post_status_enum'),
        default='pending', index=True
    )
    moderation_status = db.Column(
        db.Enum('not_checked', 'ai_approved', 'ai_flagged', 'moderator_approved', 'moderator_rejected', name='moderation_status_enum'),
        default='not_checked'
    )
    
    # AI analysis results
    ai_confidence_score = db.Column(db.Numeric(5, 2))  # 0-100
    ai_flag_reasons = db.Column(db.JSON)  # Array of detected violations
    ai_analyzed_at = db.Column(db.DateTime)
    
    # Moderation details
    moderator_id = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    moderator_decision = db.Column(db.Enum('approve', 'reject', 'flag', name='moderator_decision_enum'))
    moderator_reason = db.Column(db.Text)
    moderated_at = db.Column(db.DateTime)
    
    # Metrics
    like_count = db.Column(db.Integer, default=0)
    comment_count = db.Column(db.Integer, default=0)
    share_count = db.Column(db.Integer, default=0)
    report_count = db.Column(db.Integer, default=0)
    
    # Privacy
    visibility = db.Column(db.Enum('public', 'friends', 'private', name='visibility_enum'), default='public')
    
    # Soft delete
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime)
    permanent_delete_at = db.Column(db.DateTime)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = db.Column(db.DateTime)
    
    # Relationships
    author = db.relationship('User', foreign_keys=[user_id], back_populates='posts')
    moderator = db.relationship('User', foreign_keys=[moderator_id])
    media = db.relationship('PostMedia', back_populates='post', lazy='dynamic', cascade='all, delete-orphan')
    comments = db.relationship('Comment', back_populates='post', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_author=True):
        """Convert model to dictionary"""
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'caption': self.caption,
            'content_type': self.content_type,
            'status': self.status,
            'visibility': self.visibility,
            'like_count': self.like_count,
            'comment_count': self.comment_count,
            'share_count': self.share_count,
            'report_count': self.report_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'media': [m.to_dict() for m in self.media.all()]
        }
        
        if include_author and self.author:
            data['author'] = {
                'id': self.author.id,
                'username': self.author.username,
                'full_name': self.author.full_name,
                'avatar_url': self.author.avatar_url
            }
        
        return data
    
    def mark_for_deletion(self, retention_days=30):
        """Mark post for soft deletion"""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()
        self.permanent_delete_at = datetime.utcnow() + timedelta(days=retention_days)
        self.status = 'deleted'
    
    def needs_moderation(self):
        """Check if post needs moderation"""
        return self.status in ['pending', 'under_review', 'flagged']
    
    def is_published(self):
        """Check if post is published and visible"""
        return self.status == 'published' and not self.is_deleted
    
    def __repr__(self):
        return f'<Post {self.id} by User {self.user_id}>'
