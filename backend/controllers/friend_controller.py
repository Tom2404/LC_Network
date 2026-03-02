from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
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
        print(f"[DEBUG] send_friend_request: current_user={current_user_id}, target_user={friend_id}")
        
        if current_user_id == friend_id:
            return jsonify({'error': 'Cannot send friend request to yourself'}), 400
        
        # Check if friend exists
        friend = User.query.get(friend_id)
        if not friend:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if friendship already exists (check both directions explicitly)
        existing_forward = Friendship.query.filter_by(
            user_id=current_user_id,
            friend_id=friend_id
        ).first()
        
        existing_backward = Friendship.query.filter_by(
            user_id=friend_id,
            friend_id=current_user_id
        ).first()
        
        # If any record exists, check status
        if existing_forward or existing_backward:
            existing = existing_forward or existing_backward
            print(f"[DEBUG] Existing friendship found: status={existing.status}, requester={existing.requester_id}")
            
            if existing.status == 'pending':
                return jsonify({'error': 'Friend request already exists'}), 400
            elif existing.status == 'accepted':
                return jsonify({'error': 'Already friends'}), 400
            elif existing.status == 'blocked':
                return jsonify({'error': 'Cannot send friend request'}), 403
        
        # Create bidirectional friendship records
        friendship1 = Friendship(
            user_id=current_user_id,
            friend_id=friend_id,
            status='pending',
            requester_id=current_user_id  # Current user is the requester
        )
        
        friendship2 = Friendship(
            user_id=friend_id,
            friend_id=current_user_id,
            status='pending',
            requester_id=current_user_id  # Still mark current user as requester
        )
        
        db.session.add(friendship1)
        db.session.add(friendship2)
        db.session.commit()
        
        print(f"[DEBUG] Friend request created successfully: {current_user_id} -> {friend_id}")
        return jsonify({'message': 'Friend request sent successfully'}), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] send_friend_request failed: {str(e)}")
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/request/<int:other_user_id>/accept', methods=['POST'])
@jwt_required()
def accept_friend_request(other_user_id):
    """Chấp nhận lời mời kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        print(f"[DEBUG] accept_friend_request: current_user={current_user_id}, other_user={other_user_id}")
        
        # Find friendship records
        friendship1 = Friendship.query.filter_by(
            user_id=current_user_id,
            friend_id=other_user_id,
            status='pending'
        ).first()
        
        friendship2 = Friendship.query.filter_by(
            user_id=other_user_id,
            friend_id=current_user_id,
            status='pending'
        ).first()
        
        if not friendship1 or not friendship2:
            print(f"[ERROR] Friend request not found: f1={friendship1}, f2={friendship2}")
            return jsonify({'error': 'Friend request not found'}), 404
        
        # Validate: current user should NOT be the requester (they should be the receiver)
        if friendship1.requester_id == current_user_id:
            print(f"[ERROR] Cannot accept own request: requester={friendship1.requester_id}")
            return jsonify({'error': 'Cannot accept your own friend request'}), 400
        
        # Update status to accepted
        friendship1.status = 'accepted'
        friendship2.status = 'accepted'
        friendship1.updated_at = datetime.utcnow()
        friendship2.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        print(f"[DEBUG] Friend request accepted: {other_user_id} <-> {current_user_id}")
        return jsonify({'message': 'Friend request accepted'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] accept_friend_request failed: {str(e)}")
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/request/<int:other_user_id>/reject', methods=['POST'])
@jwt_required()
def reject_friend_request(other_user_id):
    """Từ chối lời mời kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        print(f"[DEBUG] reject_friend_request: current_user={current_user_id}, other_user={other_user_id}")
        
        # Check if request exists and current user is the receiver
        friendship = Friendship.query.filter_by(
            user_id=current_user_id,
            friend_id=other_user_id,
            status='pending'
        ).first()
        
        if friendship and friendship.requester_id == current_user_id:
            print(f"[ERROR] Cannot reject own request")
            return jsonify({'error': 'Cannot reject your own friend request'}), 400
        
        # Delete both friendship records
        deleted = Friendship.query.filter(
            ((Friendship.user_id == current_user_id) & (Friendship.friend_id == other_user_id)) |
            ((Friendship.user_id == other_user_id) & (Friendship.friend_id == current_user_id))
        ).delete(synchronize_session=False)
        
        db.session.commit()
        
        print(f"[DEBUG] Friend request rejected: deleted {deleted} records")
        return jsonify({'message': 'Friend request rejected'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] reject_friend_request failed: {str(e)}")
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


@friend_bp.route('/status/<int:friend_id>', methods=['GET'])
@jwt_required()
def get_friendship_status(friend_id):
    """Kiểm tra trạng thái bạn bè với người dùng"""
    try:
        current_user_id = int(get_jwt_identity())
        friend_id = int(friend_id)
        
        print(f"\n{'='*60}")
        print(f"[DEBUG] GET FRIENDSHIP STATUS")
        print(f"[DEBUG] Current User ID: {current_user_id} (logged in)")
        print(f"[DEBUG] Target Friend ID: {friend_id} (checking status with)")
        print(f"{'='*60}")
        
        if current_user_id == friend_id:
            print(f"[DEBUG] Result: SELF (same user)")
            return jsonify({'status': 'self'}), 200
        
        # Check if friendship exists (always check from current user's perspective)
        friendship = Friendship.query.filter_by(
            user_id=current_user_id,
            friend_id=friend_id
        ).first()
        
        if not friendship:
            print(f"[DEBUG] Result: NONE (no friendship record found)")
            return jsonify({'status': 'none'}), 200
        
        # Log detailed friendship info
        print(f"[DEBUG] Friendship Record Found:")
        print(f"  - ID: {friendship.id}")
        print(f"  - user_id: {friendship.user_id}")
        print(f"  - friend_id: {friendship.friend_id}")
        print(f"  - status: {friendship.status}")
        print(f"  - requester_id: {friendship.requester_id}")
        print(f"  - created_at: {friendship.created_at}")
        
        if friendship.status == 'accepted':
            print(f"[DEBUG] Result: ACCEPTED (already friends)")
            return jsonify({'status': 'accepted'}), 200
        elif friendship.status == 'pending':
            # CRITICAL: Check who sent the request
            # If current user is the requester -> they sent the request -> pending_sent
            # If current user is NOT the requester -> they received the request -> pending_received
            print(f"[DEBUG] Status is PENDING - checking requester...")
            print(f"  - requester_id: {friendship.requester_id}")
            print(f"  - current_user_id: {current_user_id}")
            print(f"  - Match: {friendship.requester_id == current_user_id}")
            
            if friendship.requester_id == current_user_id:
                print(f"[DEBUG] Result: PENDING_SENT (current user sent the request)")
                print(f"[DEBUG] → User {current_user_id} should see: 'Hủy lời mời' button")
                return jsonify({'status': 'pending_sent', 'requester_id': friendship.requester_id}), 200
            else:
                print(f"[DEBUG] Result: PENDING_RECEIVED (current user received the request)")
                print(f"[DEBUG] → User {current_user_id} should see: 'Chấp nhận' + 'Từ chối' buttons")
                return jsonify({'status': 'pending_received', 'requester_id': friendship.requester_id}), 200
        elif friendship.status == 'blocked':
            print(f"[DEBUG] Result: BLOCKED")
            return jsonify({'status': 'blocked'}), 200
        
        print(f"[DEBUG] Result: NONE (fallback)")
        return jsonify({'status': 'none'}), 200
        
    except Exception as e:
        print(f"[ERROR] Status check failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/request/<int:friend_id>', methods=['DELETE'])
@jwt_required()
def cancel_friend_request(friend_id):
    """Hủy lời mời kết bạn đã gửi"""
    try:
        current_user_id = get_jwt_identity()
        print(f"[DEBUG] cancel_friend_request: current_user={current_user_id}, target={friend_id}")
        
        # Verify that current user is the requester
        friendship = Friendship.query.filter_by(
            user_id=current_user_id,
            friend_id=friend_id,
            status='pending'
        ).first()
        
        if not friendship:
            print(f"[ERROR] Friend request not found")
            return jsonify({'error': 'Friend request not found'}), 404
        
        if friendship.requester_id != current_user_id:
            print(f"[ERROR] Cannot cancel request: not the requester")
            return jsonify({'error': 'You can only cancel requests you sent'}), 403
        
        # Delete both bidirectional records
        deleted = Friendship.query.filter(
            ((Friendship.user_id == current_user_id) & (Friendship.friend_id == friend_id)) |
            ((Friendship.user_id == friend_id) & (Friendship.friend_id == current_user_id))
        ).delete(synchronize_session=False)
        
        db.session.commit()
        
        print(f"[DEBUG] Friend request canceled: deleted {deleted} records")
        return jsonify({'message': 'Friend request canceled successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] cancel_friend_request failed: {str(e)}")
        return jsonify({'error': str(e)}), 500


@friend_bp.route('/<int:friend_id>', methods=['DELETE'])
@jwt_required()
def unfriend(friend_id):
    """Hủy kết bạn"""
    try:
        current_user_id = get_jwt_identity()
        print(f"[DEBUG] unfriend: current_user={current_user_id}, friend={friend_id}")
        
        # Verify friendship exists and is accepted
        friendship = Friendship.query.filter_by(
            user_id=current_user_id,
            friend_id=friend_id,
            status='accepted'
        ).first()
        
        if not friendship:
            print(f"[ERROR] Friendship not found or not accepted")
            return jsonify({'error': 'Friendship not found'}), 404
        
        # Delete both bidirectional records
        deleted = Friendship.query.filter(
            ((Friendship.user_id == current_user_id) & (Friendship.friend_id == friend_id)) |
            ((Friendship.user_id == friend_id) & (Friendship.friend_id == current_user_id))
        ).delete(synchronize_session=False)
        
        db.session.commit()
        
        print(f"[DEBUG] Unfriended successfully: deleted {deleted} records")
        return jsonify({'message': 'Unfriended successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] unfriend failed: {str(e)}")
        return jsonify({'error': str(e)}), 500
