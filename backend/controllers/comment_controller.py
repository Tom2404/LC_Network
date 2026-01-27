from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.comment import Comment
from models.post import Post
from models.user import User
from datetime import datetime

comment_bp = Blueprint('comment', __name__)

@comment_bp.route('/post/<int:post_id>', methods=['POST'])
@jwt_required()
def create_comment(post_id):
    """
    Tạo comment cho bài viết
    Body: {content, parent_comment_id (optional)}
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
            content=data['content']
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


@comment_bp.route('/post/<int:post_id>', methods=['GET'])
@jwt_required()
def get_comments(post_id):
    """Lấy danh sách comment của bài viết"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        post = Post.query.get(post_id)
        if not post or post.is_deleted:
            return jsonify({'error': 'Post not found'}), 404
        
        # Get root comments (parent_comment_id is NULL)
        comments = Comment.query.filter_by(post_id=post_id, parent_comment_id=None, is_blocked=False)\
            .order_by(Comment.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'comments': [comment.to_dict(include_replies=True) for comment in comments.items],
            'total': comments.total,
            'pages': comments.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@comment_bp.route('/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    """Xóa comment"""
    try:
        current_user_id = get_jwt_identity()
        comment = Comment.query.get(comment_id)
        
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        
        if comment.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Update post comment count
        post = Post.query.get(comment.post_id)
        if post:
            post.comment_count -= 1
        
        db.session.delete(comment)
        db.session.commit()
        
        return jsonify({'message': 'Comment deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
