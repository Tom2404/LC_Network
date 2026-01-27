from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import all models here
from models.user import User
from models.user_activity_log import UserActivityLog
from models.user_role import UserRole
from models.post import Post
from models.post_media import PostMedia
from models.comment import Comment
from models.like import Like
from models.share import Share
from models.friendship import Friendship
from models.user_block import UserBlock
from models.report import Report
from models.appeal import Appeal
from models.moderation_queue import ModerationQueue
from models.violation_history import ViolationHistory
from models.banned_keyword import BannedKeyword
from models.notification import Notification
