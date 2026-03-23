from flask import Flask, send_from_directory, session, redirect, url_for, request, jsonify
from flask_cors import CORS
from flask_session import Session
import os
from datetime import datetime
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from config import config
from models import db
from extensions import bcrypt, jwt, mail
from controllers.auth_controller import auth_bp
from controllers.user_controller import user_bp
from controllers.post_controller import post_bp
from controllers.comment_controller import comment_bp
from controllers.friend_controller import friend_bp
from controllers.moderation_controller import moderation_bp
from controllers.notification_controller import notification_bp
from controllers.admin_controller import admin_auth_bp

def create_app(config_name='development'):
    """Application factory"""
    # Set template and static folders to frontend directory
    # Get absolute path of this file first to avoid CWD issues
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(backend_dir)
    frontend_dir = os.path.join(project_root, 'frontend')
    
    app = Flask(__name__, 
                template_folder=frontend_dir,
                static_folder=frontend_dir,
                static_url_path='')
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    Session(app)  # Initialize server-side session
    CORS(app, origins=[app.config.get('FRONTEND_URL', '*')], supports_credentials=True)
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    # JWT Error Handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        print("JWT EXPIRED!")
        return {'error': 'Token has expired', 'code': 'token_expired'}, 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        print(f"JWT INVALID: {error}")
        return {'error': 'Invalid token', 'code': 'invalid_token'}, 422
    
    @jwt.unauthorized_loader
    def unauthorized_callback(error):
        print(f"JWT UNAUTHORIZED: {error}")
        return {'error': 'Missing Authorization Header', 'code': 'unauthorized'}, 401
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        print("JWT REVOKED!")
        return {'error': 'Token has been revoked', 'code': 'token_revoked'}, 401

    @app.before_request
    def enforce_inactivity_timeout():
        if request.method == 'OPTIONS' or not request.path.startswith('/api/'):
            return None

        now_ts = int(datetime.utcnow().timestamp())

        if request.path.startswith('/api/admin/') and request.path != '/api/admin/login':
            admin_user_id = session.get('admin_user_id')
            if admin_user_id:
                last_activity = session.get('admin_last_activity_ts')
                timeout_seconds = int(app.config.get('ADMIN_INACTIVITY_TIMEOUT_SECONDS', 900))

                if last_activity and (now_ts - int(last_activity) > timeout_seconds):
                    session.clear()
                    return jsonify({
                        'error': 'Session expired due to inactivity',
                        'code': 'session_timeout'
                    }), 401

                session['admin_last_activity_ts'] = now_ts
            return None

        if request.path in {
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/verify-otp',
            '/api/auth/resend-otp'
        } or request.path.startswith('/api/auth/verify-email') or request.path == '/api/health':
            return None

        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None

        try:
            verify_jwt_in_request(optional=False)
            current_user_id = str(get_jwt_identity())
        except Exception:
            return None

        timeout_seconds = int(app.config.get('USER_INACTIVITY_TIMEOUT_SECONDS', 900))
        tracked_user_id = session.get('active_user_id')
        last_activity = session.get('user_last_activity_ts')

        if tracked_user_id is None or str(tracked_user_id) != current_user_id:
            session['active_user_id'] = current_user_id
            session['user_last_activity_ts'] = now_ts
            return None

        if last_activity and (now_ts - int(last_activity) > timeout_seconds):
            session.pop('active_user_id', None)
            session.pop('user_last_activity_ts', None)
            return jsonify({
                'error': 'Session expired due to inactivity',
                'code': 'session_timeout'
            }), 401

        session['user_last_activity_ts'] = now_ts
        return None
    
    # Register blueprints (controllers)
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api/users')
    app.register_blueprint(post_bp, url_prefix='/api/posts')
    app.register_blueprint(comment_bp, url_prefix='/api')  # Changed from /api/posts to /api
    app.register_blueprint(friend_bp, url_prefix='/api/friends')
    app.register_blueprint(moderation_bp, url_prefix='/api/moderation')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')
    app.register_blueprint(admin_auth_bp)  # Admin authentication routes
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {'status': 'ok', 'message': 'Server is running'}
    
    # Serve frontend files
    @app.route('/')
    @app.route('/index.html')
    def index():
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, 'index.html')
    
    @app.route('/login')
    @app.route('/login.html')
    def login_page():
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, 'login.html')
    
    @app.route('/register')
    @app.route('/register.html')
    def register_page():
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, 'register.html')
    
    @app.route('/profile')
    @app.route('/profile.html')
    def profile_page():
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, 'profile.html')
    
    @app.route('/post')
    @app.route('/post.html')
    def post_page():
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, 'post.html')
    
    @app.route('/friends')
    @app.route('/friends.html')
    def friends_page():
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, 'friends.html')
    
    @app.route('/notifications')
    @app.route('/notifications.html')
    def notifications_page():
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, 'notifications.html')
    
    @app.route('/admin/login')
    @app.route('/admin/login.html')
    def admin_login_page():
        # If already logged in, redirect to admin dashboard
        if 'admin_user_id' in session:
            return redirect('/admin/')
        admin_dir = os.path.join(frontend_dir, 'admin')
        return send_from_directory(admin_dir, 'login.html')
    
    @app.route('/admin')
    @app.route('/admin/')
    def admin_page():
        # Check if admin is authenticated
        if 'admin_user_id' not in session:
            return redirect('/admin/login')
        now_ts = int(datetime.utcnow().timestamp())
        last_activity = session.get('admin_last_activity_ts')
        timeout_seconds = int(app.config.get('ADMIN_INACTIVITY_TIMEOUT_SECONDS', 900))
        if last_activity and (now_ts - int(last_activity) > timeout_seconds):
            session.clear()
            return redirect('/admin/login')
        session['admin_last_activity_ts'] = now_ts
        admin_dir = os.path.join(frontend_dir, 'admin')
        return send_from_directory(admin_dir, 'PostManager.html')

    @app.route('/admin/users')
    @app.route('/admin/users.html')
    @app.route('/admin/UserManagement.html')
    @app.route('/admin/PostManagement.html')
    def admin_users_page():
        if 'admin_user_id' not in session:
            return redirect('/admin/login')
        now_ts = int(datetime.utcnow().timestamp())
        last_activity = session.get('admin_last_activity_ts')
        timeout_seconds = int(app.config.get('ADMIN_INACTIVITY_TIMEOUT_SECONDS', 900))
        if last_activity and (now_ts - int(last_activity) > timeout_seconds):
            session.clear()
            return redirect('/admin/login')
        session['admin_last_activity_ts'] = now_ts
        admin_dir = os.path.join(frontend_dir, 'admin')
        return send_from_directory(admin_dir, 'UserManager.html')
    
    # Serve uploaded files
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        uploads_dir = app.config.get('UPLOAD_FOLDER', os.path.join(backend_dir, 'uploads'))
        return send_from_directory(uploads_dir, filename)
    
    # Serve static files (CSS, JS, images, components)
    @app.route('/user/<path:path>')
    def serve_user_static(path):
        user_dir = os.path.join(frontend_dir, 'user')
        return send_from_directory(user_dir, path)
    
    @app.route('/admin/<path:path>')
    def serve_admin_static(path):
        admin_dir = os.path.join(frontend_dir, 'admin')
        return send_from_directory(admin_dir, path)
    
    # Serve static files (CSS, JS, images)
    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(frontend_dir, path)
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        # If it's an API request, return JSON error
        from flask import request
        if request.path.startswith('/api/'):
            return {'error': 'Resource not found'}, 404
        # For other 404s, return a proper error message instead of trying to serve index
        # to avoid infinite loops
        return {'error': 'Page not found', 'path': request.path}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
