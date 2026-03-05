// Load newsfeed on page load
document.addEventListener('DOMContentLoaded', () => {
    if (isLoggedIn()) {
        loadNewsfeed();
        loadFriendRequests();
    }
});

// Load newsfeed posts
async function loadNewsfeed(page = 1) {
    try {
        const newsfeedContainer = document.getElementById('newsfeed');
        if (page === 1) {
            newsfeedContainer.innerHTML = '<div class="loading">Đang tải...</div>';
        }
        
        const response = await fetchWithAuth(`${API_URL}/posts?page=${page}&per_page=10`);
        const data = await response.json();
        
        if (response.ok) {
            if (page === 1) {
                newsfeedContainer.innerHTML = '';
            }
            
            if (data.posts.length === 0) {
                newsfeedContainer.innerHTML = '<div class="empty-state">Chưa có bài viết nào</div>';
                return;
            }
            
            data.posts.forEach(post => {
                newsfeedContainer.appendChild(createPostCard(post));
            });
            
            // Implement infinite scroll
            if (data.current_page < data.pages) {
                const observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        observer.disconnect();
                        loadNewsfeed(page + 1);
                    }
                });
                
                const lastPost = newsfeedContainer.lastElementChild;
                if (lastPost) observer.observe(lastPost);
            }
        } else {
            newsfeedContainer.innerHTML = '<div class="empty-state">Không thể tải bài viết</div>';
        }
    } catch (error) {
        console.error('Failed to load newsfeed:', error);
        document.getElementById('newsfeed').innerHTML = '<div class="empty-state">Lỗi kết nối</div>';
    }
}

// Create post card element
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <img src="${post.author?.avatar_url || 'images/default-avatar.png'}" alt="${post.author?.full_name}">
                <div class="author-info">
                    <h4>${post.author?.full_name || 'Unknown User'}</h4>
                    <p>${formatDate(post.created_at)}</p>
                </div>
            </div>
            <button class="post-menu-btn" onclick="showPostMenu(${post.id})">⋯</button>
        </div>
        
        <div class="post-content">
            ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}
            ${createMediaHTML(post.media)}
        </div>
        
        <div class="post-stats">
            <span class="stat-item" onclick="showLikes(${post.id})">
                ❤️ ${post.like_count} lượt thích
            </span>
            <span class="stat-item" onclick="showComments(${post.id})">
                💬 ${post.comment_count} bình luận
            </span>
            <span class="stat-item">
                📤 ${post.share_count} chia sẻ
            </span>
        </div>
        
        <div class="post-actions">
            <button class="action-btn" onclick="toggleLike(${post.id}, this)">
                <span class="icon">❤️</span>
                <span>Thích</span>
            </button>
            <button class="action-btn" onclick="toggleComments(${post.id})">
                <span class="icon">💬</span>
                <span>Bình luận</span>
            </button>
            <button class="action-btn" onclick="sharePost(${post.id})">
                <span class="icon">📤</span>
                <span>Chia sẻ</span>
            </button>
        </div>
        
        <div class="post-comments" id="comments-${post.id}" style="display:none;">
            <div id="comments-list-${post.id}"></div>
            <div class="comment-form">
                <img src="${JSON.parse(localStorage.getItem('user') || '{}').avatar_url || 'images/default-avatar.png'}" alt="Avatar">
                <input type="text" placeholder="Viết bình luận..." onkeypress="submitComment(event, ${post.id})">
            </div>
        </div>
    `;
    
    return card;
}

// Create media HTML
function createMediaHTML(media) {
    if (!media || media.length === 0) return '';
    
    let html = '<div class="post-media';
    if (media.length > 1) {
        html += ` post-media-grid grid-${Math.min(media.length, 3)}`;
    }
    html += '">';
    
    media.forEach(item => {
        if (item.media_type === 'image') {
            html += `<img src="${item.media_url}" alt="Post image">`;
        } else if (item.media_type === 'video') {
            html += `<video src="${item.media_url}" controls></video>`;
        }
    });
    
    html += '</div>';
    return html;
}

// Toggle like
async function toggleLike(postId, button) {
    try {
        // TODO: Implement like API endpoint
        button.classList.toggle('active');
        alert('Like feature coming soon!');
    } catch (error) {
        console.error('Failed to toggle like:', error);
    }
}

// Toggle comments section
async function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    
    if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
        loadComments(postId);
    } else {
        commentsSection.style.display = 'none';
    }
}

// Load comments for a post
async function loadComments(postId) {
    try {
        const response = await fetchWithAuth(`${API_URL}/comments/post/${postId}`);
        const data = await response.json();
        
        if (response.ok) {
            const commentsList = document.getElementById(`comments-list-${postId}`);
            commentsList.innerHTML = '';
            
            data.comments.forEach(comment => {
                commentsList.appendChild(createCommentElement(comment));
            });
        }
    } catch (error) {
        console.error('Failed to load comments:', error);
    }
}

// Create comment element
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `
        <img src="${comment.author?.avatar_url || 'images/default-avatar.png'}" alt="${comment.author?.full_name}">
        <div>
            <div class="comment-content">
                <div class="comment-author">${comment.author?.full_name || 'Unknown User'}</div>
                <div class="comment-text">${escapeHtml(comment.content)}</div>
            </div>
            <div class="comment-actions">
                <button onclick="likeComment(${comment.id})">Thích</button>
                <button onclick="replyComment(${comment.id})">Phản hồi</button>
                <span>${formatDate(comment.created_at)}</span>
            </div>
        </div>
    `;
    return div;
}

// Submit comment
async function submitComment(event, postId) {
    if (event.key === 'Enter' && event.target.value.trim()) {
        try {
            const response = await fetchWithAuth(`${API_URL}/comments/post/${postId}`, {
                method: 'POST',
                body: JSON.stringify({ content: event.target.value.trim() })
            });
            
            if (response.ok) {
                event.target.value = '';
                loadComments(postId);
            } else {
                const data = await response.json();
                alert(data.error || 'Không thể đăng bình luận');
            }
        } catch (error) {
            console.error('Failed to submit comment:', error);
        }
    }
}

// Load friend requests
async function loadFriendRequests() {
    try {
        const response = await fetchWithAuth(`${API_URL}/friends/requests`);
        const data = await response.json();
        
        if (response.ok && data.requests.length > 0) {
            const container = document.getElementById('friendRequests');
            container.innerHTML = '';
            
            data.requests.forEach(request => {
                container.appendChild(createFriendRequestElement(request));
            });
            
            // Update badge
            document.getElementById('notifBadge').textContent = data.requests.length;
        }
    } catch (error) {
        console.error('Failed to load friend requests:', error);
    }
}

// Create friend request element
function createFriendRequestElement(request) {
    const div = document.createElement('div');
    div.className = 'friend-request-item';
    div.innerHTML = `
        <img src="${request.user.avatar_url || 'images/default-avatar.png'}" alt="${request.user.full_name}">
        <div>
            <strong>${request.user.full_name}</strong>
            <div style="margin-top: 8px;">
                <button class="btn btn-primary btn-sm" onclick="acceptFriendRequest(${request.user.id})">Chấp nhận</button>
                <button class="btn btn-secondary btn-sm" onclick="rejectFriendRequest(${request.user.id})">Từ chối</button>
            </div>
        </div>
    `;
    return div;
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    
    return date.toLocaleDateString('vi-VN');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
