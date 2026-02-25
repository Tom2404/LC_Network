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
        current_user_id = int(get_jwt_identity())
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
        current_user_id = int(get_jwt_identity())
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
        print("=== Upload Avatar Request ===")
        current_user_id = int(get_jwt_identity())  # Convert string to int
        print(f"User ID: {current_user_id}")
        
        user = User.query.get(current_user_id)
        
        if not user:
            print("User not found")
            return jsonify({'error': 'User not found'}), 404
        
        print(f"Request files: {request.files}")
        print(f"Request form: {request.form}")
        
        if 'avatar' not in request.files:
            print("No avatar in request.files")
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['avatar']
        print(f"File: {file}, Filename: {file.filename}")
        
        if file.filename == '':
            print("Empty filename")
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, 'image'):
            print(f"File type not allowed: {file.filename}")
            return jsonify({'error': 'Invalid file type. Only images allowed'}), 400
        
        # Upload file
        print("Uploading file...")
        file_url = upload_file(file, folder='avatars')
        print(f"File uploaded: {file_url}")
        
        # TODO: AI moderation for avatar (Phase 5)
        # For now, directly update
        user.avatar_url = file_url
        user.updated_at = datetime.utcnow()
        db.session.commit()
        print("Database updated")
        
        return jsonify({
            'message': 'Avatar uploaded successfully',
            'avatar_url': file_url
        }), 200
        
    except Exception as e:
        print(f"ERROR in upload_avatar: {str(e)}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/profile/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_profile(user_id):
    """Xem profile của user khác kèm trạng thái kết bạn"""
    try:
        from models.friendship import Friendship
        
        current_user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user_dict = user.to_dict(include_sensitive=False)
        
        # Thêm thông tin trạng thái kết bạn
        if current_user_id != user_id:
            friendship = Friendship.query.filter(
                ((Friendship.user_id == current_user_id) & (Friendship.friend_id == user_id)) |
                ((Friendship.user_id == user_id) & (Friendship.friend_id == current_user_id))
            ).first()
            
            if friendship:
                user_dict['friendship_status'] = friendship.status
                user_dict['is_requester'] = (friendship.requester_id == current_user_id)
            else:
                user_dict['friendship_status'] = None
                user_dict['is_requester'] = False
        else:
            user_dict['friendship_status'] = 'self'
            user_dict['is_requester'] = False
        
        return jsonify({'user': user_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@user_bp.route('/activity-logs', methods=['GET'])
@jwt_required()
def get_activity_logs():
    """Xem lịch sử hoạt động"""
    try:
        current_user_id = int(get_jwt_identity())
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
        current_user_id = int(get_jwt_identity())
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


@user_bp.route('/search', methods=['GET'])
@jwt_required()
def search_users():
    """
    Tìm kiếm người dùng theo tên hoặc email
    Query params: q (query string), page, per_page
    """
    try:
        current_user_id = int(get_jwt_identity())
        query_string = request.args.get('q', '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not query_string:
            return jsonify({'error': 'Search query is required'}), 400
        
        # Tìm kiếm người dùng theo full_name hoặc email (case-insensitive)
        query = User.query.filter(
            User.id != current_user_id,  # Không hiển thị chính mình
            db.or_(
                User.full_name.ilike(f'%{query_string}%'),
                User.email.ilike(f'%{query_string}%')
            )
        ).order_by(User.full_name)
        
        users = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Lấy thông tin trạng thái kết bạn của user hiện tại với từng user được tìm thấy
        from models.friendship import Friendship
        
        users_data = []
        for user in users.items:
            user_dict = user.to_dict(include_sensitive=False)
            
            # Kiểm tra trạng thái kết bạn
            friendship = Friendship.query.filter(
                ((Friendship.user_id == current_user_id) & (Friendship.friend_id == user.id)) |
                ((Friendship.user_id == user.id) & (Friendship.friend_id == current_user_id))
            ).first()
            
            if friendship:
                user_dict['friendship_status'] = friendship.status
                # Kiểm tra xem mình có phải là người gửi lời mời không
                user_dict['is_requester'] = (friendship.requester_id == current_user_id)
            else:
                user_dict['friendship_status'] = None
                user_dict['is_requester'] = False
            
            users_data.append(user_dict)
        
        return jsonify({
            'users': users_data,
            'total': users.total,
            'pages': users.pages,
            'current_page': page,
            'query': query_string
        }), 200
        
    except Exception as e:
        print(f"Error in search_users: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
