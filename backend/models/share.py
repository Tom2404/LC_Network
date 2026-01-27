from datetime import datetime
from models import db

class Share(db.Model):
    __tablename__ = 'shares'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    post_id = db.Column(db.BigInteger, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False, index=True)
    shared_caption = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'post_id': self.post_id,
            'shared_caption': self.shared_caption,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
