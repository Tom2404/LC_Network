from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.comment import Comment, get_vietnam_time
from models.post import Post
from models.user import User
from models.like import Like
from datetime import datetime, timezone, timedelta
import os
from werkzeug.utils import secure_filename
from PIL import Image

comment_bp = Blueprint('comment', __name__)

@comment_bp.route('/posts/<int:post_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(post_id):
    """
    Tạo comment cho bài viết
    Body: {content, media_url (optional), media_type (optional), parent_comment_id (optional)}
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active():
            return jsonify({'error': 'Account is restricted'}), 403
        
        post = Post.query.get(post_id)
        if not post or post.is_deleted or post.status != 'published':
            return jsonify({'error': 'Post not found'}), 404
        
        data = request.get_json()
        
        if not data.get('content'):
            return jsonify({'error': 'Content is required'}), 400
        
        # TODO: AI moderation for comment (Phase 5)
        # Check for banned keywords in real-time
        
        new_comment = Comment(
            post_id=post_id,
            user_id=current_user_id,
            parent_comment_id=data.get('parent_comment_id'),
            content=data['content'],
            media_url=data.get('media_url'),
            media_type=data.get('media_type')
        )
        
        db.session.add(new_comment)
        
        # Update post comment count
        post.comment_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': 'Comment added successfully',
            'comment': new_comment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@comment_bp.route('/posts/<int:post_id>/comments', methods=['GET'])
@jwt_required()
def get_comments(post_id):
    """Lấy danh sách comment của bài viết"""
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        post = Post.query.get(post_id)
        if not post or post.is_deleted:
            return jsonify({'error': 'Post not found'}), 404
        
        # Get root comments (parent_comment_id is NULL)
        comments = Comment.query.filter_by(post_id=post_id, parent_comment_id=None, is_blocked=False)\
            .order_by(Comment.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        # Get user's likes for these comments
        comment_ids = [c.id for c in comments.items]
        user_likes = set()
        if comment_ids:
            likes = Like.query.filter(
                Like.user_id == current_user_id,
                Like.target_type == 'comment',
                Like.target_id.in_(comment_ids)
            ).all()
            user_likes = {like.target_id for like in likes}
        
        # Add is_liked to each comment
        comments_data = []
        for comment in comments.items:
            comment_dict = comment.to_dict(include_replies=True)
            comment_dict['is_liked'] = comment.id in user_likes
            comments_data.append(comment_dict)
        
        return jsonify({
            'comments': comments_data,
            'total': comments.total,
            'pages': comments.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@comment_bp.route('/posts/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    """Xóa comment - Chỉ người viết comment hoặc chủ bài viết mới được xóa"""
    try:
        current_user_id = get_jwt_identity()
        comment = Comment.query.get(comment_id)
        
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        
        # Get post to check ownership
        post = Post.query.get(comment.post_id)
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        # Allow deletion if user is comment author OR post owner
        if comment.user_id != current_user_id and post.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized. Only comment author or post owner can delete'}), 403
        
        # Update post comment count
        post.comment_count -= 1
        
        db.session.delete(comment)
        db.session.commit()
        
        return jsonify({'message': 'Comment deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@comment_bp.route('/posts/comments/<int:comment_id>', methods=['PUT'])
@jwt_required()
def edit_comment(comment_id):
    """Chỉnh sửa comment - Chỉ người viết comment mới được sửa"""
    try:
        current_user_id = get_jwt_identity()
        comment = Comment.query.get(comment_id)
        
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        
        # Only comment author can edit
        if comment.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized. Only comment author can edit'}), 403
        
        data = request.get_json()
        
        # Update content if provided
        if 'content' in data:
            if not data['content'].strip():
                return jsonify({'error': 'Content cannot be empty'}), 400
            comment.content = data['content']
        
        # Update media if provided (can remove by setting to null)
        if 'media_url' in data:
            comment.media_url = data['media_url']
        
        if 'media_type' in data:
            comment.media_type = data['media_type']
        
        comment.updated_at = get_vietnam_time()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Comment updated successfully',
            'comment': comment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@comment_bp.route('/posts/comments/upload-media', methods=['POST'])
@jwt_required()
def upload_comment_media():
    """Upload media (image/video) for comment"""
    try:
        print("=== UPLOAD MEDIA DEBUG ===")
        print(f"Files: {request.files}")
        print(f"Form: {request.form}")
        
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active():
            return jsonify({'error': 'Account is restricted'}), 403
        
        if 'file' not in request.files:
            print("ERROR: No file in request.files")
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        media_type = request.form.get('type', 'image')
        print(f"File: {file.filename}, Type: {media_type}")
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_image_extensions = {'png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp'}
        allowed_video_extensions = {'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'}
        
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        if media_type == 'image':
            if file_ext not in allowed_image_extensions:
                return jsonify({'error': 'Invalid image format'}), 400
            max_size = 5 * 1024 * 1024  # 5MB
        elif media_type == 'video':
            if file_ext not in allowed_video_extensions:
                return jsonify({'error': 'Invalid video format'}), 400
            max_size = 50 * 1024 * 1024  # 50MB
        else:
            return jsonify({'error': 'Invalid media type'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > max_size:
            return jsonify({'error': f'File too large. Maximum size: {max_size // (1024*1024)}MB'}), 400
        
        # Create upload directory
        upload_folder = os.path.join('uploads', 'comments', media_type + 's')
        os.makedirs(upload_folder, exist_ok=True)
        
        # Generate unique filename
        timestamp = get_vietnam_time().strftime('%Y%m%d_%H%M%S')
        filename = f"{current_user_id}_{timestamp}_{secure_filename(file.filename)}"
        filepath = os.path.join(upload_folder, filename)
        
        # Save file
        if media_type == 'image':
            # Optimize image
            image = Image.open(file)
            
            # Convert RGBA to RGB if necessary
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize if too large
            max_dimension = 1920
            if image.width > max_dimension or image.height > max_dimension:
                image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            
            # Save optimized image
            image.save(filepath, 'JPEG', quality=85, optimize=True)
        else:
            # Save video directly
            file.save(filepath)
        
        # Return URL
        url = f'/uploads/comments/{media_type}s/{filename}'
        
        return jsonify({
            'url': url,
            'type': media_type
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@comment_bp.route('/posts/comments/<int:comment_id>/like', methods=['POST'])
@jwt_required()
def like_comment(comment_id):
    """Like/Unlike a comment"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active():
            return jsonify({'error': 'Account is restricted'}), 403
        
        comment = Comment.query.get(comment_id)
        if not comment or comment.is_blocked:
            return jsonify({'error': 'Comment not found'}), 404
        
        # Check if already liked
        existing_like = Like.query.filter_by(
            user_id=current_user_id,
            target_type='comment',
            target_id=comment_id
        ).first()
        
        if existing_like:
            # Unlike
            db.session.delete(existing_like)
            comment.like_count = max(0, comment.like_count - 1)
            action = 'unliked'
        else:
            # Like
            new_like = Like(
                user_id=current_user_id,
                target_type='comment',
                target_id=comment_id
            )
            db.session.add(new_like)
            comment.like_count += 1
            action = 'liked'
        
        db.session.commit()
        
        return jsonify({
            'message': f'Comment {action}',
            'like_count': comment.like_count,
            'is_liked': action == 'liked'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@comment_bp.route('/posts/comments/<int:comment_id>/replies', methods=['GET'])
@jwt_required()
def get_comment_replies(comment_id):
    """Get all replies for a comment"""
    try:
        current_user_id = get_jwt_identity()
        
        comment = Comment.query.get(comment_id)
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        
        # Get all replies
        replies = Comment.query.filter_by(
            parent_comment_id=comment_id,
            is_blocked=False
        ).order_by(Comment.created_at.asc()).all()
        
        # Get user's likes for these replies
        reply_ids = [r.id for r in replies]
        user_likes = set()
        if reply_ids:
            likes = Like.query.filter(
                Like.user_id == current_user_id,
                Like.target_type == 'comment',
                Like.target_id.in_(reply_ids)
            ).all()
            user_likes = {like.target_id for like in likes}
        
        replies_data = []
        for reply in replies:
            reply_dict = reply.to_dict()
            reply_dict['is_liked'] = reply.id in user_likes
            replies_data.append(reply_dict)
        
        return jsonify({
            'replies': replies_data,
            'total': len(replies_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

