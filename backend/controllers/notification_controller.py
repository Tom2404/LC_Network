from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.notification import Notification
from models.user import User
from models.post import Post
from datetime import datetime

notification_bp = Blueprint('notification', __name__)

@notification_bp.route('/', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get user notifications"""
    try:
        current_user_id = int(get_jwt_identity())
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        filter_type = request.args.get('filter', 'all')  # all, unread
        
        # Base query
        query = Notification.query.filter_by(user_id=current_user_id)
        
        # Filter by read status
        if filter_type == 'unread':
            query = query.filter_by(is_read=False)
        
        # Order by newest first
        query = query.order_by(Notification.created_at.desc())
        
        # Paginate
        notifications = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Enrich notifications with actor info
        notification_list = []
        for notif in notifications.items:
            notif_dict = notif.to_dict()
            
            # Get actor info (user who triggered the notification)
            if notif.related_type in ['like', 'comment', 'share', 'friend_request']:
                # related_id is the actor's user_id for these types
                actor = User.query.get(notif.related_id)
                if actor:
                    notif_dict['actor'] = {
                        'id': actor.id,
                        'full_name': actor.full_name,
                        'avatar_url': actor.avatar_url
                    }
            
            # Get post info if applicable
            if notif.related_type == 'post':
                post = Post.query.get(notif.related_id)
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


def create_notification(user_id, notification_type, title, message, related_id=None, related_type=None):
    """Helper function to create a notification"""
    try:
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            related_id=related_id,
            related_type=related_type
        )
        db.session.add(notification)
        db.session.commit()
        return notification
    except Exception as e:
        db.session.rollback()
        print(f"Error creating notification: {str(e)}")
        return None
