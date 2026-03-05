// Admin Panel JavaScript
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
        const response = await fetch(`${API_BASE_URL}/api/admin/check-session`, {
            credentials: 'include' // Important for sending session cookie
        });
        
        if (response.status === 401) {
            // Not authenticated, redirect to login
            window.location.href = '/admin/login';
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
        window.location.href = '/admin/login';
        return false;
    }
}

async function logout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        try {
            await fetch(`${API_BASE_URL}/api/admin/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        // Also clear any JWT token if exists
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        window.location.href = '/admin/login';
    }
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
            window.location.href = '/admin/login';
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

function showPostDetail(postId) {
    // Load post detail
    const token = localStorage.getItem('token');
    
    fetch(`${API_BASE_URL}/posts/${postId}`, {
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
        
        selectedPost = data;
        displayPostDetail(data);
        document.getElementById('post-modal').style.display = 'flex';
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

function approvePost() {
    if (!selectedPost) return;
    
    if (!confirm('Bạn có chắc muốn duyệt bài viết này?')) return;
    
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
        loadPosts(currentPostPage);
    })
    .catch(error => {
        console.error('Error approving post:', error);
        showError('Không thể duyệt bài viết');
    });
}

function rejectPost() {
    document.getElementById('reject-reason-container').style.display = 'block';
}

function submitReject() {
    if (!selectedPost) return;
    
    const reason = document.getElementById('reject-reason').value.trim();
    
    if (!reason) {
        alert('Vui lòng nhập lý do từ chối');
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
        loadPosts(currentPostPage);
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
        alert('Vui lòng nhập lý do mute');
        return;
    }
    
    if (!confirm(`Bạn có chắc muốn mute user này trong ${duration} giờ?`)) return;
    
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

function showUserDetail(userId) {
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
        alert('Vui lòng nhập lý do ban');
        return;
    }
    
    const durationText = duration ? `${duration} giờ` : 'vĩnh viễn';
    
    if (!confirm(`Bạn có chắc muốn ban user này ${durationText}?`)) return;
    
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
}

function unbanUser() {
    if (!selectedUser) return;
    
    if (!confirm('Bạn có chắc muốn unban user này?')) return;
    
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
}

// ============= QUEUE MANAGEMENT =============

async function loadQueue(page = 1) {
    currentQueuePage = page;
    
    try {
        const token = localStorage.getItem('token');
        const url = `${API_BASE_URL}/moderation/queue?page=${page}&per_page=10`;
        
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
    const badges = {
        'high': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger">Cao</span>',
        'medium': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Trung bình</span>',
        'low': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">Thấp</span>'
    };
    return badges[priority] || badges['low'];
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

function showError(message) {
    alert('❌ Lỗi: ' + message);
}

function showSuccess(message) {
    alert('✅ ' + message);
}

// Quick action functions
function quickApprovePost(postId) {
    if (!confirm('Bạn có chắc muốn duyệt bài viết này?')) return;
    
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
        loadPosts(currentPostPage);
    })
    .catch(error => {
        console.error('Error approving post:', error);
        showError('Không thể duyệt bài viết');
    });
}

function quickRejectPost(postId) {
    const reason = prompt('Nhập lý do từ chối:');
    if (!reason) return;
    
    const token = localStorage.getItem('token');
    
    fetch(`${API_BASE_URL}/moderation/review/${postId}`, {
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
        loadPosts(currentPostPage);
    })
    .catch(error => {
        console.error('Error rejecting post:', error);
        showError('Không thể từ chối bài viết');
    });
}

function quickBanUser(userId) {
    const reason = prompt('Nhập lý do ban user (để trống = vĩnh viễn):');
    if (reason === null) return;
    
    const token = localStorage.getItem('token');
    
    fetch(`${API_BASE_URL}/moderation/users/${userId}/ban`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            reason: reason || 'Vi phạm quy định',
            duration_hours: 168 // Default 1 week
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError(data.error);
            return;
        }
        showSuccess('Đã ban user thành công');
        loadUsers(currentUserPage);
    })
    .catch(error => {
        console.error('Error banning user:', error);
        showError('Không thể ban user');
    });
}

function quickUnbanUser(userId) {
    if (!confirm('Bạn có chắc muốn unban user này?')) return;
    
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
}

// Dashboard functions
function loadDashboard() {
    document.getElementById('mainContent').innerHTML = `
        <div class="text-center py-12">
            <span class="material-symbols-outlined text-6xl text-primary">dashboard</span>
            <h2 class="text-2xl font-bold mt-4">Dashboard đang được phát triển</h2>
            <p class="text-muted mt-2">Vui lòng chọn chức năng khác từ menu bên trái</p>
        </div>
    `;
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
