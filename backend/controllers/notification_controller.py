from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.notification import Notification
from models.user import User
from models.post import Post
from datetime import datetime

notification_bp = Blueprint('notification', __name__)

@notification_bp.route('', methods=['GET'])
@notification_bp.route('/', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get user notifications"""
    try:
        current_user_id = int(get_jwt_identity())
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        category = request.args.get('category', None)  # account, post, or None for all
        
        # Keep category filtering in sync with Notification model constants
        account_types = Notification.ACCOUNT_TYPES
        post_types = Notification.POST_TYPES
        
        # Base query
        query = Notification.query.filter_by(user_id=current_user_id)
        
        # Filter by category
        if category == 'account':
            query = query.filter(Notification.type.in_(account_types))
        elif category == 'post':
            query = query.filter(Notification.type.in_(post_types))
        
        # Order by newest first
        query = query.order_by(Notification.created_at.desc())
        
        # Paginate
        notifications = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Enrich notifications with actor info
        notification_list = []
        for notif in notifications.items:
            notif_dict = notif.to_dict()
            
            # Add actor info if actor_id exists
            if notif.actor_id:
                actor = User.query.get(notif.actor_id)
                if actor:
                    notif_dict['actor'] = {
                        'id': actor.id,
                        'full_name': actor.full_name,
                        'avatar_url': actor.avatar_url
                    }
            # Fallback: For friend requests, try getting actor from related_id
            elif notif.type in ['friend_request', 'friend_accept']:
                if notif.related_type == 'user' and notif.related_id:
                    actor = User.query.get(notif.related_id)
                    if actor:
                        notif_dict['actor'] = {
                            'id': actor.id,
                            'full_name': actor.full_name,
                            'avatar_url': actor.avatar_url
                        }
            
            # For post-related notifications, add post_id for frontend navigation
            if notif.type in ['like', 'comment', 'reply', 'share']:
                if notif.related_type == 'post':
                    # related_id is the post_id
                    notif_dict['post_id'] = notif.related_id
                    post = Post.query.get(notif.related_id)
                    if post:
                        notif_dict['post'] = {
                            'id': post.id,
                            'caption': post.caption[:100] if post.caption else None
                        }
                elif notif.related_type == 'comment':
                    # related_id is the comment_id, need to get post_id from comment
                    from models.comment import Comment
                    comment = Comment.query.get(notif.related_id)
                    if comment:
                        notif_dict['post_id'] = comment.post_id
                        post = Post.query.get(comment.post_id)
                        if post:
                            notif_dict['post'] = {
                                'id': post.id,
                                'caption': post.caption[:100] if post.caption else None
                            }
            
            notification_list.append(notif_dict)
        
        return jsonify({
            'notifications': notification_list,
            'total': notifications.total,
            'pages': notifications.pages,
            'current_page': page,
            'unread_count': Notification.query.filter_by(
                user_id=current_user_id, 
                is_read=False
            ).count()
        }), 200
        
    except Exception as e:
        print(f"Error in get_notifications: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@notification_bp.route('/<int:notification_id>/read', methods=['POST'])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a notification as read"""
    try:
        current_user_id = int(get_jwt_identity())
        
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        if notification.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        notification.is_read = True
        db.session.commit()
        
        return jsonify({'message': 'Marked as read'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@notification_bp.route('/mark-all-read', methods=['POST'])
@jwt_required()
def mark_all_as_read():
    """Mark all notifications as read"""
    try:
        current_user_id = int(get_jwt_identity())
        
        Notification.query.filter_by(
            user_id=current_user_id,
            is_read=False
        ).update({'is_read': True})
        
        db.session.commit()
        
        return jsonify({'message': 'All notifications marked as read'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def create_notification(user_id, notification_type, title, message, related_id=None, related_type=None, actor_id=None):
    """Helper function to create a notification"""
    try:
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            related_id=related_id,
            related_type=related_type,
            actor_id=actor_id
        )
        db.session.add(notification)
        db.session.commit()
        return notification
    except Exception as e:
        db.session.rollback()
        print(f"Error creating notification: {str(e)}")
        return None
