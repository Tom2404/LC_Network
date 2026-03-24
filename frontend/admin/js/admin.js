// Admin Panel JavaScript
const API_BASE_URL = (typeof API_URL !== 'undefined' && API_URL)
    ? API_URL
    : `${window.location.protocol}//${window.location.hostname}:5000/api`;

let currentTab = 'posts';
let currentPostPage = 1;
let currentUserPage = 1;
let currentQueuePage = 1;
let selectedPost = null;
let selectedUser = null;
let searchTimeout = null;
let currentAdminUser = null;

// Check authentication on page load - Now using session instead of JWT
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/check-session`, {
            credentials: 'include' // Important for sending session cookie
        });
        
        if (response.status === 401) {
            // Not authenticated, redirect to login
            window.location.href = '/login';
            return false;
        }
        
        if (!response.ok) {
            throw new Error('Session check failed');
        }
        
        const data = await response.json();
        currentAdminUser = data.user;
        
        // Display admin info
        if (document.getElementById('adminFullName')) {
            document.getElementById('adminFullName').textContent = data.user.full_name || data.user.username || 'Quản trị viên';
        }
        if (document.getElementById('adminRole')) {
            document.getElementById('adminRole').textContent = 'Admin';
        }
        if (document.getElementById('adminInitials')) {
            const name = data.user.full_name || data.user.username || 'A';
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('adminInitials').textContent = initials;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login';
        return false;
    }
}

async function logout() {
    confirmAction('Bạn có chắc muốn đăng xuất?', async () => {
        try {
            await fetch(`${API_BASE_URL}/admin/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        // Also clear any JWT token if exists
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        window.location.href = '/login';
    });
}

// Helper function for authenticated fetch requests
async function authenticatedFetch(url, options = {}) {
    // Ensure credentials are included for session
    const fetchOptions = {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(url, fetchOptions);
        
        // If unauthorized, redirect to login
        if (response.status === 401) {
            window.location.href = '/login';
            throw new Error('Unauthorized');
        }
        
        return response;
    } catch (error) {
        // If error is not 401, rethrow
        if (error.message !== 'Unauthorized') {
            throw error;
        }
    }
}

