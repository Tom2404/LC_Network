from flask import Flask, send_from_directory
from flask_cors import CORS
import os

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

def create_app(config_name='development'):
    """Application factory"""
    # Set template and static folders to frontend directory
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
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
    CORS(app, origins=[app.config.get('FRONTEND_URL', '*')])
    
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
    
    # Register blueprints (controllers)
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api/users')
    app.register_blueprint(post_bp, url_prefix='/api/posts')
    app.register_blueprint(comment_bp, url_prefix='/api')  # Changed from /api/posts to /api
    app.register_blueprint(friend_bp, url_prefix='/api/friends')
    app.register_blueprint(moderation_bp, url_prefix='/api/moderation')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {'status': 'ok', 'message': 'Server is running'}
    
    # Serve frontend files
    @app.route('/')
    def index():
        return send_from_directory(frontend_dir, 'index.html')
    
    @app.route('/login')
    def login_page():
        return send_from_directory(frontend_dir, 'login.html')
    
    @app.route('/register')
    def register_page():
        return send_from_directory(frontend_dir, 'register.html')
    
    # Serve uploaded files
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        uploads_dir = app.config.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(__file__), 'uploads'))
        return send_from_directory(uploads_dir, filename)
    
    # Serve static files (CSS, JS, images)
    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(frontend_dir, path)
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        # If it's an API request, return JSON error
        if error.description and 'api' in str(error.description).lower():
            return {'error': 'Resource not found'}, 404
        # Otherwise try to serve the default page
        return send_from_directory(frontend_dir, 'index.html')
    
    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
