-- ============================================
-- Migration: Update Notification Types Enum
-- Date: 2026-02-13
-- Description: Add missing notification types (reply, post_flagged, account_suspended, account_banned, account_warning)
-- ============================================

-- For MySQL, we need to modify the ENUM column
ALTER TABLE notifications 
MODIFY COLUMN type ENUM(
    'like', 
    'comment', 
    'reply', 
    'share', 
    'friend_request', 
    'friend_accept', 
    'violation_warning', 
    'post_approved', 
    'post_rejected', 
    'post_flagged',
    'appeal_result', 
    'account_suspended', 
    'account_banned', 
    'account_warning'
) NOT NULL;

-- Verify the change
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'notifications' 
AND COLUMN_NAME = 'type';
