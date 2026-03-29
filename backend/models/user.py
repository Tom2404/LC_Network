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
        is_muted = self.is_muted()
        data = {
            'id': self.id,
            'username': self.username,
            'full_name': self.full_name,
            'avatar_url': self.avatar_url,
            'account_status': self.account_status,
            'is_muted': is_muted,
            'mute_until': self.ban_until.isoformat() if is_muted and self.ban_until else None,
            'mute_reason': self.ban_reason if is_muted else None,
            'warning_count': self.warning_count,
            'is_email_verified': self.is_email_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None
        }
        
        # Add sensitive fields only when requested
        if include_sensitive:
            data['email'] = self.email
            data['phone_number'] = self.phone_number
        
        return data
    
    def has_role(self, role_name):
        """Check if user has a specific role"""
        from models.user_role import UserRole
        return UserRole.query.filter_by(user_id=self.id, role=role_name).first() is not None
    
    def is_active(self):
        """Check if user is allowed to access the platform"""
        return not self.is_banned()
    
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

    def is_muted(self):
        """Check if user is temporarily muted (cannot create new content)."""
        if self.account_status == 'warning' and self.ban_until:
            if self.ban_until < datetime.utcnow():
                # Mute expired
                self.account_status = 'active'
                self.ban_reason = None
                self.ban_until = None
                db.session.commit()
                return False
            return True
        return False

    def can_create_content(self):
        """Check if user can post/comment/reply content."""
        return not self.is_banned() and not self.is_muted()
    
    def __repr__(self):
        return f'<User {self.username}>'
