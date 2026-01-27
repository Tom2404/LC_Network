from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.user_role import UserRole
from models.user_activity_log import UserActivityLog
from utils.validators import validate_email, validate_password
from utils.email_service import send_verification_email, send_otp_email
import secrets
import random
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Đăng ký tài khoản mới (manual registration)
    Body: {email, username, password, full_name, phone_number}
    """
    from extensions import bcrypt
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'username', 'password', 'full_name']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate email format
        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength
        password_valid, password_message = validate_password(data['password'])
        if not password_valid:
            return jsonify({'error': password_message}), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            # If user exists but OTP not verified and expired, delete old account
            if not existing_user.otp_verified and existing_user.otp_created_at:
                if datetime.utcnow() - existing_user.otp_created_at > timedelta(minutes=10):
                    db.session.delete(existing_user)
                    db.session.commit()
                else:
                    return jsonify({'error': 'Email already registered. Please verify OTP or wait 10 minutes to re-register.'}), 409
            else:
                return jsonify({'error': 'Email already registered'}), 409
        
        existing_username = User.query.filter_by(username=data['username']).first()
        if existing_username:
            # If username exists but OTP not verified and expired, delete old account
            if not existing_username.otp_verified and existing_username.otp_created_at:
                if datetime.utcnow() - existing_username.otp_created_at > timedelta(minutes=10):
                    db.session.delete(existing_username)
                    db.session.commit()
                else:
                    return jsonify({'error': 'Username already taken. Previous registration pending OTP verification.'}), 409
            else:
                return jsonify({'error': 'Username already taken'}), 409
        
        # Create new user
        password_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        
        # Generate 6-digit OTP
        otp_code = str(random.randint(100000, 999999))
        
        new_user = User(
            email=data['email'],
            username=data['username'],
            password_hash=password_hash,
            full_name=data['full_name'],
            phone_number=data.get('phone_number'),
            oauth_provider='local',
            otp_code=otp_code,
            otp_created_at=datetime.utcnow(),
            otp_verified=False,
            is_email_verified=False
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Assign default 'user' role
        user_role = UserRole(user_id=new_user.id, role='user')
        db.session.add(user_role)
        db.session.commit()
        
        # Send OTP email
        send_otp_email(new_user.email, new_user.username, otp_code)
        
        return jsonify({
            'message': 'Registration successful! Please check your email for OTP code.',
            'user_id': new_user.id,
            'email': new_user.email
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    """
    Xác thực OTP và tự động đăng nhập
    Body: {user_id, otp_code}
    """
    try:
        data = request.get_json()
        
        if not data.get('user_id') or not data.get('otp_code'):
            return jsonify({'error': 'User ID and OTP code are required'}), 400
        
        # Find user
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if already verified
        if user.otp_verified:
            return jsonify({'error': 'OTP already verified. You can login now.'}), 400
        
        # Check OTP expiration (5 minutes)
        if not user.otp_created_at or datetime.utcnow() - user.otp_created_at > timedelta(minutes=5):
            # Delete expired unverified account
            db.session.delete(user)
            db.session.commit()
            return jsonify({'error': 'OTP has expired. Your registration has been cancelled. Please register again.'}), 400
        
        # Verify OTP
        if user.otp_code != data['otp_code']:
            return jsonify({'error': 'Invalid OTP code'}), 400
        
        # Mark as verified and activate email
        user.otp_verified = True
        user.is_email_verified = True
        user.otp_code = None  # Clear OTP
        user.last_login_at = datetime.utcnow()
        db.session.commit()
        
        # Log activity
        log_activity(user.id, 'registration_completed', request)
        
        # Create tokens for auto-login
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'message': 'OTP verified successfully! You are now logged in.',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    """
    Gửi lại OTP mới
    Body: {user_id}
    """
    try:
        data = request.get_json()
        
        if not data.get('user_id'):
            return jsonify({'error': 'User ID is required'}), 400
        
        # Find user
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if already verified
        if user.otp_verified:
            return jsonify({'error': 'Account already verified'}), 400
        
        # Generate new OTP
        otp_code = str(random.randint(100000, 999999))
        user.otp_code = otp_code
        user.otp_created_at = datetime.utcnow()
        db.session.commit()
        
        # Send OTP email
        send_otp_email(user.email, user.username, otp_code)
        
        return jsonify({
            'message': 'New OTP code has been sent to your email.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Đăng nhập
    Body: {email, password}
    """
    from extensions import bcrypt
    
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user
        user = User.query.filter_by(email=data['email']).first()
        
        if not user or not bcrypt.check_password_hash(user.password_hash, data['password']):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Check if account is banned
        if user.is_banned():
            return jsonify({
                'error': 'Your account has been banned',
                'reason': user.ban_reason,
                'ban_until': user.ban_until.isoformat() if user.ban_until else 'permanent'
            }), 403
        
        # Check OTP verification (must verify OTP to activate account)
        if not user.otp_verified or not user.is_email_verified:
            return jsonify({
                'error': 'Please verify your OTP code to activate your account.',
                'note': 'If OTP has expired, please register again.'
            }), 403
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        db.session.commit()
        
        # Log activity
        log_activity(user.id, 'login', request)
        
        # Create tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    """Xác thực email"""
    try:
        user = User.query.filter_by(email_verification_token=token).first()
        
        if not user:
            return jsonify({'error': 'Invalid verification token'}), 400
        
        if user.is_email_verified:
            return jsonify({'message': 'Email already verified'}), 200
        
        user.is_email_verified = True
        user.email_verification_token = None
        db.session.commit()
        
        return jsonify({'message': 'Email verified successfully!'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Làm mới access token"""
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        
        return jsonify({'access_token': access_token}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Đăng xuất (client cần xóa token)"""
    try:
        current_user_id = get_jwt_identity()
        log_activity(current_user_id, 'logout', request)
        
        return jsonify({'message': 'Logout successful'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Helper function
def log_activity(user_id, activity_type, req):
    """Log user activity"""
    try:
        log = UserActivityLog(
            user_id=user_id,
            activity_type=activity_type,
            ip_address=req.remote_addr,
            user_agent=req.headers.get('User-Agent')
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f"Failed to log activity: {e}")
