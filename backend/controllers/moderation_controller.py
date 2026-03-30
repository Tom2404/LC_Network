import os
from io import BytesIO
from flask import Blueprint, request, jsonify, session, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from models import db
from models.moderation_queue import ModerationQueue
from models.post import Post
from models.post_media import PostMedia
from models.user import User
from models.appeal import Appeal
from models.violation_history import ViolationHistory
from models.comment import Comment
from models.friendship import Friendship
from models.report import Report
from controllers.notification_controller import create_notification
from datetime import datetime, timedelta
from functools import wraps
import requests

moderation_bp = Blueprint('moderation', __name__)

def get_current_user():
    """Get current user from either session or JWT"""
    # Try session first (for admin panel)
    if 'admin_user_id' in session:
        return User.query.get(session['admin_user_id'])
    
    # Try JWT (for API clients)
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        if user_id:
            return User.query.get(user_id)
    except:
        pass
    
    return None

def requires_moderator(f):
    """Decorator to check if user is moderator or admin (supports both session and JWT)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        
        if not (user.has_role('moderator') or user.has_role('admin')):
            return jsonify({'error': 'Moderator access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function


@moderation_bp.route('/queue', methods=['GET'])
@requires_moderator
def get_moderation_queue():
    """Lấy danh sách bài viết cần kiểm duyệt"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Get pending items ordered by priority, then newest first
        queue_items = ModerationQueue.query.filter_by(status='pending')\
            .order_by(ModerationQueue.priority.desc(), ModerationQueue.created_at.desc())\
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
@requires_moderator
def lock_queue_item(queue_id):
    """Lock queue item để xử lý (tránh trùng lặp)"""
    try:
        current_user = get_current_user(); current_user_id = current_user.id if current_user else None
        
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
@requires_moderator
def review_post(post_id):
    """
    Kiểm duyệt bài viết
    Body: {decision: 'approve'|'reject'|'flag', reason (optional)}
    """
    try:
        current_user = get_current_user(); current_user_id = current_user.id if current_user else None
        
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
        
        moderator_name = None
        if current_user:
            moderator_name = current_user.full_name or current_user.username or 'Admin'

        if decision == 'approve':
            post.status = 'published'
            post.moderation_status = 'moderator_approved'
            post.published_at = datetime.utcnow()

            approval_message = 'Bài viết của bạn đã được duyệt bởi admin và xuất bản.'
            if moderator_name:
                approval_message = f'Bài viết của bạn đã được duyệt bởi admin {moderator_name} và xuất bản.'

            create_notification(
                user_id=post.user_id,
                notification_type='post_approved',
                title='Bài viết đã được duyệt',
                message=approval_message,
                related_id=post.id,
                related_type='post',
                actor_id=current_user_id
            )
        elif decision == 'reject':
            post.status = 'rejected'
            post.moderation_status = 'moderator_rejected'

            reject_reason = reason.strip() if reason else 'Nội dung chưa phù hợp với tiêu chuẩn cộng đồng.'
            reject_message = f'Bài viết của bạn bị từ chối bởi admin. Lý do: {reject_reason}'
            if moderator_name:
                reject_message = f'Bài viết của bạn bị từ chối bởi admin {moderator_name}. Lý do: {reject_reason}'

            create_notification(
                user_id=post.user_id,
                notification_type='post_rejected',
                title='Bài viết bị từ chối',
                message=reject_message,
                related_id=post.id,
                related_type='post',
                actor_id=current_user_id
            )
        elif decision == 'flag':
            post.status = 'flagged'
        
        # Mark queue item as completed (handle both locked and direct-review cases)
        queue_item = ModerationQueue.query.filter(
            ModerationQueue.target_type == 'post',
            ModerationQueue.target_id == post_id,
            ModerationQueue.status.in_(['locked', 'pending'])
        ).order_by(ModerationQueue.created_at.desc()).first()
        
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
@requires_moderator
def review_appeal(appeal_id):
    """
    Xử lý kháng nghị
    Body: {decision: 'approve'|'reject', note}
    """
    try:
        current_user = get_current_user(); current_user_id = current_user.id if current_user else None
        
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
            post_dict['moderation_status'] = post.moderation_status
            post_dict['moderator_decision'] = post.moderator_decision
            post_dict['moderated_at'] = post.moderated_at.isoformat() if post.moderated_at else None
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


