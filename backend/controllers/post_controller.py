from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.post import Post
from models.post_media import PostMedia
from models.user import User
from utils.file_upload import upload_file, allowed_file
from datetime import datetime

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
        current_user_id = get_jwt_identity()
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
        # For now, auto-publish (will be removed in Phase 5)
        # new_post.status = 'published'
        # new_post.published_at = datetime.utcnow()
        # db.session.commit()
        
        return jsonify({
            'message': 'Post created successfully. Pending moderation.',
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
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        media_type = request.form.get('type', 'image')  # 'image' or 'video'
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, media_type):
            return jsonify({'error': f'Invalid file type for {media_type}'}), 400
        
        # Upload file
        folder = 'posts/images' if media_type == 'image' else 'posts/videos'
        file_url = upload_file(file, folder=folder)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'url': file_url,
            'type': media_type
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@post_bp.route('/', methods=['GET'])
@jwt_required()
def get_posts():
    """
    Lấy danh sách bài viết (Newsfeed)
    Query params: page, per_page, status
    """
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = Post.query.filter(Post.is_deleted == False)
        
        # Filter by status if provided
        if status:
            query = query.filter_by(status=status)
        else:
            # Default: only show published posts
            query = query.filter_by(status='published')
        
        # Order by newest first
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