function loadAdminData() {
    switch (currentTab) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'posts':
            loadPosts();
            break;
        case 'users':
            loadUsers();
            break;
        case 'queue':
            loadQueue();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ============= POSTS MANAGEMENT =============

async function loadPosts(page = 1) {
    currentPostPage = page;
    const status = document.getElementById('post-status-filter').value;
    const search = document.getElementById('post-search').value;
    
    try {
        const token = localStorage.getItem('token');
        let url = `${API_BASE_URL}/moderation/posts?page=${page}&per_page=10`;
        
        if (status) url += `&status=${status}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displayPosts(data.posts);
        displayPagination('posts', data.current_page, data.pages);
        
    } catch (error) {
        console.error('Error loading posts:', error);
        showError('Không thể tải danh sách bài viết');
    }
}

function displayPosts(posts) {
    const container = document.getElementById('postsTable');
    
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="text-center py-12"><p class="text-muted">Không có bài viết nào</p></div>';
        return;
    }
    
    const tableHTML = `
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Người dùng</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Nội dung</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Trạng thái</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">AI Score</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ngày</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Hành động</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${posts.map(post => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <img src="${post.author?.avatar_url || '/user/images/default-avatar.png'}" 
                                     alt="Avatar" class="w-8 h-8 rounded-full bg-slate-100">
                                <div>
                                    <p class="text-sm font-bold">@${post.author?.username || 'Unknown'}</p>
                                    <p class="text-xs text-muted">ID: ${post.author?.id || 'N/A'}</p>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate">${escapeHtml(post.caption || 'Không có nội dung')}</p>
                            ${post.media && post.media.length > 0 ? '<span class="text-xs text-muted">📎 ' + post.media.length + ' file</span>' : ''}
                        </td>
                        <td class="px-6 py-4">
                            ${getStatusBadge(post.status)}
                        </td>
                        <td class="px-6 py-4">
                            ${getAIScoreBar(post.ai_confidence_score)}
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-xs text-muted">${formatDateShort(post.created_at)}</p>
                            <p class="text-[10px] text-muted">${formatTimeShort(post.created_at)}</p>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center justify-end gap-2">
                                <button onclick="showPostDetail(${post.id})" 
                                    class="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="Xem chi tiết">
                                    <span class="material-symbols-outlined">visibility</span>
                                </button>
                                ${post.status === 'pending' || post.status === 'flagged' ? `
                                    <button onclick="quickApprovePost(${post.id})" 
                                        class="p-1.5 text-success hover:bg-success/10 rounded-lg" title="Duyệt">
                                        <span class="material-symbols-outlined">check_circle</span>
                                    </button>
                                    <button onclick="quickRejectPost(${post.id})" 
                                        class="p-1.5 text-warning hover:bg-warning/10 rounded-lg" title="Từ chối">
                                        <span class="material-symbols-outlined">cancel</span>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <p class="text-xs text-muted font-medium">Hiển thị ${posts.length} bài viết</p>
            <div id="posts-pagination"></div>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

function handlePostSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadPosts(1);
    }, 500);
}

function showPostDetail(postId, options = {}) {
    // Load post detail via moderation endpoint (supports admin session)
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    fetch(`${API_BASE_URL}/moderation/posts/${postId}`, {
        credentials: 'include',
        headers
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError(data.error);
            return;
        }

        const postData = data.post || data;
        selectedPost = postData;
        displayPostDetail(postData);
        document.getElementById('post-modal').style.display = 'flex';
        if (options.openReject === true) {
            document.getElementById('reject-reason-container').style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error loading post detail:', error);
        showError('Không thể tải chi tiết bài viết');
    });
}

function displayPostDetail(post) {
    const container = document.getElementById('post-detail-content');
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Author Info -->
            <div class="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <img src="${post.author?.avatar_url || '/user/images/default-avatar.png'}" 
                     alt="Avatar" class="w-16 h-16 rounded-full">
                <div class="flex-1">
                    <h4 class="text-lg font-bold">${post.author?.username || 'Unknown'}</h4>
                    <p class="text-sm text-muted">${post.author?.email || 'N/A'}</p>
                    <div class="flex gap-2 mt-2">
                        ${getStatusBadge(post.author?.account_status || 'active')}
                        ${post.author?.warning_count > 0 ? 
                            `<span class="text-xs bg-warning/10 text-warning px-2 py-1 rounded">⚠️ ${post.author.warning_count} vi phạm</span>` 
                            : ''}
                    </div>
                </div>
            </div>
            
            <!-- Post Content -->
            <div>
                <h5 class="text-sm font-bold text-muted uppercase mb-2">Nội dung bài viết</h5>
                <p class="text-base whitespace-pre-wrap">${escapeHtml(post.caption || 'Không có nội dung')}</p>
                
                ${post.media && post.media.length > 0 ? `
                    <div class="mt-4 grid gap-3">
                        ${post.media.map(media => 
                            media.media_type === 'image' ? 
                                `<img src="${media.media_url}" alt="Media" class="rounded-lg max-h-96 object-cover">` : 
                                `<video src="${media.media_url}" controls class="rounded-lg max-h-96 w-full"></video>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
            
            <!-- Metadata -->
            <div class="grid grid-cols-2 gap-4">
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Trạng thái</p>
                    ${getStatusBadge(post.status)}
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">AI Confidence</p>
                    ${getAIScoreBar(post.ai_confidence_score)}
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Ngày tạo</p>
                    <p class="text-sm">${formatDate(post.created_at)}</p>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Tương tác</p>
                    <p class="text-sm">👍 ${post.like_count || 0} • 💬 ${post.comment_count || 0}</p>
                </div>
            </div>
            
            ${post.ai_flag_reasons && post.ai_flag_reasons.length > 0 ? `
                <div class="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                    <p class="text-sm font-bold text-warning mb-2">⚠️ AI Phát hiện:</p>
                    <ul class="list-disc list-inside space-y-1">
                        ${post.ai_flag_reasons.map(flag => `<li class="text-sm">${flag}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${post.moderator_reason ? `
                <div class="p-4 bg-danger/5 border border-danger/20 rounded-lg">
                    <p class="text-sm font-bold text-danger mb-1">Lý do từ chối:</p>
                    <p class="text-sm">${escapeHtml(post.moderator_reason)}</p>
                </div>
            ` : ''}
        </div>
    `;
}

function closePostModal() {
    document.getElementById('post-modal').style.display = 'none';
    selectedPost = null;
    document.getElementById('reject-reason-container').style.display = 'none';
    document.getElementById('mute-dialog').style.display = 'none';
}

function refreshAfterModerationAction() {
    if (currentTab === 'queue') {
        loadQueue(currentQueuePage);
        if (typeof updateQueueSummary === 'function') {
            updateQueueSummary();
        }
        return;
    }

    loadPosts(currentPostPage);
}

function approvePost() {
    if (!selectedPost) return;
    confirmAction('Bạn có chắc muốn duyệt bài viết này?', () => {
        const token = localStorage.getItem('token');

        fetch(`${API_BASE_URL}/moderation/review/${selectedPost.id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                decision: 'approve'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
                return;
            }

            showSuccess('Đã duyệt bài viết thành công');
            closePostModal();
            refreshAfterModerationAction();
        })
        .catch(error => {
            console.error('Error approving post:', error);
            showError('Không thể duyệt bài viết');
        });
    });
}

function rejectPost() {
    document.getElementById('reject-reason-container').style.display = 'block';
}

function submitReject() {
    if (!selectedPost) return;
    
    const reason = document.getElementById('reject-reason').value.trim();
    
    if (!reason) {
        showError('Vui lòng nhập lý do từ chối');
        return;
    }
    
    const token = localStorage.getItem('token');
    
    fetch(`${API_BASE_URL}/moderation/review/${selectedPost.id}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            decision: 'reject',
            reason: reason
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError(data.error);
            return;
        }
        
        showSuccess('Đã từ chối bài viết thành công');
        closePostModal();
        refreshAfterModerationAction();
    })
    .catch(error => {
        console.error('Error rejecting post:', error);
        showError('Không thể từ chối bài viết');
    });
}

function showMuteDialog() {
    document.getElementById('mute-dialog').style.display = 'block';
}

function submitMuteUser() {
    if (!selectedPost) return;
    
    const duration = parseInt(document.getElementById('mute-duration').value);
    const reason = document.getElementById('mute-reason').value.trim();
    
    if (!reason) {
        showError('Vui lòng nhập lý do mute');
        return;
    }

    confirmAction(`Bạn có chắc muốn mute user này trong ${duration} giờ?`, () => {
        const token = localStorage.getItem('token');

        fetch(`${API_BASE_URL}/moderation/posts/${selectedPost.id}/mute-user`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                duration_hours: duration,
                reason: reason
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
                return;
            }

            showSuccess(`Đã mute user thành công đến ${formatDate(data.ban_until)}`);
            closePostModal();
            loadPosts(currentPostPage);
        })
        .catch(error => {
            console.error('Error muting user:', error);
            showError('Không thể mute user');
        });
    });
}

// ============= USERS MANAGEMENT =============

async function loadUsers(page = 1) {
    currentUserPage = page;
    const status = document.getElementById('user-status-filter').value;
    const search = document.getElementById('user-search').value;
    
    try {
        const token = localStorage.getItem('token');
        let url = `${API_BASE_URL}/moderation/users?page=${page}&per_page=10`;
        
        if (status) url += `&status=${status}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displayUsers(data.users);
        displayPagination('users', data.current_page, data.pages);
        
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Không thể tải danh sách người dùng');
    }
}

function displayUsers(users) {
    const container = document.getElementById('postsTable'); // Reuse same container
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div class="text-center py-12"><p class="text-muted">Không có người dùng nào</p></div>';
        return;
    }
    
    const tableHTML = `
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Người dùng</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Email</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Trạng thái</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Vi phạm</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ngày tham gia</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Hành động</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${users.map(user => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <img src="${user.avatar_url || '/user/images/default-avatar.png'}" 
                                     alt="Avatar" class="w-8 h-8 rounded-full bg-slate-100">
                                <div>
                                    <p class="text-sm font-bold">@${user.username}</p>
                                    <p class="text-xs text-muted">${user.full_name || 'N/A'}</p>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-sm">${user.email}</p>
                        </td>
                        <td class="px-6 py-4">
                            ${getStatusBadge(user.account_status)}
                            ${user.account_status === 'banned' && user.ban_until ? 
                                `<p class="text-xs text-muted mt-1">Đến: ${formatDateShort(user.ban_until)}</p>` : 
                                ''}
                        </td>
                        <td class="px-6 py-4">
                            ${user.warning_count > 0 ? 
                                `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">⚠️ ${user.warning_count}</span>` : 
                                '<span class="text-xs text-muted">0</span>'}
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-xs text-muted">${formatDateShort(user.created_at)}</p>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center justify-end gap-2">
                                <button onclick="showUserDetail(${user.id})" 
                                    class="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="Xem chi tiết">
                                    <span class="material-symbols-outlined">visibility</span>
                                </button>
                                ${user.account_status === 'banned' ? `
                                    <button onclick="quickUnbanUser(${user.id})" 
                                        class="p-1.5 text-success hover:bg-success/10 rounded-lg" title="Unban">
                                        <span class="material-symbols-outlined">check_circle</span>
                                    </button>
                                ` : `
                                    <button onclick="quickBanUser(${user.id})" 
                                        class="p-1.5 text-danger hover:bg-danger/10 rounded-lg" title="Ban">
                                        <span class="material-symbols-outlined">block</span>
                                    </button>
                                `}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <p class="text-xs text-muted font-medium">Hiển thị ${users.length} người dùng</p>
            <div id="users-pagination"></div>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

function handleUserSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadUsers(1);
    }, 500);
}

function showUserDetail(userId, options = {}) {
    const token = localStorage.getItem('token');
    
    fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError(data.error);
            return;
        }
        
        selectedUser = data;
        displayUserDetail(data);
        document.getElementById('user-modal').style.display = 'flex';
        
        // Show/hide ban/unban buttons
        if (data.account_status === 'banned') {
            document.querySelector('.btn-ban').style.display = 'none';
            document.querySelector('.btn-unban').style.display = 'block';
        } else {
            document.querySelector('.btn-ban').style.display = 'block';
            document.querySelector('.btn-unban').style.display = 'none';
        }

        if (options.openBan === true && data.account_status !== 'banned') {
            showBanDialog();
        }
    })
    .catch(error => {
        console.error('Error loading user detail:', error);
        showError('Không thể tải chi tiết người dùng');
    });
}

function displayUserDetail(user) {
    const container = document.getElementById('user-detail-content');
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- User Header -->
            <div class="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <img src="${user.avatar_url || '/user/images/default-avatar.png'}" 
                     alt="Avatar" class="w-20 h-20 rounded-full">
                <div class="flex-1">
                    <h3 class="text-xl font-bold">${user.username}</h3>
                    <p class="text-base text-muted">${user.full_name || 'N/A'}</p>
                    <div class="mt-2">
                        ${getStatusBadge(user.account_status)}
                    </div>
                </div>
            </div>
            
            <!-- User Details Grid -->
            <div class="grid grid-cols-2 gap-4">
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Email</p>
                    <p class="text-sm font-medium">${user.email}</p>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Số điện thoại</p>
                    <p class="text-sm font-medium">${user.phone_number || 'N/A'}</p>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Ngày tham gia</p>
                    <p class="text-sm">${formatDate(user.created_at)}</p>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Đăng nhập cuối</p>
                    <p class="text-sm">${user.last_login_at ? formatDate(user.last_login_at) : 'N/A'}</p>
                </div>
                <div class="p-3 ${user.warning_count > 0 ? 'bg-warning/5 border border-warning/20' : 'bg-slate-50 dark:bg-slate-800/50'} rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Vi phạm</p>
                    <p class="text-lg font-bold ${user.warning_count > 0 ? 'text-warning' : ''}">${user.warning_count || 0}</p>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p class="text-xs text-muted font-medium uppercase mb-1">Vai trò</p>
                    <p class="text-sm font-medium">${user.role || 'user'}</p>
                </div>
            </div>
            
            ${user.account_status === 'banned' ? `
                <div class="p-4 bg-danger/5 border border-danger/20 rounded-lg">
                    <p class="text-sm font-bold text-danger mb-2">🚫 Thông tin Ban</p>
                    <div class="space-y-2">
                        <div>
                            <span class="text-xs text-muted">Lý do:</span>
                            <p class="text-sm">${user.ban_reason || 'N/A'}</p>
                        </div>
                        ${user.ban_until ? `
                            <div>
                                <span class="text-xs text-muted">Ban đến:</span>
                                <p class="text-sm font-bold">${formatDate(user.ban_until)}</p>
                            </div>
                        ` : '<p class="text-sm font-bold text-danger">Ban vĩnh viễn</p>'}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
    selectedUser = null;
    document.getElementById('ban-dialog').style.display = 'none';
}

function showBanDialog() {
    document.getElementById('ban-dialog').style.display = 'block';
}

function submitBanUser() {
    if (!selectedUser) return;
    
    const duration = document.getElementById('ban-duration').value;
    const reason = document.getElementById('ban-reason').value.trim();
    
    if (!reason) {
        showError('Vui lòng nhập lý do ban');
        return;
    }
    
    const durationText = duration ? `${duration} giờ` : 'vĩnh viễn';

    confirmAction(`Bạn có chắc muốn ban user này ${durationText}?`, () => {
        const token = localStorage.getItem('token');

        const body = {
            reason: reason
        };

        if (duration) {
            body.duration_hours = parseInt(duration);
        }

        fetch(`${API_BASE_URL}/moderation/users/${selectedUser.id}/ban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
                return;
            }

            showSuccess(`Đã ban user thành công ${durationText}`);
            closeUserModal();
            loadUsers(currentUserPage);
        })
        .catch(error => {
            console.error('Error banning user:', error);
            showError('Không thể ban user');
        });
    });
}