@moderation_bp.route('/posts/export', methods=['GET'])
@requires_moderator
def export_posts_for_moderation():
    """Xuất dữ liệu bài viết moderation ra PDF/DOCX."""
    try:
        export_format = (request.args.get('format', 'pdf') or 'pdf').strip().lower()
        status = (request.args.get('status', '') or '').strip()
        search = (request.args.get('search', '') or '').strip()
        limit = request.args.get('limit', 1000, type=int)
        limit = max(1, min(limit, 2000))

        query = Post.query.filter_by(is_deleted=False)

        if status:
            query = query.filter_by(status=status)

        if search:
            query = query.join(User).filter(
                db.or_(
                    Post.caption.ilike(f'%{search}%'),
                    User.username.ilike(f'%{search}%'),
                    User.full_name.ilike(f'%{search}%')
                )
            )

        posts = query.order_by(Post.created_at.desc()).limit(limit).all()

        def fmt_dt(dt):
            return dt.strftime('%d/%m/%Y %H:%M') if dt else '-'

        def status_label(value):
            labels = {
                'pending': 'Cho duyet',
                'published': 'Da duyet',
                'rejected': 'Tu choi',
                'flagged': 'Bi gan co',
                'deleted': 'Da xoa',
                'under_review': 'Dang review'
            }
            return labels.get(value, value or '-')

        def get_first_image_media(post_id):
            return PostMedia.query.filter_by(post_id=post_id, media_type='image')\
                .order_by(PostMedia.display_order.asc(), PostMedia.created_at.asc())\
                .first()

        def get_image_bytes(media_url, max_size=(360, 360)):
            if not media_url:
                return None

            raw_data = None
            if media_url.startswith('http://') or media_url.startswith('https://'):
                resp = requests.get(media_url, timeout=8)
                if not resp.ok:
                    return None
                raw_data = resp.content
            else:
                relative_path = media_url.lstrip('/').replace('/', os.sep)
                absolute_path = os.path.join(current_app.root_path, relative_path)
                if not os.path.exists(absolute_path):
                    return None
                with open(absolute_path, 'rb') as fp:
                    raw_data = fp.read()

            if not raw_data:
                return None

            from PIL import Image

            with Image.open(BytesIO(raw_data)) as img:
                if img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                else:
                    img = img.copy()

                img.thumbnail(max_size)
                output = BytesIO()
                img.save(output, format='JPEG', quality=82, optimize=True)
                return output.getvalue()

        rows = []
        for idx, post in enumerate(posts, start=1):
            author = User.query.get(post.user_id)
            moderator = User.query.get(post.moderator_id) if post.moderator_id else None
            first_image = get_first_image_media(post.id)

            image_bytes = None
            image_url = first_image.media_url if first_image else None
            if image_url:
                try:
                    image_bytes = get_image_bytes(image_url)
                except Exception:
                    image_bytes = None

            ai_flags = ', '.join((post.ai_flag_reasons or [])[:3]) if post.ai_flag_reasons else '-'
            caption = (post.caption or '').strip()
            caption = ' '.join(caption.split())

            rows.append({
                'stt': idx,
                'post_id': post.id,
                'user': (author.full_name or author.username) if author else 'Unknown',
                'username': author.username if author else '-',
                'content': caption[:180] + ('...' if len(caption) > 180 else ''),
                'created_at': fmt_dt(post.created_at),
                'status': status_label(post.status),
                'moderation_status': post.moderation_status or '-',
                'ai_score': float(post.ai_confidence_score) if post.ai_confidence_score is not None else '-',
                'ai_flags': ai_flags,
                'like_count': post.like_count or 0,
                'comment_count': post.comment_count or 0,
                'share_count': post.share_count or 0,
                'moderator': (moderator.full_name or moderator.username) if moderator else '-',
                'moderated_at': fmt_dt(post.moderated_at),
                'image_url': image_url,
                'image_bytes': image_bytes
            })

        generated_at = datetime.utcnow()
        status_token = status or 'all'
        base_filename = f"moderation_posts_{status_token}_{generated_at.strftime('%Y%m%d_%H%M%S')}"

        if export_format == 'docx':
            import importlib
            docx_module = importlib.import_module('docx')
            docx_shared = importlib.import_module('docx.shared')
            Document = docx_module.Document
            Pt = docx_shared.Pt
            Inches = docx_shared.Inches

            doc = Document()
            doc.add_heading('Bao cao Moderation - Danh sach bai viet', level=1)
            doc.add_paragraph(
                f"Ngay xuat: {generated_at.strftime('%d/%m/%Y %H:%M')} | So ban ghi: {len(rows)} | "
                f"Trang thai loc: {status or 'Tat ca'} | Tu khoa: {search or 'Khong co'}"
            )
            doc.add_paragraph('Luu y: Bao cao kem anh dau tien cua bai viet neu co (chi media image, bo qua video).')

            columns = [
                'STT', 'Post ID', 'Nguoi dung', 'Username', 'Noi dung', 'Ngay dang',
                'Trang thai', 'AI score', 'Tu khoa AI', 'Tuong tac', 'Nguoi duyet', 'Ngay duyet'
            ]
            table = doc.add_table(rows=1, cols=len(columns))
            table.style = 'Table Grid'

            for i, col in enumerate(columns):
                run = table.rows[0].cells[i].paragraphs[0].add_run(col)
                run.bold = True
                run.font.size = Pt(10)

            for row in rows:
                tr = table.add_row().cells
                tr[0].text = str(row['stt'])
                tr[1].text = str(row['post_id'])
                tr[2].text = row['user']
                tr[3].text = row['username']
                tr[4].text = row['content'] or '-'
                tr[5].text = row['created_at']
                tr[6].text = row['status']
                tr[7].text = str(row['ai_score'])
                tr[8].text = row['ai_flags']
                tr[9].text = f"Like {row['like_count']} | Comment {row['comment_count']} | Share {row['share_count']}"
                tr[10].text = row['moderator']
                tr[11].text = row['moderated_at']

            image_rows = [row for row in rows if row.get('image_bytes')]
            if image_rows:
                doc.add_paragraph()
                doc.add_heading('Anh dinh kem bai viet (xem truoc)', level=2)
                for row in image_rows:
                    doc.add_paragraph(f"Post #{row['post_id']} - @{row['username']}")
                    doc.add_picture(BytesIO(row['image_bytes']), width=Inches(2.0))

            output = BytesIO()
            doc.save(output)
            output.seek(0)

            return send_file(
                output,
                as_attachment=True,
                download_name=f"{base_filename}.docx",
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )

        if export_format == 'pdf':
            import importlib
            colors = importlib.import_module('reportlab.lib.colors')
            reportlab_pagesizes = importlib.import_module('reportlab.lib.pagesizes')
            reportlab_styles = importlib.import_module('reportlab.lib.styles')
            reportlab_units = importlib.import_module('reportlab.lib.units')
            reportlab_platypus = importlib.import_module('reportlab.platypus')

            A4 = reportlab_pagesizes.A4
            landscape = reportlab_pagesizes.landscape
            getSampleStyleSheet = reportlab_styles.getSampleStyleSheet
            mm = reportlab_units.mm
            SimpleDocTemplate = reportlab_platypus.SimpleDocTemplate
            Paragraph = reportlab_platypus.Paragraph
            Spacer = reportlab_platypus.Spacer
            Table = reportlab_platypus.Table
            TableStyle = reportlab_platypus.TableStyle
            RLImage = reportlab_platypus.Image

            output = BytesIO()
            doc = SimpleDocTemplate(
                output,
                pagesize=landscape(A4),
                rightMargin=12 * mm,
                leftMargin=12 * mm,
                topMargin=10 * mm,
                bottomMargin=10 * mm
            )
            styles = getSampleStyleSheet()
            story = [
                Paragraph('Bao cao Moderation - Danh sach bai viet', styles['Heading2']),
                Paragraph(
                    f"Ngay xuat: {generated_at.strftime('%d/%m/%Y %H:%M')} | So ban ghi: {len(rows)} | "
                    f"Trang thai loc: {status or 'Tat ca'} | Tu khoa: {search or 'Khong co'}",
                    styles['BodyText']
                ),
                Paragraph('Luu y: Bao cao kem anh dau tien cua bai viet neu co (chi media image, bo qua video).', styles['BodyText']),
                Spacer(1, 8)
            ]

            table_data = [[
                'STT', 'Post', 'Anh', 'Nguoi dung', 'Noi dung', 'Ngay dang',
                'Trang thai', 'AI', 'Tuong tac', 'Nguoi duyet', 'Ngay duyet'
            ]]

            for row in rows:
                safe_content = (row['content'] or '-').encode('latin-1', 'replace').decode('latin-1')
                safe_user = (row['user'] or '-').encode('latin-1', 'replace').decode('latin-1')
                safe_status = (row['status'] or '-').encode('latin-1', 'replace').decode('latin-1')
                safe_moderator = (row['moderator'] or '-').encode('latin-1', 'replace').decode('latin-1')

                image_cell = '-'
                if row.get('image_bytes'):
                    image_cell = RLImage(BytesIO(row['image_bytes']), width=26, height=26)

                table_data.append([
                    row['stt'],
                    row['post_id'],
                    image_cell,
                    safe_user,
                    safe_content,
                    row['created_at'],
                    safe_status,
                    str(row['ai_score']),
                    f"L{row['like_count']} C{row['comment_count']} S{row['share_count']}",
                    safe_moderator,
                    row['moderated_at']
                ])

            table = Table(table_data, repeatRows=1, colWidths=[15, 32, 30, 72, 145, 64, 54, 28, 48, 66, 64])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3)
            ]))
            story.append(table)
            doc.build(story)
            output.seek(0)

            return send_file(
                output,
                as_attachment=True,
                download_name=f"{base_filename}.pdf",
                mimetype='application/pdf'
            )

        return jsonify({'error': 'Unsupported format. Use pdf or docx'}), 400

    except ImportError:
        return jsonify({
            'error': 'Thieu thu vien xuat file. Vui long cai dat reportlab va python-docx trong backend/requirements.txt'
        }), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/posts/<int:post_id>', methods=['GET'])
