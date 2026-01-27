from datetime import datetime
from models import db

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255))  # NULL for OAuth users
    full_name = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(20))
    avatar_url = db.Column(db.Text)
    
    # OAuth fields
    oauth_provider = db.Column(db.Enum('local', 'google', 'facebook', name='oauth_provider_enum'), default='local')
    oauth_id = db.Column(db.String(255))
    
    # Account status
    account_status = db.Column(db.Enum('active', 'warning', 'banned', name='account_status_enum'), default='active')
    warning_count = db.Column(db.Integer, default=0)
    ban_reason = db.Column(db.Text)
    ban_until = db.Column(db.DateTime)
    
    # Verification
    is_email_verified = db.Column(db.Boolean, default=False)
    email_verification_token = db.Column(db.String(255))
    
    # OTP for registration
    otp_code = db.Column(db.String(6))
    otp_created_at = db.Column(db.DateTime)
    otp_verified = db.Column(db.Boolean, default=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = db.Column(db.DateTime)
    
    # Relationships
    posts = db.relationship('Post', foreign_keys='Post.user_id', back_populates='author', lazy='dynamic', cascade='all, delete-orphan')
    comments = db.relationship('Comment', foreign_keys='Comment.user_id', back_populates='author', lazy='dynamic', cascade='all, delete-orphan')
    roles = db.relationship('UserRole', foreign_keys='UserRole.user_id', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_sensitive=False):
        """Convert model to dictionary"""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email if include_sensitive else None,
            'full_name': self.full_name,
            'phone_number': self.phone_number if include_sensitive else None,
            'avatar_url': self.avatar_url,
            'account_status': self.account_status,
            'warning_count': self.warning_count,
            'is_email_verified': self.is_email_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None
        }
        return {k: v for k, v in data.items() if v is not None or include_sensitive}
    
    def has_role(self, role_name):
        """Check if user has a specific role"""
        from models.user_role import UserRole
        return UserRole.query.filter_by(user_id=self.id, role=role_name).first() is not None
    
    def is_active(self):
        """Check if user account is active"""
        return self.account_status == 'active'
    
    def is_banned(self):
        """Check if user is banned"""
        if self.account_status == 'banned':
            if self.ban_until and self.ban_until < datetime.utcnow():
                # Temporary ban expired
                self.account_status = 'active'
                db.session.commit()
                return False
            return True
        return False
    
    def __repr__(self):
        return f'<User {self.username}>'