function unbanUser() {
    if (!selectedUser) return;

    confirmAction('Bạn có chắc muốn unban user này?', () => {
        const token = localStorage.getItem('token');

        fetch(`${API_BASE_URL}/moderation/users/${selectedUser.id}/unban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
                return;
            }

            showSuccess('Đã unban user thành công');
            closeUserModal();
            loadUsers(currentUserPage);
        })
        .catch(error => {
            console.error('Error unbanning user:', error);
            showError('Không thể unban user');
        });
    });
}

// ============= QUEUE MANAGEMENT =============

async function loadQueue(page = 1) {
    currentQueuePage = page;
    
    try {
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/moderation/queue?page=${page}&per_page=10`;
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await fetch(url, {
            credentials: 'include',
            headers
        });
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        displayQueue(data.queue);
        displayPagination('queue', data.current_page, data.pages);
        
    } catch (error) {
        console.error('Error loading queue:', error);
        showError('Không thể tải hàng đợi');
    }
}

function displayQueue(queue) {
    const container = document.getElementById('postsTable');
    
    if (!queue || queue.length === 0) {
        container.innerHTML = '<div class="text-center py-12"><p class="text-muted">Hàng đợi trống</p></div>';
        return;
    }
    
    const tableHTML = `
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ưu tiên</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Nội dung</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Lý do</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ngày</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Hành động</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${queue.map(item => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td class="px-6 py-4">
                            ${getPriorityBadge(item.priority)}
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate">
                                ${escapeHtml(item.content?.caption || 'Không có nội dung')}
                            </p>
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-xs text-muted">${item.reason || 'Cần kiểm duyệt'}</p>
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-xs text-muted">${formatDateShort(item.created_at)}</p>
                            <p class="text-[10px] text-muted">${formatTimeShort(item.created_at)}</p>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center justify-end gap-2">
                                <button onclick="showPostDetail(${item.target_id})" 
                                    class="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                                    Xem xét
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <p class="text-xs text-muted font-medium">Hiển thị ${queue.length} mục</p>
            <div id="queue-pagination"></div>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

function getPriorityBadge(priority) {
    const normalizedPriority = typeof priority === 'number'
        ? (priority >= 80 ? 'high' : priority >= 40 ? 'medium' : 'low')
        : priority;

    const badges = {
        'high': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger">Cao</span>',
        'medium': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Trung bình</span>',
        'low': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">Thấp</span>'
    };
    return badges[normalizedPriority] || badges['low'];
}

// ============= PAGINATION =============

function displayPagination(type, currentPage, totalPages) {
    const container = document.getElementById(`${type}-pagination`);
    
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="flex gap-2">';
    
    // Previous button
    html += `<button onclick="load${capitalize(type)}(${currentPage - 1})" 
        class="px-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-muted hover:bg-slate-100 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
        ${currentPage === 1 ? 'disabled' : ''}>Trước</button>`;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="px-3 py-1 text-xs border border-primary rounded bg-primary text-white">${i}</button>`;
        } else {
            html += `<button onclick="load${capitalize(type)}(${i})" class="px-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-muted hover:bg-slate-100">${i}</button>`;
        }
    }
    
    // Next button
    html += `<button onclick="load${capitalize(type)}(${currentPage + 1})" 
        class="px-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-muted hover:bg-slate-100 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
        ${currentPage === totalPages ? 'disabled' : ''}>Sau</button>`;
    
    html += '</div>';
    container.innerHTML = html;
}

