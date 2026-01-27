from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.user_activity_log import UserActivityLog
from utils.file_upload import upload_file, allowed_file
from datetime import datetime

user_bp = Blueprint('user', __name__)

@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Lấy thông tin profile của user hiện tại"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict(include_sensitive=True)}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@user_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """
    Cập nhật thông tin profile
    Body: {full_name, phone_number, avatar_url (optional)}
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'full_name' in data:
            user.full_name = data['full_name']
        
        if 'phone_number' in data:
            user.phone_number = data['phone_number']
        
        if 'avatar_url' in data:
            # TODO: AI moderation for avatar (Phase 5)
            user.avatar_url = data['avatar_url']
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Log activity
        log = UserActivityLog(
            user_id=current_user_id,
            activity_type='profile_update',
            ip_address=request.remote_addr
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/profile/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    """Upload avatar (with file)"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if 'avatar' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['avatar']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, 'image'):
            return jsonify({'error': 'Invalid file type. Only images allowed'}), 400
        
        # Upload file
        file_url = upload_file(file, folder='avatars')
        
        # TODO: AI moderation for avatar (Phase 5)
        # For now, directly update
        user.avatar_url = file_url
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Avatar uploaded successfully',
            'avatar_url': file_url
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/profile/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_profile(user_id):
    """Xem profile của user khác"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict(include_sensitive=False)}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@user_bp.route('/activity-logs', methods=['GET'])
@jwt_required()
def get_activity_logs():
    """Xem lịch sử hoạt động"""
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        logs = UserActivityLog.query.filter_by(user_id=current_user_id)\
            .order_by(UserActivityLog.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'logs': [log.to_dict() for log in logs.items],
            'total': logs.total,
            'pages': logs.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@user_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Đổi mật khẩu
    Body: {old_password, new_password}
    """
    from flask import current_app
    from flask_bcrypt import Bcrypt
    bcrypt = Bcrypt(current_app)
    
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data.get('old_password') or not data.get('new_password'):
            return jsonify({'error': 'Old and new passwords are required'}), 400
        
        # Verify old password
        if not bcrypt.check_password_hash(user.password_hash, data['old_password']):
            return jsonify({'error': 'Incorrect old password'}), 401
        
        # Update password
        new_password_hash = bcrypt.generate_password_hash(data['new_password']).decode('utf-8')
        user.password_hash = new_password_hash
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Log activity
        log = UserActivityLog(
            user_id=current_user_id,
            activity_type='password_change',
            ip_address=request.remote_addr
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
