-- ============================================
-- DATABASE SCHEMA FOR SOCIAL MEDIA CONTENT MODERATION SYSTEM
-- ============================================

-- Table: Users
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    avatar_url TEXT,
    
    -- OAuth fields
    oauth_provider ENUM('local', 'google', 'facebook') DEFAULT 'local',
    oauth_id VARCHAR(255),
    
    -- Account status
    account_status ENUM('active', 'warning', 'banned') DEFAULT 'active',
    warning_count INT DEFAULT 0,
    ban_reason TEXT,
    ban_until DATETIME,
    
    -- Verification
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_oauth (oauth_provider, oauth_id),
    INDEX idx_account_status (account_status)
);

-- Table: User Activity Logs
CREATE TABLE user_activity_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    activity_type ENUM('login', 'logout', 'post_create', 'post_update', 'post_delete', 'profile_update', 'password_change') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info TEXT,
    metadata JSON, -- Additional activity details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_activity (user_id, created_at),
    INDEX idx_activity_type (activity_type)
);

-- Table: Posts
CREATE TABLE posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    
    -- Content
    caption TEXT,
    content_type ENUM('text', 'image', 'video', 'mixed') DEFAULT 'text',
    
    -- Moderation status
    status ENUM('pending', 'published', 'rejected', 'flagged', 'deleted', 'under_review') DEFAULT 'pending',
    moderation_status ENUM('not_checked', 'ai_approved', 'ai_flagged', 'moderator_approved', 'moderator_rejected') DEFAULT 'not_checked',
    
    -- AI analysis results
    ai_confidence_score DECIMAL(5,2), -- 0-100
    ai_flag_reasons JSON, -- Array of detected violations
    ai_analyzed_at DATETIME,
    
    -- Moderation details
    moderator_id BIGINT,
    moderator_decision ENUM('approve', 'reject', 'flag') ,
    moderator_reason TEXT,
    moderated_at DATETIME,
    
    -- Metrics
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    report_count INT DEFAULT 0,
    
    -- Privacy
    visibility ENUM('public', 'friends', 'private') DEFAULT 'public',
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    permanent_delete_at DATETIME, -- Auto-delete after 30 days
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_posts (user_id, created_at),
    INDEX idx_status (status, created_at),
    INDEX idx_moderation (moderation_status, created_at),
    INDEX idx_ai_flagged (ai_confidence_score, status),
    INDEX idx_reports (report_count, status)
);

-- Table: Post Media
CREATE TABLE post_media (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    
    -- Media analysis
    width INT,
    height INT,
    duration INT, -- For videos (seconds)
    file_size BIGINT,
    
    -- AI analysis for this specific media
    ai_nsfw_score DECIMAL(5,2),
    ai_violence_score DECIMAL(5,2),
    ai_text_extracted TEXT, -- OCR result
    ai_objects_detected JSON,
    
    display_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    INDEX idx_post_media (post_id, display_order)
);

-- Table: Comments
CREATE TABLE comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    parent_comment_id BIGINT, -- For nested comments
    
    content TEXT NOT NULL,
    
    -- AI moderation
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    ai_flagged BOOLEAN DEFAULT FALSE,
    
    like_count INT DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    
    INDEX idx_post_comments (post_id, created_at),
    INDEX idx_user_comments (user_id, created_at)
);

-- Table: Likes
CREATE TABLE likes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    target_type ENUM('post', 'comment') NOT NULL,
    target_id BIGINT NOT NULL, -- post_id or comment_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_like (user_id, target_type, target_id),
    INDEX idx_target (target_type, target_id),
    INDEX idx_user_likes (user_id, created_at)
);

-- Table: Shares
CREATE TABLE shares (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    shared_caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    
    INDEX idx_user_shares (user_id, created_at),
    INDEX idx_post_shares (post_id, created_at)
);

-- Table: Friendships
CREATE TABLE friendships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    friend_id BIGINT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'blocked') DEFAULT 'pending',
    
    -- Who initiated the request
    requester_id BIGINT NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_friendship (user_id, friend_id),
    INDEX idx_user_friends (user_id, status),
    INDEX idx_pending_requests (friend_id, status, created_at)
);

