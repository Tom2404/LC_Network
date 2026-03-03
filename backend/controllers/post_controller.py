from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.post import Post
from models.post_media import PostMedia
from models.user import User
from models.like import Like
from utils.file_upload import upload_file, allowed_file
from datetime import datetime
from controllers.notification_controller import create_notification

post_bp = Blueprint('post', __name__)

@post_bp.route('/', methods=['POST'])
@jwt_required()
def create_post():
    """
    Tạo bài viết mới
    Body: {caption, visibility, media: [{type, url}]}
    Status: Pending (chờ AI kiểm duyệt)
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active():
            return jsonify({'error': 'Account is restricted'}), 403
        
        data = request.get_json()
        
        # Create post
        new_post = Post(
            user_id=current_user_id,
            caption=data.get('caption'),
            content_type='text',  # Will update based on media
            visibility=data.get('visibility', 'public'),
            status='pending'  # Chờ kiểm duyệt
        )
        
        db.session.add(new_post)
        db.session.flush()  # Get post ID
        
        # Handle media
        if 'media' in data and data['media']:
            for idx, media_data in enumerate(data['media']):
                media = PostMedia(
                    post_id=new_post.id,
                    media_type=media_data['type'],
                    media_url=media_data['url'],
                    thumbnail_url=media_data.get('thumbnail_url'),
                    display_order=idx
                )
                db.session.add(media)
            
            # Update content type
            if len(data['media']) == 1:
                new_post.content_type = data['media'][0]['type']
            else:
                new_post.content_type = 'mixed'
        
        db.session.commit()
        
        # TODO: Trigger AI moderation (Phase 5)
        # For now, auto-publish for development
        new_post.status = 'published'
        new_post.published_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Post created successfully.',
            'post': new_post.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@post_bp.route('/upload-media', methods=['POST'])
@jwt_required()
def upload_media():
    """Upload ảnh/video cho bài viết"""
    try:
        print(f"=== Upload Media Request ===")
        print(f"Request files: {request.files}")
        print(f"Request form: {request.form}")
        
        if 'file' not in request.files:
            print("No 'file' in request.files")
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        media_type = request.form.get('type', 'image')  # 'image' or 'video'
        
        print(f"File: {file.filename}, Type: {media_type}")
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, media_type):
            return jsonify({'error': f'Invalid file type for {media_type}'}), 400
        
        # Upload file
        folder = 'posts/images' if media_type == 'image' else 'posts/videos'
        file_url = upload_file(file, folder=folder)
        
        print(f"File uploaded successfully: {file_url}")
        
        return jsonify({
            'message': 'File uploaded successfully',
            'url': file_url,
            'type': media_type
        }), 200
        
    except Exception as e:
        print(f"Error in upload_media: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@post_bp.route('/', methods=['GET'])
@jwt_required()
def get_posts():
    """
    Lấy danh sách bài viết (Newsfeed)
    Query params: page, per_page, status
    Hiển thị: 
    - Bài viết của bản thân
    - Bài viết của những người đã kết bạn với nhau (accepted)
    - Bài viết của những người mà mình đã gửi lời mời kết bạn (pending, mình là requester)
    """
    try:
        from models.friendship import Friendship
        
        current_user_id = int(get_jwt_identity())
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        # Lấy danh sách user_id có thể xem bài viết
        visible_user_ids = [current_user_id]  # Luôn thấy bài viết của chính mình
        
        # 1. Lấy những người đã kết bạn (status='accepted')
        accepted_friends = Friendship.query.filter_by(
            user_id=current_user_id,
            status='accepted'
        ).all()
        for f in accepted_friends:
            visible_user_ids.append(f.friend_id)
        
        # 2. Lấy những người mà mình đã gửi lời mời kết bạn (status='pending', mình là requester)
        pending_requests = Friendship.query.filter_by(
            user_id=current_user_id,
            status='pending'
        ).filter(Friendship.requester_id == current_user_id).all()
        for f in pending_requests:
            visible_user_ids.append(f.friend_id)
        
        # Query bài viết
        query = Post.query.filter(
            Post.is_deleted == False,
            Post.visibility == 'public',
            Post.user_id.in_(visible_user_ids)
        )
        
        # Filter by status if provided
        if status:
            query = query.filter_by(status=status)
        else:
            # Default: only show published posts
            query = query.filter_by(status='published')
        
        # Order by newest first
        query = query.order_by(Post.created_at.desc())
        
        posts = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Get list of post IDs that current user has liked
        liked_post_ids = set(
            like.target_id for like in Like.query.filter_by(
                user_id=current_user_id,
                target_type='post'
            ).all()
        )
        
        # Add is_liked field to each post
        posts_data = []
        for post in posts.items:
            post_dict = post.to_dict()
            post_dict['is_liked'] = post.id in liked_post_ids
            posts_data.append(post_dict)
        
        return jsonify({
            'posts': posts_data,
            'total': posts.total,
            'pages': posts.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        print(f"Error in get_posts: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@post_bp.route('/my-posts', methods=['GET'])
@jwt_required()
def get_my_posts():
    """
    Lấy bài viết của chính mình (tất cả trạng thái)
    Query params: page, per_page, status
    """
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = Post.query.filter_by(user_id=current_user_id, is_deleted=False)
        
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(Post.created_at.desc())
        posts = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'posts': [post.to_dict() for post in posts.items],
            'total': posts.total,
            'pages': posts.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@post_bp.route('/user/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_posts(user_id):
    """
    Lấy bài viết của user khác (xem qua trang cá nhân)
    Query params: page, per_page
    Tất cả user đều có thể xem, không phụ thuộc vào trạng thái kết bạn
    """
    try:
        current_user_id = int(get_jwt_identity())
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Kiểm tra user có tồn tại không
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Lấy bài viết public đã published của user
        query = Post.query.filter_by(
            user_id=user_id,
            is_deleted=False,
            visibility='public',
            status='published'
        ).order_by(Post.created_at.desc())
        
        posts = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Get list of post IDs that current user has liked
        liked_post_ids = set(
            like.target_id for like in Like.query.filter_by(
                user_id=current_user_id,
                target_type='post'
            ).all()
        )
        
        # Add is_liked field to each post
        posts_data = []
        for post in posts.items:
            post_dict = post.to_dict()
            post_dict['is_liked'] = post.id in liked_post_ids
            posts_data.append(post_dict)
        
        return jsonify({
            'posts': posts_data,
            'total': posts.total,
            'pages': posts.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        print(f"Error in get_user_posts: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



@post_bp.route('/<int:post_id>', methods=['GET'])
@jwt_required()
def get_post(post_id):
    """Xem chi tiết bài viết"""
    try:
        post = Post.query.get(post_id)
        
        if not post or post.is_deleted:
            return jsonify({'error': 'Post not found'}), 404
        
        return jsonify({'post': post.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@post_bp.route('/<int:post_id>', methods=['PUT'])
@jwt_required()
def update_post(post_id):
    """
    Chỉnh sửa bài viết
    Note: Sẽ trigger lại AI moderation
    """
    try:
        current_user_id = get_jwt_identity()
        post = Post.query.get(post_id)
        
        if not post or post.is_deleted:
            return jsonify({'error': 'Post not found'}), 404
        
        if post.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        
        # Update fields
        if 'caption' in data:
            post.caption = data['caption']
        
        if 'visibility' in data:
            post.visibility = data['visibility']
        
        # Reset moderation status (re-check needed)
        post.status = 'pending'
        post.moderation_status = 'not_checked'
        post.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # TODO: Trigger AI moderation again (Phase 5)
        
        return jsonify({
            'message': 'Post updated successfully. Pending re-moderation.',
            'post': post.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@post_bp.route('/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_post(post_id):
    """Xóa bài viết (soft delete)"""
    try:
        current_user_id = get_jwt_identity()
        post = Post.query.get(post_id)
        
        if not post or post.is_deleted:
            return jsonify({'error': 'Post not found'}), 404
        
        if post.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Soft delete
        post.mark_for_deletion(retention_days=30)
        db.session.commit()
        
        return jsonify({'message': 'Post deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@post_bp.route('/<int:post_id>/like', methods=['POST'])
@jwt_required()
def toggle_like(post_id):
    """Toggle like on a post (like if not liked, unlike if already liked)"""
    try:
        current_user_id = int(get_jwt_identity())
        print(f"[LIKE] User {current_user_id} toggling like on post {post_id}")
        
        # Check if post exists
        post = Post.query.get(post_id)
        if not post or post.is_deleted:
            return jsonify({'error': 'Post not found'}), 404
        
        # Check if user already liked this post
        existing_like = Like.query.filter_by(
            user_id=current_user_id,
            target_type='post',
            target_id=post_id
        ).first()
        
        if existing_like:
            # Unlike: Remove the like
            print(f"[LIKE] Removing like from post {post_id}")
            db.session.delete(existing_like)
            post.like_count = max(0, post.like_count - 1)  # Ensure not negative
            is_liked = False
        else:
            # Like: Add a new like
            print(f"[LIKE] Adding like to post {post_id}")
            new_like = Like(
                user_id=current_user_id,
                target_type='post',
                target_id=post_id
            )
            db.session.add(new_like)
            post.like_count = post.like_count + 1
            is_liked = True
            
            # Create notification for post author (if not liking own post)
            if post.user_id != current_user_id:
                liker = User.query.get(current_user_id)
                if liker:
                    create_notification(
                        user_id=post.user_id,
                        notification_type='like',
                        title='Lượt thích mới',
                        message=f'{liker.full_name} đã thích bài viết của bạn',
                        related_id=post_id,  # Post ID for navigation
                        related_type='post',
                        actor_id=current_user_id
                    )
        
        db.session.commit()
        
        print(f"[LIKE] Success! Post {post_id} now has {post.like_count} likes. User liked: {is_liked}")
        
        return jsonify({
            'message': 'Like toggled successfully',
            'is_liked': is_liked,
            'like_count': post.like_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[LIKE] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@post_bp.route('/search', methods=['GET'])
@jwt_required()
def search_posts():
    """
    Tìm kiếm bài viết theo caption
    Query params: q (query string), page, per_page
    """
    try:
        from models.friendship import Friendship
        
        current_user_id = int(get_jwt_identity())
        query_string = request.args.get('q', '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not query_string:
            return jsonify({'error': 'Search query is required'}), 400
        
        # Lấy danh sách user_id có thể xem bài viết (giống logic get_posts)
        visible_user_ids = [current_user_id]
        
        # Lấy những người đã kết bạn
        accepted_friends = Friendship.query.filter_by(
            user_id=current_user_id,
            status='accepted'
        ).all()
        for f in accepted_friends:
            visible_user_ids.append(f.friend_id)
        
        # Lấy những người mà mình đã gửi lời mời kết bạn
        pending_requests = Friendship.query.filter_by(
            user_id=current_user_id,
            status='pending'
        ).filter(Friendship.requester_id == current_user_id).all()
        for f in pending_requests:
            visible_user_ids.append(f.friend_id)
        
        # Tìm kiếm bài viết có caption chứa query_string
        query = Post.query.filter(
            Post.is_deleted == False,
            Post.visibility == 'public',
            Post.status == 'published',
            Post.user_id.in_(visible_user_ids),
            Post.caption.ilike(f'%{query_string}%')  # Case-insensitive search
        ).order_by(Post.created_at.desc())
        
        posts = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Get list of post IDs that current user has liked
        liked_post_ids = set(
            like.target_id for like in Like.query.filter_by(
                user_id=current_user_id,
                target_type='post'
            ).all()
        )
        
        # Add is_liked field to each post
        posts_data = []
        for post in posts.items:
            post_dict = post.to_dict()
            post_dict['is_liked'] = post.id in liked_post_ids
            posts_data.append(post_dict)
        
        return jsonify({
            'posts': posts_data,
            'total': posts.total,
            'pages': posts.pages,
            'current_page': page,
            'query': query_string
        }), 200
        
    except Exception as e:
        print(f"Error in search_posts: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
