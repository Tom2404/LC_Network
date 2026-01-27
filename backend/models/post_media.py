from datetime import datetime
from models import db

class PostMedia(db.Model):
    __tablename__ = 'post_media'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    post_id = db.Column(db.BigInteger, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False, index=True)
    media_type = db.Column(db.Enum('image', 'video', name='media_type_enum'), nullable=False)
    media_url = db.Column(db.Text, nullable=False)
    thumbnail_url = db.Column(db.Text)
    
    # Media info
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    duration = db.Column(db.Integer)  # For videos (seconds)
    file_size = db.Column(db.BigInteger)
    
    # AI analysis
    ai_nsfw_score = db.Column(db.Numeric(5, 2))
    ai_violence_score = db.Column(db.Numeric(5, 2))
    ai_text_extracted = db.Column(db.Text)  # OCR result
    ai_objects_detected = db.Column(db.JSON)
    
    display_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    post = db.relationship('Post', back_populates='media')
    
    def to_dict(self):
        return {
            'id': self.id,
            'media_type': self.media_type,
            'media_url': self.media_url,
            'thumbnail_url': self.thumbnail_url,
            'width': self.width,
            'height': self.height,
            'duration': self.duration,
            'file_size': self.file_size,
            'display_order': self.display_order
        }
    
    def __repr__(self):
        return f'<PostMedia {self.id} for Post {self.post_id}>'