-- Table: User Blocks
CREATE TABLE user_blocks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    blocker_id BIGINT NOT NULL, -- User who blocks
    blocked_id BIGINT NOT NULL, -- User who is blocked
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_block (blocker_id, blocked_id),
    INDEX idx_blocker (blocker_id),
    INDEX idx_blocked (blocked_id)
);

-- Table: Reports
CREATE TABLE reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    reporter_id BIGINT NOT NULL,
    
    target_type ENUM('post', 'comment', 'user') NOT NULL,
    target_id BIGINT NOT NULL,
    
    reason ENUM('spam', 'violence', 'hate_speech', 'nudity', 'scam', 'terrorism', 'other') NOT NULL,
    description TEXT,
    
    status ENUM('pending', 'reviewing', 'resolved', 'dismissed') DEFAULT 'pending',
    
    -- Resolution
    resolved_by BIGINT, -- Moderator ID
    resolution_note TEXT,
    resolved_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_target (target_type, target_id, status),
    INDEX idx_status (status, created_at),
    INDEX idx_reporter (reporter_id)
);

-- Table: Appeals (Kháng nghị)
CREATE TABLE appeals (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    
    -- What is being appealed
    appeal_type ENUM('post_rejection', 'account_warning', 'account_ban') NOT NULL,
    target_id BIGINT, -- post_id if post_rejection
    
    reason TEXT NOT NULL,
    evidence_urls JSON, -- User can provide proof
    
    status ENUM('pending', 'under_review', 'approved', 'rejected') DEFAULT 'pending',
    
    -- Resolution
    reviewed_by BIGINT, -- Moderator ID
    moderator_decision TEXT,
    reviewed_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_appeals (user_id, status),
    INDEX idx_status (status, created_at),
    INDEX idx_type (appeal_type, status)
);

-- Table: Moderation Queue
CREATE TABLE moderation_queue (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- What needs moderation
    target_type ENUM('post', 'avatar', 'appeal') NOT NULL,
    target_id BIGINT NOT NULL,
    
    -- Source of the queue item
    source ENUM('ai_flagged', 'user_report', 'manual_review', 'appeal') NOT NULL,
    
    priority INT DEFAULT 0, -- Higher = more urgent
    
    -- Assignment
    assigned_to BIGINT, -- Moderator ID
    status ENUM('pending', 'locked', 'completed') DEFAULT 'pending',
    
    -- AI suggestions
    ai_recommendation ENUM('approve', 'reject', 'escalate'),
    ai_confidence DECIMAL(5,2),
    ai_detected_issues JSON,
    
    locked_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_status_priority (status, priority DESC, created_at),
    INDEX idx_assigned (assigned_to, status),
    INDEX idx_target (target_type, target_id)
);

-- Table: Violation History
CREATE TABLE violation_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    
    violation_type ENUM('spam', 'hate_speech', 'nudity', 'violence', 'scam', 'deepfake', 'other') NOT NULL,
    severity ENUM('minor', 'moderate', 'severe', 'critical') NOT NULL,
    
    -- Related content
    post_id BIGINT,
    comment_id BIGINT,
    
    description TEXT,
    
    -- Action taken
    action_taken ENUM('warning', 'mute_1d', 'mute_3d', 'mute_7d', 'temporary_ban', 'permanent_ban', 'content_removal') NOT NULL,
    action_by BIGINT, -- Moderator or AI (NULL)
    
    expires_at DATETIME, -- For temporary actions
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
    FOREIGN KEY (action_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_violations (user_id, created_at),
    INDEX idx_severity (severity, created_at)
);

-- Table: Banned Keywords
CREATE TABLE banned_keywords (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    keyword VARCHAR(255) NOT NULL,
    keyword_normalized VARCHAR(255) NOT NULL, -- Lowercase, no special chars
    
    severity ENUM('block', 'flag', 'review') DEFAULT 'flag',
    category ENUM('profanity', 'hate_speech', 'violence', 'sexual', 'spam', 'scam', 'other') NOT NULL,
    
    is_regex BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    added_by BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_keyword (keyword_normalized),
    INDEX idx_active (is_active, severity)
);