@requires_moderator
def get_post_detail_for_moderation(post_id):
    """Lấy chi tiết bài viết cho admin/moderator (hỗ trợ session auth)."""
    try:
        post = Post.query.get(post_id)

        if not post or post.is_deleted:
            return jsonify({'error': 'Post not found'}), 404

        post_dict = post.to_dict()
        post_dict['moderation_status'] = post.moderation_status
        post_dict['ai_confidence_score'] = float(post.ai_confidence_score) if post.ai_confidence_score is not None else None
        post_dict['ai_flag_reasons'] = post.ai_flag_reasons or []
        post_dict['moderator_decision'] = post.moderator_decision
        post_dict['moderator_reason'] = post.moderator_reason
        post_dict['moderated_at'] = post.moderated_at.isoformat() if post.moderated_at else None

        author = User.query.get(post.user_id)
        if author:
            post_dict['author'] = {
                'id': author.id,
                'username': author.username,
                'full_name': author.full_name,
                'email': author.email,
                'avatar_url': author.avatar_url,
                'account_status': author.account_status,
                'warning_count': author.warning_count
            }

        pending_queue_item = ModerationQueue.query.filter_by(
            target_type='post',
            target_id=post.id,
            status='pending'
        ).order_by(ModerationQueue.priority.desc(), ModerationQueue.created_at.desc()).first()

        if pending_queue_item:
            post_dict['queue_item'] = pending_queue_item.to_dict()

        return jsonify({'post': post_dict}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/posts/<int:post_id>/mute-user', methods=['POST'])
@requires_moderator
def mute_user_from_post(post_id):
    """
    Mute user khi phát hiện vi phạm từ bài viết
    Body: {duration_hours: số giờ mute, reason: lý do}
    """
    try:
        current_user = get_current_user(); current_user_id = current_user.id if current_user else None
        
        post = Post.query.get(post_id)
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        user = User.query.get(post.user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        duration_hours = data.get('duration_hours', 24)  # Default 24h
        reason = data.get('reason', 'Vi phạm nội dung')
        
        # Mute chỉ chặn tạo nội dung mới, không chặn đăng nhập/xem/like
        user.account_status = 'warning'
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
        
        mute_action = 'mute_1d'
        if duration_hours >= 168:
            mute_action = 'mute_7d'
        elif duration_hours >= 72:
            mute_action = 'mute_3d'

        # Thêm vào violation history
        violation = ViolationHistory(
            user_id=user.id,
            violation_type='other',
            severity='moderate',
            post_id=post.id,
            description=reason,
            action_taken=mute_action,
            action_by=current_user_id,
            expires_at=datetime.utcnow() + timedelta(hours=duration_hours),
            created_at=datetime.utcnow()
        )
        db.session.add(violation)

        create_notification(
            user_id=user.id,
            notification_type='account_warning',
            title='Tài khoản của bạn đã bị mute tạm thời',
            message=f'Bạn không thể đăng bài, bình luận hoặc trả lời trong {duration_hours} giờ. Lý do: {reason}',
            related_id=post.id,
            related_type='post',
            actor_id=current_user_id
        )
        
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
@requires_moderator
def ban_user(user_id):
    """
    Ban user
    Body: {duration_hours: số giờ (null = permanent), reason: lý do}
    """
    try:
        current_user = get_current_user(); current_user_id = current_user.id if current_user else None
        
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


@moderation_bp.route('/users/<int:user_id>/profile-summary', methods=['GET'])
@requires_moderator
def get_user_profile_summary(user_id):
    """Lấy bản tóm tắt trang cá nhân của user cho admin"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        post_count = Post.query.filter_by(user_id=user.id).count()
        comment_count = Comment.query.filter_by(user_id=user.id).count()
        friend_count = Friendship.query.filter(
            db.or_(
                Friendship.user_id == user.id,
                Friendship.friend_id == user.id
            ),
            Friendship.status == 'accepted'
        ).count()

        summary = {
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'email': user.email,
            'phone_number': user.phone_number,
            'avatar_url': user.avatar_url,
            'account_status': user.account_status,
            'warning_count': user.warning_count,
            'ban_reason': user.ban_reason,
            'ban_until': user.ban_until.isoformat() if user.ban_until else None,
            'is_email_verified': user.is_email_verified,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'last_login_at': user.last_login_at.isoformat() if user.last_login_at else None,
            'stats': {
                'posts': post_count,
                'comments': comment_count,
                'friends': friend_count
            }
        }

        return jsonify({'summary': summary}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/users/<int:user_id>/unban', methods=['POST'])
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


@moderation_bp.route('/reports', methods=['GET'])
@requires_moderator
def get_reports():
    """Lấy danh sách báo cáo bài viết cho admin/moderator."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', 'pending')
        search = (request.args.get('search') or '').strip()

        query = Report.query.filter_by(target_type='post')
        if status and status != 'all':
            query = query.filter_by(status=status)

        if search:
            query = query.join(User, Report.reporter_id == User.id).outerjoin(
                Post,
                Report.target_id == Post.id
            ).filter(
                db.or_(
                    Report.description.ilike(f'%{search}%'),
                    Report.reason.ilike(f'%{search}%'),
                    User.username.ilike(f'%{search}%'),
                    User.full_name.ilike(f'%{search}%'),
                    Post.caption.ilike(f'%{search}%')
                )
            )

        reports = query.order_by(Report.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        items = []
        for report in reports.items:
            report_dict = report.to_dict()

            reporter = User.query.get(report.reporter_id)
            if reporter:
                report_dict['reporter'] = {
                    'id': reporter.id,
                    'username': reporter.username,
                    'full_name': reporter.full_name,
                    'avatar_url': reporter.avatar_url
                }

            post = Post.query.get(report.target_id)
            if post:
                report_dict['post'] = post.to_dict()
                report_dict['post_author'] = {
                    'id': post.author.id,
                    'username': post.author.username,
                    'full_name': post.author.full_name,
                    'avatar_url': post.author.avatar_url
                } if post.author else None

            items.append(report_dict)

        return jsonify({
            'reports': items,
            'total': reports.total,
            'pages': reports.pages,
            'current_page': page
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@moderation_bp.route('/reports/<int:report_id>/review', methods=['POST'])
@requires_moderator
def review_report(report_id):
    """
    Duyệt báo cáo vi phạm bài viết.
    Body: {decision: 'approve'|'dismiss', note}
    - approve: chấp thuận báo cáo và khóa bài viết (status='flagged')
    - dismiss: bác báo cáo
    """
    try:
        current_user = get_current_user()
        current_user_id = current_user.id if current_user else None

        report = Report.query.get(report_id)
        if not report:
            return jsonify({'error': 'Report not found'}), 404

        if report.target_type != 'post':
            return jsonify({'error': 'Only post reports are supported'}), 400

        if report.status in ['resolved', 'dismissed']:
            return jsonify({'error': 'Report has already been reviewed'}), 400

        data = request.get_json() or {}
        decision = data.get('decision')
        note = (data.get('note') or '').strip()

        if decision not in ['approve', 'dismiss']:
            return jsonify({'error': 'Invalid decision'}), 400

        if decision == 'approve' and not note:
            return jsonify({'error': 'Reason is required when approving a report'}), 400

        post = Post.query.get(report.target_id)
        if not post or post.is_deleted:
            return jsonify({'error': 'Reported post not found'}), 404

        report.status = 'resolved' if decision == 'approve' else 'dismissed'
        report.resolved_by = current_user_id
        report.resolution_note = note if note else 'Report dismissed by moderator'
        report.resolved_at = datetime.utcnow()

        if decision == 'approve':
            post.status = 'flagged'
            post.moderation_status = 'moderator_rejected'
            post.moderator_id = current_user_id
            post.moderator_decision = 'flag'
            post.moderator_reason = note
            post.moderated_at = datetime.utcnow()

            queue_item = ModerationQueue.query.filter(
                ModerationQueue.target_type == 'post',
                ModerationQueue.target_id == post.id,
                ModerationQueue.source == 'user_report',
                ModerationQueue.status.in_(['pending', 'locked'])
            ).order_by(ModerationQueue.created_at.desc()).first()

            if queue_item:
                queue_item.status = 'completed'
                queue_item.completed_at = datetime.utcnow()

            create_notification(
                user_id=post.user_id,
                notification_type='post_flagged',
                title='Bài viết bị khóa',
                message=f'Bài viết của bạn đã bị khóa vì: {note}',
                related_id=post.id,
                related_type='post',
                actor_id=current_user_id
            )

        db.session.commit()

        return jsonify({
            'message': 'Report reviewed successfully',
            'report': report.to_dict(),
            'post': post.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

