from datetime import datetime
from models import db

class Comment(db.Model):
    __tablename__ = 'comments'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    post_id = db.Column(db.BigInteger, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    parent_comment_id = db.Column(db.BigInteger, db.ForeignKey('comments.id', ondelete='CASCADE'))
    
    content = db.Column(db.Text, nullable=False)
    
    # AI moderation
    is_blocked = db.Column(db.Boolean, default=False)
    block_reason = db.Column(db.Text)
    ai_flagged = db.Column(db.Boolean, default=False)
    
    like_count = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships for nested comments
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy='dynamic', cascade='all, delete-orphan')
    post = db.relationship('Post', back_populates='comments')
    author = db.relationship('User', back_populates='comments')
    
    def to_dict(self, include_replies=False):
        """Convert model to dictionary"""
        data = {
            'id': self.id,
            'post_id': self.post_id,
            'user_id': self.user_id,
            'parent_comment_id': self.parent_comment_id,
            'content': self.content,
            'is_blocked': self.is_blocked,
            'block_reason': self.block_reason,
            'like_count': self.like_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if self.author:
            data['author'] = {
                'id': self.author.id,
                'username': self.author.username,
                'full_name': self.author.full_name,
                'avatar_url': self.author.avatar_url
            }
        
        if include_replies:
            data['replies'] = [reply.to_dict() for reply in self.replies.all()]
        
        return data
    
    def __repr__(self):
        return f'<Comment {self.id} on Post {self.post_id}>'