-- Table: System Settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    
    updated_by BIGINT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, data_type, description) VALUES
    ('ai_nsfw_threshold', '80', 'number', 'AI NSFW detection threshold (0-100). Above this = auto-reject'),
    ('ai_violence_threshold', '75', 'number', 'AI violence detection threshold'),
    ('ai_grey_zone_min', '50', 'number', 'Minimum confidence to send to moderator queue'),
    ('auto_hide_report_count', '10', 'number', 'Auto-hide post after N user reports'),
    ('temp_ban_duration_days', '7', 'number', 'Default temporary ban duration'),
    ('soft_delete_retention_days', '30', 'number', 'Days before permanent deletion'),
    ('max_appeals_per_violation', '1', 'number', 'Maximum appeals allowed per violation'),
    ('appeal_deadline_days', '7', 'number', 'Days allowed to submit appeal after violation');

-- Table: User Roles (For Moderators and Admins)
CREATE TABLE user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    role ENUM('user', 'moderator', 'admin') DEFAULT 'user',
    granted_by BIGINT,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_user_role (user_id, role),
    INDEX idx_role (role)
);

-- Table: Moderator Performance Metrics
CREATE TABLE moderator_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    moderator_id BIGINT NOT NULL,
    
    date DATE NOT NULL,
    
    reviews_completed INT DEFAULT 0,
    avg_review_time_seconds INT DEFAULT 0,
    approvals INT DEFAULT 0,
    rejections INT DEFAULT 0,
    appeals_handled INT DEFAULT 0,
    
    FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_moderator_date (moderator_id, date),
    INDEX idx_date (date)
);

-- Table: User Interests/Tags (For friend recommendations)
CREATE TABLE user_interests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    tag VARCHAR(100) NOT NULL,
    interest_score INT DEFAULT 1, -- Increments with each interaction
    
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_tag (user_id, tag),
    INDEX idx_tag (tag, interest_score DESC)
);

-- Table: Post Tags (Auto-generated by NLP)
CREATE TABLE post_tags (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    tag VARCHAR(100) NOT NULL,
    confidence DECIMAL(5,2),
    
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    
    INDEX idx_post_tags (post_id),
    INDEX idx_tag (tag)
);

-- Table: Notifications
CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    
    type ENUM('like', 'comment', 'share', 'friend_request', 'friend_accept', 'violation_warning', 'post_approved', 'post_rejected', 'appeal_result') NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    related_id BIGINT, -- post_id, user_id, etc.
    related_type VARCHAR(50),
    
    is_read BOOLEAN DEFAULT FALSE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_notifications (user_id, is_read, created_at)
);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active Users
CREATE VIEW v_active_users AS
SELECT 
    id, username, email, full_name, avatar_url, account_status, warning_count,
    created_at, last_login_at
FROM users
WHERE account_status != 'banned';

-- View: Published Posts (For Newsfeed)
CREATE VIEW v_published_posts AS
SELECT 
    p.*,
    u.username, u.full_name, u.avatar_url
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.status = 'published' 
  AND p.is_deleted = FALSE
  AND u.account_status != 'banned';

-- View: Pending Moderation Items
CREATE VIEW v_pending_moderation AS
SELECT 
    mq.id as queue_id,
    mq.target_type,
    mq.target_id,
    mq.source,
    mq.priority,
    mq.ai_recommendation,
    mq.ai_confidence,
    mq.created_at,
    p.caption as post_caption,
    p.user_id as post_author_id,
    u.username as author_username
FROM moderation_queue mq
LEFT JOIN posts p ON mq.target_type = 'post' AND mq.target_id = p.id
LEFT JOIN users u ON p.user_id = u.id
WHERE mq.status = 'pending'
ORDER BY mq.priority DESC, mq.created_at ASC;
