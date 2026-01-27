from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.friendship import Friendship
from models.user import User

friend_bp = Blueprint('friend', __name__)

@friend_bp.route('/request/<int:friend_id>', methods=['POST'])
@jwt_required()
def send_friend_request(friend_id):
    """Gửi lời mời kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        
        if current_user_id == friend_id:
            return jsonify({'error': 'Cannot send friend request to yourself'}), 400
        
        # Check if friend exists
        friend = User.query.get(friend_id)
        if not friend:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if friendship already exists
        existing = Friendship.query.filter(
            ((Friendship.user_id == current_user_id) & (Friendship.friend_id == friend_id)) |
            ((Friendship.user_id == friend_id) & (Friendship.friend_id == current_user_id))
        ).first()
        
        if existing:
            if existing.status == 'pending':
                return jsonify({'error': 'Friend request already sent'}), 400
            elif existing.status == 'accepted':
                return jsonify({'error': 'Already friends'}), 400
            elif existing.status == 'blocked':
                return jsonify({'error': 'Cannot send friend request'}), 403
        
        # Create friendship (bidirectional)
        friendship1 = Friendship(
            user_id=current_user_id,
            friend_id=friend_id,
            status='pending',
            requester_id=current_user_id
        )
        
        friendship2 = Friendship(
            user_id=friend_id,
            friend_id=current_user_id,
            status='pending',
            requester_id=current_user_id
        )
        
        db.session.add(friendship1)
        db.session.add(friendship2)
        db.session.commit()
        
        return jsonify({'message': 'Friend request sent successfully'}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/request/<int:requester_id>/accept', methods=['POST'])
@jwt_required()
def accept_friend_request(requester_id):
    """Chấp nhận lời mời kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        
        # Find friendship requests
        friendship1 = Friendship.query.filter_by(
            user_id=current_user_id,
            friend_id=requester_id,
            status='pending'
        ).first()
        
        friendship2 = Friendship.query.filter_by(
            user_id=requester_id,
            friend_id=current_user_id,
            status='pending'
        ).first()
        
        if not friendship1 or not friendship2:
            return jsonify({'error': 'Friend request not found'}), 404
        
        # Update status
        friendship1.status = 'accepted'
        friendship2.status = 'accepted'
        
        db.session.commit()
        
        return jsonify({'message': 'Friend request accepted'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/request/<int:requester_id>/reject', methods=['POST'])
@jwt_required()
def reject_friend_request(requester_id):
    """Từ chối lời mời kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        
        # Delete friendship requests
        Friendship.query.filter(
            ((Friendship.user_id == current_user_id) & (Friendship.friend_id == requester_id)) |
            ((Friendship.user_id == requester_id) & (Friendship.friend_id == current_user_id))
        ).delete()
        
        db.session.commit()
        
        return jsonify({'message': 'Friend request rejected'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/', methods=['GET'])
@jwt_required()
def get_friends():
    """Lấy danh sách bạn bè"""
    try:
        current_user_id = get_jwt_identity()
        
        friendships = Friendship.query.filter_by(
            user_id=current_user_id,
            status='accepted'
        ).all()
        
        friends = []
        for friendship in friendships:
            friend = User.query.get(friendship.friend_id)
            if friend:
                friends.append(friend.to_dict(include_sensitive=False))
        
        return jsonify({'friends': friends}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/requests', methods=['GET'])
@jwt_required()
def get_friend_requests():
    """Lấy danh sách lời mời kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        
        # Get requests where I'm the recipient
        friendships = Friendship.query.filter_by(
            user_id=current_user_id,
            status='pending'
        ).filter(Friendship.requester_id != current_user_id).all()
        
        requests = []
        for friendship in friendships:
            requester = User.query.get(friendship.friend_id)
            if requester:
                requests.append({
                    'user': requester.to_dict(include_sensitive=False),
                    'created_at': friendship.created_at.isoformat()
                })
        
        return jsonify({'requests': requests}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/<int:friend_id>', methods=['DELETE'])
@jwt_required()
def unfriend(friend_id):
    """Hủy kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        
        # Delete both friendship records
        Friendship.query.filter(
            ((Friendship.user_id == current_user_id) & (Friendship.friend_id == friend_id)) |
            ((Friendship.user_id == friend_id) & (Friendship.friend_id == current_user_id))
        ).delete()
        
        db.session.commit()
        
        return jsonify({'message': 'Unfriended successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