// ============= UTILITY FUNCTIONS =============

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
}

function formatDateShort(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTimeShort(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Chờ duyệt',
        'published': 'Đã duyệt',
        'rejected': 'Từ chối',
        'flagged': 'Gắn cờ',
        'deleted': 'Đã xóa',
        'under_review': 'Đang xem xét'
    };
    return statusMap[status] || status;
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Chờ duyệt</span>',
        'published': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">Đã duyệt</span>',
        'rejected': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger">Từ chối</span>',
        'flagged': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Gắn cờ</span>',
        'deleted': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500">Đã xóa</span>'
    };
    return badges[status] || `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${status}</span>`;
}

function getAIScoreBar(score) {
    if (!score && score !== 0) {
        return '<span class="text-xs text-muted">N/A</span>';
    }
    
    const percentage = Math.round(score);
    let colorClass = 'success';
    if (percentage >= 70) colorClass = 'warning';
    if (percentage >= 90) colorClass = 'danger';
    
    return `
        <div class="flex items-center gap-2">
            <div class="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="bg-${colorClass} h-full" style="width: ${percentage}%"></div>
            </div>
            <span class="text-xs font-semibold text-${colorClass}">${percentage}%</span>
        </div>
    `;
}

function getPriorityText(priority) {
    const priorityMap = {
        'high': 'Cao',
        'medium': 'Trung bình',
        'low': 'Thấp'
    };
    return priorityMap[priority] || priority;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function ensureNoticeHost() {
    let host = document.getElementById('admin-notice-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'admin-notice-host';
        host.className = 'fixed top-4 right-4 z-[1100] space-y-3 max-w-sm w-[90vw]';
        document.body.appendChild(host);
    }
    return host;
}

function showNotice(message, type = 'info', durationMs = 3500) {
    const host = ensureNoticeHost();
    const toneClass = {
        success: 'border-green-200 bg-green-50 text-green-800',
        error: 'border-red-200 bg-red-50 text-red-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        info: 'border-sky-200 bg-sky-50 text-sky-800'
    };

    const box = document.createElement('div');
    box.className = `rounded-lg border px-4 py-3 shadow-sm ${toneClass[type] || toneClass.info}`;
    box.innerHTML = `
        <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-base">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'}</span>
            <p class="text-sm font-medium leading-5">${escapeHtml(message)}</p>
        </div>
    `;
    host.appendChild(box);

    setTimeout(() => {
        box.remove();
    }, durationMs);
}

function showError(message) {
    showNotice(message, 'error');
}

function showSuccess(message) {
    showNotice(message, 'success');
}

function confirmAction(message, onConfirm) {
    let overlay = document.getElementById('admin-confirm-overlay');
    if (overlay) {
        overlay.remove();
    }

    overlay = document.createElement('div');
    overlay.id = 'admin-confirm-overlay';
    overlay.className = 'fixed inset-0 bg-black/40 z-[1200] flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
            <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-amber-500">help</span>
                <div class="flex-1">
                    <h4 class="text-base font-bold">Xác nhận thao tác</h4>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">${escapeHtml(message)}</p>
                </div>
            </div>
            <div class="mt-5 flex justify-end gap-2">
                <button id="confirm-cancel-btn" class="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600">Hủy</button>
                <button id="confirm-ok-btn" class="px-3 py-2 text-sm rounded-lg bg-primary text-white">Xác nhận</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeConfirm = () => overlay.remove();
    overlay.querySelector('#confirm-cancel-btn').addEventListener('click', closeConfirm);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeConfirm();
    });

    overlay.querySelector('#confirm-ok-btn').addEventListener('click', () => {
        closeConfirm();
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    });
}

