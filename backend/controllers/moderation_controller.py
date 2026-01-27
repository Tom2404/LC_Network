from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.moderation_queue import ModerationQueue
from models.post import Post
from models.user import User
from models.appeal import Appeal
from datetime import datetime

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
