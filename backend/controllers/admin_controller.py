"""
Admin Controller
Handles admin authentication and session management
"""
from flask import Blueprint, request, jsonify, session, redirect, url_for, current_app
from functools import wraps
from models import db
from models.user import User
from models.user_role import UserRole
from extensions import bcrypt
from datetime import datetime

admin_auth_bp = Blueprint('admin_auth', __name__, url_prefix='/api/admin')

def admin_required(f):
    """Decorator to require admin authentication for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_user_id' not in session:
            return jsonify({'error': 'Authentication required', 'code': 'auth_required'}), 401

        now_ts = int(datetime.utcnow().timestamp())
        last_activity = session.get('admin_last_activity_ts')
        timeout_seconds = int(current_app.config.get('ADMIN_INACTIVITY_TIMEOUT_SECONDS', 900))

        if last_activity and (now_ts - int(last_activity) > timeout_seconds):
            session.clear()
            return jsonify({'error': 'Session expired due to inactivity', 'code': 'session_timeout'}), 401

        session['admin_last_activity_ts'] = now_ts
        
        # Verify user still has admin role
        user = User.query.get(session['admin_user_id'])
        if not user or not user.has_role('admin'):
            session.clear()
            return jsonify({'error': 'Admin privileges required', 'code': 'admin_required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

@admin_auth_bp.route('/login', methods=['POST'])
def admin_login():
    """Admin login endpoint"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        # Find user
        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()
        
        if not user:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Check password
        if not bcrypt.check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Check if user is admin
        if not user.has_role('admin'):
            return jsonify({'error': 'Admin privileges required'}), 403
        
        # Check account status
        if user.account_status != 'active':
            return jsonify({'error': f'Account is {user.account_status}'}), 403
        
        # Create session
        session.permanent = True
        session['admin_user_id'] = user.id
        session['admin_username'] = user.username
        session['admin_email'] = user.email
        session['admin_login_time'] = datetime.utcnow().isoformat()
        session['admin_last_activity_ts'] = int(datetime.utcnow().timestamp())
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'avatar_url': user.avatar_url
            }
        }), 200
        
    except Exception as e:
        print(f"Admin login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@admin_auth_bp.route('/logout', methods=['POST'])
def admin_logout():
    """Admin logout endpoint"""
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200

@admin_auth_bp.route('/check-session', methods=['GET'])
def check_session():
    """Check if admin session is active"""
    if 'admin_user_id' not in session:
        return jsonify({'authenticated': False}), 401

    now_ts = int(datetime.utcnow().timestamp())
    last_activity = session.get('admin_last_activity_ts')
    timeout_seconds = int(current_app.config.get('ADMIN_INACTIVITY_TIMEOUT_SECONDS', 900))
    if last_activity and (now_ts - int(last_activity) > timeout_seconds):
        session.clear()
        return jsonify({'authenticated': False, 'error': 'Session expired due to inactivity', 'code': 'session_timeout'}), 401
    session['admin_last_activity_ts'] = now_ts
    
    user = User.query.get(session['admin_user_id'])
    if not user or not user.has_role('admin'):
        session.clear()
        return jsonify({'authenticated': False}), 401
    
    return jsonify({
        'authenticated': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'avatar_url': user.avatar_url
        }
    }), 200

@admin_auth_bp.route('/me', methods=['GET'])
@admin_required
def get_admin_info():
    """Get current admin user info"""
    user = User.query.get(session['admin_user_id'])
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.full_name,
        'avatar_url': user.avatar_url,
        'created_at': user.created_at.isoformat() if user.created_at else None
    }), 200