// Quick action functions
function quickApprovePost(postId) {
    confirmAction('Bạn có chắc muốn duyệt bài viết này?', () => {
        const token = localStorage.getItem('token');

        fetch(`${API_BASE_URL}/moderation/review/${postId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ decision: 'approve' })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
                return;
            }
            showSuccess('Đã duyệt bài viết thành công');
            refreshAfterModerationAction();
        })
        .catch(error => {
            console.error('Error approving post:', error);
            showError('Không thể duyệt bài viết');
        });
    });
}

function quickRejectPost(postId) {
    showPostDetail(postId, { openReject: true });
}

function quickBanUser(userId) {
    showUserDetail(userId, { openBan: true });
}

function quickUnbanUser(userId) {
    confirmAction('Bạn có chắc muốn unban user này?', () => {
        const token = localStorage.getItem('token');

        fetch(`${API_BASE_URL}/moderation/users/${userId}/unban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
                return;
            }
            showSuccess('Đã unban user thành công');
            loadUsers(currentUserPage);
        })
        .catch(error => {
            console.error('Error unbanning user:', error);
            showError('Không thể unban user');
        });
    });
}

// Dashboard functions
function loadDashboard() {
    document.getElementById('mainContent').innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div class="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                    <p class="text-sm text-muted font-medium">Tổng bài viết</p>
                    <h3 id="overviewTotalPosts" class="text-3xl font-bold mt-2">0</h3>
                </div>
                <div class="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                    <p class="text-sm text-muted font-medium">Bài chờ duyệt</p>
                    <h3 id="overviewPendingPosts" class="text-3xl font-bold mt-2">0</h3>
                </div>
                <div class="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                    <p class="text-sm text-muted font-medium">Bài bị gắn cờ</p>
                    <h3 id="overviewFlaggedPosts" class="text-3xl font-bold mt-2">0</h3>
                </div>
                <div class="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                    <p class="text-sm text-muted font-medium">Người dùng bị ban</p>
                    <h3 id="overviewBannedUsers" class="text-3xl font-bold mt-2">0</h3>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold">Hoạt động kiểm duyệt gần đây</h3>
                    <button onclick="loadDashboard()" class="text-sm text-primary font-semibold hover:underline">Làm mới</button>
                </div>
                <div id="overviewRecentActivity" class="space-y-3">
                    <p class="text-sm text-muted">Đang tải dữ liệu...</p>
                </div>
            </div>
        </div>
    `;

    loadDashboardData();
}

async function loadDashboardData() {
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
        const [postsRes, pendingRes, flaggedRes, usersRes] = await Promise.all([
            fetch(`${API_BASE_URL}/moderation/posts?per_page=1`, { headers, credentials: 'include' }),
            fetch(`${API_BASE_URL}/moderation/posts?status=pending&per_page=1`, { headers, credentials: 'include' }),
            fetch(`${API_BASE_URL}/moderation/posts?status=flagged&per_page=1`, { headers, credentials: 'include' }),
            fetch(`${API_BASE_URL}/moderation/users?status=banned&per_page=1`, { headers, credentials: 'include' })
        ]);

        const [postsData, pendingData, flaggedData, usersData] = await Promise.all([
            postsRes.json(),
            pendingRes.json(),
            flaggedRes.json(),
            usersRes.json()
        ]);

        const totalPostsEl = document.getElementById('overviewTotalPosts');
        const pendingPostsEl = document.getElementById('overviewPendingPosts');
        const flaggedPostsEl = document.getElementById('overviewFlaggedPosts');
        const bannedUsersEl = document.getElementById('overviewBannedUsers');

        if (totalPostsEl) totalPostsEl.textContent = postsData.total || 0;
        if (pendingPostsEl) pendingPostsEl.textContent = pendingData.total || 0;
        if (flaggedPostsEl) flaggedPostsEl.textContent = flaggedData.total || 0;
        if (bannedUsersEl) bannedUsersEl.textContent = usersData.total || 0;

        renderRecentActivity(pendingData.posts || [], flaggedData.posts || []);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        const activityEl = document.getElementById('overviewRecentActivity');
        if (activityEl) {
            activityEl.innerHTML = '<p class="text-sm text-danger">Không thể tải dữ liệu tổng quan.</p>';
        }
    }
}

function renderRecentActivity(pendingPosts, flaggedPosts) {
    const activityEl = document.getElementById('overviewRecentActivity');
    if (!activityEl) return;

    const activityRows = [];

    pendingPosts.slice(0, 3).forEach(post => {
        activityRows.push({
            type: 'pending',
            postId: post.id,
            title: `Bài viết chờ duyệt #${post.id}`,
            subtitle: `@${post.author?.username || 'unknown'} • ${formatDateShort(post.created_at)}`
        });
    });

    flaggedPosts.slice(0, 3).forEach(post => {
        activityRows.push({
            type: 'flagged',
            postId: post.id,
            title: `Bài viết bị gắn cờ #${post.id}`,
            subtitle: `@${post.author?.username || 'unknown'} • AI: ${post.ai_confidence_score || 0}%`
        });
    });

    if (activityRows.length === 0) {
        activityEl.innerHTML = '<p class="text-sm text-muted">Hiện chưa có hoạt động đáng chú ý.</p>';
        return;
    }

    activityEl.innerHTML = activityRows
        .slice(0, 6)
        .map(item => `
            <div class="flex items-start justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                <div class="flex-1">
                    <p class="text-sm font-semibold">${item.title}</p>
                    <p class="text-xs text-muted mt-1">${item.subtitle}</p>
                </div>
                <div class="flex items-center gap-2 ml-4">
                    <span class="text-[10px] px-2 py-1 rounded-full ${item.type === 'flagged' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}">
                        ${item.type === 'flagged' ? 'Flagged' : 'Pending'}
                    </span>
                    <button onclick="showPostDetail(${item.postId})" class="text-xs px-2 py-1 rounded bg-primary text-white hover:bg-primary/90">Xem bài</button>
                </div>
            </div>
        `)
        .join('');
}

function loadReports() {
    document.getElementById('mainContent').innerHTML = `
        <div class="text-center py-12">
            <span class="material-symbols-outlined text-6xl text-warning">report</span>
            <h2 class="text-2xl font-bold mt-4">Báo cáo vi phạm đang được phát triển</h2>
            <p class="text-muted mt-2">Chức năng này sẽ sớm được cập nhật</p>
        </div>
    `;
}

function loadSettings() {
    document.getElementById('mainContent').innerHTML = `
        <div class="text-center py-12">
            <span class="material-symbols-outlined text-6xl text-muted">settings</span>
            <h2 class="text-2xl font-bold mt-4">Cấu hình hệ thống</h2>
            <p class="text-muted mt-2">Chức năng này sẽ sớm được cập nhật</p>
        </div>
    `;
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = 'none';
        // Clean up
        if (event.target.id === 'post-modal') {
            selectedPost = null;
            document.getElementById('reject-reason-container').style.display = 'none';
            document.getElementById('mute-dialog').style.display = 'none';
        } else if (event.target.id === 'user-modal') {
            selectedUser = null;
            document.getElementById('ban-dialog').style.display = 'none';
        }
    }
}
