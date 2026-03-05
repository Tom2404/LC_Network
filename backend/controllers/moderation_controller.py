from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.moderation_queue import ModerationQueue
from models.post import Post
from models.user import User
from models.appeal import Appeal
from models.violation_history import ViolationHistory
from datetime import datetime, timedelta

moderation_bp = Blueprint('moderation', __name__)

def requires_moderator(f):
    """Decorator to check if user is moderator or admin"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not (user.has_role('moderator') or user.has_role('admin')):
            return jsonify({'error': 'Moderator access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function


@moderation_bp.route('/queue', methods=['GET'])
@jwt_required()
@requires_moderator
def get_moderation_queue():
    """Lấy danh sách bài viết cần kiểm duyệt"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Get pending items ordered by priority
        queue_items = ModerationQueue.query.filter_by(status='pending')\
            .order_by(ModerationQueue.priority.desc(), ModerationQueue.created_at.asc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        items = []
        for item in queue_items.items:
            item_dict = item.to_dict()
            
            # Add target content
            if item.target_type == 'post':
                post = Post.query.get(item.target_id)
                if post:
                    item_dict['content'] = post.to_dict()
            
            items.append(item_dict)
        
        return jsonify({
            'queue': items,
            'total': queue_items.total,
            'pages': queue_items.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/queue/<int:queue_id>/lock', methods=['POST'])
@jwt_required()
@requires_moderator
def lock_queue_item(queue_id):
    """Lock queue item để xử lý (tránh trùng lặp)"""
    try:
        current_user_id = get_jwt_identity()
        
        item = ModerationQueue.query.get(queue_id)
        if not item:
            return jsonify({'error': 'Queue item not found'}), 404
        
        if item.status == 'locked':
            return jsonify({'error': 'Item is already being reviewed by another moderator'}), 409
        
        if item.status == 'completed':
            return jsonify({'error': 'Item has already been reviewed'}), 400
        
        # Lock item
        item.status = 'locked'
        item.assigned_to = current_user_id
        item.locked_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Queue item locked successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/review/<int:post_id>', methods=['POST'])
@jwt_required()
@requires_moderator
def review_post(post_id):
    """
    Kiểm duyệt bài viết
    Body: {decision: 'approve'|'reject'|'flag', reason (optional)}
    """
    try:
        current_user_id = get_jwt_identity()
        
        post = Post.query.get(post_id)
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        data = request.get_json()
        decision = data.get('decision')
        reason = data.get('reason', '')
        
        if decision not in ['approve', 'reject', 'flag']:
            return jsonify({'error': 'Invalid decision'}), 400
        
        # Update post
        post.moderator_id = current_user_id
        post.moderator_decision = decision
        post.moderator_reason = reason
        post.moderated_at = datetime.utcnow()
        
        if decision == 'approve':
            post.status = 'published'
            post.moderation_status = 'moderator_approved'
            post.published_at = datetime.utcnow()
        elif decision == 'reject':
            post.status = 'rejected'
            post.moderation_status = 'moderator_rejected'
        elif decision == 'flag':
            post.status = 'flagged'
        
        # Mark queue item as completed
        queue_item = ModerationQueue.query.filter_by(
            target_type='post',
            target_id=post_id,
            status='locked'
        ).first()
        
        if queue_item:
            queue_item.status = 'completed'
            queue_item.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': f'Post {decision}d successfully',
            'post': post.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/appeals', methods=['GET'])
@jwt_required()
@requires_moderator
def get_appeals():
    """Lấy danh sách kháng nghị"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', 'pending')
        
        appeals = Appeal.query.filter_by(status=status)\
            .order_by(Appeal.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'appeals': [appeal.to_dict() for appeal in appeals.items],
            'total': appeals.total,
            'pages': appeals.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/appeal/<int:appeal_id>/review', methods=['POST'])
@jwt_required()
@requires_moderator
def review_appeal(appeal_id):
    """
    Xử lý kháng nghị
    Body: {decision: 'approve'|'reject', note}
    """
    try:
        current_user_id = get_jwt_identity()
        
        appeal = Appeal.query.get(appeal_id)
        if not appeal:
            return jsonify({'error': 'Appeal not found'}), 404
        
        data = request.get_json()
        decision = data.get('decision')
        
        if decision not in ['approve', 'reject']:
            return jsonify({'error': 'Invalid decision'}), 400
        
        # Update appeal
        appeal.status = 'approved' if decision == 'approve' else 'rejected'
        appeal.reviewed_by = current_user_id
        appeal.moderator_decision = data.get('note', '')
        appeal.reviewed_at = datetime.utcnow()
        
        # If approved, restore post
        if decision == 'approve' and appeal.appeal_type == 'post_rejection':
            post = Post.query.get(appeal.target_id)
            if post:
                post.status = 'published'
                post.published_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': f'Appeal {decision}d successfully',
            'appeal': appeal.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/posts', methods=['GET'])
@jwt_required()
@requires_moderator
def get_all_posts():
    """Lấy tất cả bài viết với filter cho admin"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', None)
        search = request.args.get('search', None)
        
        # Build query
        query = Post.query.filter_by(is_deleted=False)
        
        # Filter by status
        if status:
            query = query.filter_by(status=status)
        
        # Search by caption or username
        if search:
            query = query.join(User).filter(
                db.or_(
                    Post.caption.ilike(f'%{search}%'),
                    User.username.ilike(f'%{search}%')
                )
            )
        
        # Order by created_at desc
        posts = query.order_by(Post.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        items = []
        for post in posts.items:
            post_dict = post.to_dict()
            # Add author info
            author = User.query.get(post.user_id)
            if author:
                post_dict['author'] = {
                    'id': author.id,
                    'username': author.username,
                    'full_name': author.full_name,
                    'avatar_url': author.avatar_url,
                    'account_status': author.account_status,
                    'warning_count': author.warning_count
                }
            items.append(post_dict)
        
        return jsonify({
            'posts': items,
            'total': posts.total,
            'pages': posts.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/posts/<int:post_id>/mute-user', methods=['POST'])
@jwt_required()
@requires_moderator
def mute_user_from_post(post_id):
    """
    Mute user khi phát hiện vi phạm từ bài viết
    Body: {duration_hours: số giờ mute, reason: lý do}
    """
    try:
        current_user_id = get_jwt_identity()
        
        post = Post.query.get(post_id)
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        user = User.query.get(post.user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        duration_hours = data.get('duration_hours', 24)  # Default 24h
        reason = data.get('reason', 'Vi phạm nội dung')
        
        # Cập nhật trạng thái user
        user.account_status = 'banned'
        user.ban_reason = reason
        user.ban_until = datetime.utcnow() + timedelta(hours=duration_hours)
        user.warning_count += 1
        
        # Reject post nếu chưa bị reject
        if post.status not in ['rejected', 'deleted']:
            post.status = 'rejected'
            post.moderator_id = current_user_id
            post.moderator_decision = 'reject'
            post.moderator_reason = reason
            post.moderated_at = datetime.utcnow()
        
        # Thêm vào violation history
        violation = ViolationHistory(
            user_id=user.id,
            violation_type='other',
            severity='moderate',
            post_id=post.id,
            description=reason,
            action_taken='temporary_ban',
            action_by=current_user_id,
            expires_at=datetime.utcnow() + timedelta(hours=duration_hours),
            created_at=datetime.utcnow()
        )
        db.session.add(violation)
        
        db.session.commit()
        
        return jsonify({
            'message': f'User muted for {duration_hours} hours',
            'user': user.to_dict(),
            'ban_until': user.ban_until.isoformat()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/users', methods=['GET'])
@jwt_required()
@requires_moderator
def get_all_users():
    """Lấy danh sách tất cả users cho admin"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', None)
        search = request.args.get('search', None)
        
        # Build query
        query = User.query
        
        # Filter by status
        if status:
            query = query.filter_by(account_status=status)
        
        # Search by username or email
        if search:
            query = query.filter(
                db.or_(
                    User.username.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                    User.full_name.ilike(f'%{search}%')
                )
            )
        
        users = query.order_by(User.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'users': [user.to_dict(include_sensitive=True) for user in users.items],
            'total': users.total,
            'pages': users.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/users/<int:user_id>/ban', methods=['POST'])
@jwt_required()
@requires_moderator
def ban_user(user_id):
    """
    Ban user
    Body: {duration_hours: số giờ (null = permanent), reason: lý do}
    """
    try:
        current_user_id = get_jwt_identity()
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        duration_hours = data.get('duration_hours', None)
        reason = data.get('reason', 'Vi phạm chính sách')
        
        # Cập nhật trạng thái user
        user.account_status = 'banned'
        user.ban_reason = reason
        
        if duration_hours:
            user.ban_until = datetime.utcnow() + timedelta(hours=duration_hours)
            ban_type = 'temporary'
        else:
            user.ban_until = None
            ban_type = 'permanent'
        
        user.warning_count += 1
        
        # Thêm vào violation history
        action_type = 'temporary_ban' if duration_hours else 'permanent_ban'
        violation = ViolationHistory(
            user_id=user.id,
            violation_type='other',
            severity='severe',
            description=f"{ban_type}: {reason}",
            action_taken=action_type,
            action_by=current_user_id,
            expires_at=user.ban_until,
            created_at=datetime.utcnow()
        )
        db.session.add(violation)
        
        db.session.commit()
        
        return jsonify({
            'message': f'User banned ({ban_type})',
            'user': user.to_dict(),
            'ban_until': user.ban_until.isoformat() if user.ban_until else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/users/<int:user_id>/unban', methods=['POST'])
@jwt_required()
@requires_moderator
def unban_user(user_id):
    """Unban user"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user.account_status = 'active'
        user.ban_reason = None
        user.ban_until = None
        
        db.session.commit()
        
        return jsonify({
            'message': 'User unbanned successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

