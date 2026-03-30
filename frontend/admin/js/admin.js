// Admin Panel JavaScript
const API_BASE_URL = (typeof API_URL !== 'undefined' && API_URL)
    ? API_URL
    : `${window.location.protocol}//${window.location.hostname}:5000/api`;

let currentTab = 'posts';
let currentPostPage = 1;
let currentUserPage = 1;
let currentQueuePage = 1;
let currentReportPage = 1;
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
    const modalMeta = document.getElementById('modalPostMeta');
    const queueItem = post.queue_item || null;
    const aiScore = Number(post.ai_confidence_score || 0);
    const risk = getReviewRiskMeta(aiScore);

    if (modalMeta) {
        const queueSource = queueItem ? getQueueSourceLabel(queueItem.source) : 'Kiểm duyệt tiêu chuẩn';
        modalMeta.textContent = `Post #${post.id || 'N/A'} • ${queueSource} • ${formatDate(post.created_at)}`;
    }
    
    container.innerHTML = `
        <div class="p-6 lg:p-8">
            <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <section class="xl:col-span-8 space-y-5">
                    <div class="review-metric rounded-xl p-5">
                        <div class="flex flex-wrap items-center gap-4">
                            <img src="${post.author?.avatar_url || '/user/images/default-avatar.png'}" 
                                alt="Avatar" class="w-14 h-14 rounded-full border border-slate-200 dark:border-slate-700 object-cover">
                            <div class="min-w-0 flex-1">
                                <p class="text-lg font-bold truncate">${post.author?.full_name || post.author?.username || 'Unknown'}</p>
                                <p class="text-sm text-muted truncate">@${post.author?.username || 'unknown'} • ${post.author?.email || 'N/A'}</p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                ${getStatusBadge(post.author?.account_status || 'active')}
                                ${post.author?.warning_count > 0 ? `<span class="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full">⚠ ${post.author.warning_count} vi phạm</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
                            <h5 class="text-xs font-bold text-muted uppercase tracking-wider">Nội dung bài viết</h5>
                        </div>
                        <div class="p-5 space-y-4">
                            <p class="text-base whitespace-pre-wrap">${escapeHtml(post.caption || 'Không có nội dung')}</p>
                            ${post.media && post.media.length > 0 ? `
                                <div class="grid gap-3">
                                    ${post.media.map(media => 
                                        media.media_type === 'image' ? 
                                            `<img src="${media.media_url}" alt="Media" class="rounded-xl max-h-[420px] object-cover border border-slate-200 dark:border-slate-700">` : 
                                            `<video src="${media.media_url}" controls class="rounded-xl max-h-[420px] w-full border border-slate-200 dark:border-slate-700"></video>`
                                    ).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div class="review-metric rounded-xl p-4">
                            <p class="text-xs text-muted uppercase">Trạng thái</p>
                            <div class="mt-2">${getStatusBadge(post.status)}</div>
                        </div>
                        <div class="review-metric rounded-xl p-4">
                            <p class="text-xs text-muted uppercase">AI Confidence</p>
                            <div class="mt-2">${getAIScoreBar(post.ai_confidence_score)}</div>
                        </div>
                        <div class="review-metric rounded-xl p-4">
                            <p class="text-xs text-muted uppercase">Ngày tạo</p>
                            <p class="text-sm font-semibold mt-2">${formatDate(post.created_at)}</p>
                        </div>
                        <div class="review-metric rounded-xl p-4">
                            <p class="text-xs text-muted uppercase">Tương tác</p>
                            <p class="text-sm font-semibold mt-2">👍 ${post.like_count || 0} • 💬 ${post.comment_count || 0}</p>
                        </div>
                    </div>

                    ${post.ai_flag_reasons && post.ai_flag_reasons.length > 0 ? `
                        <div class="rounded-xl border border-warning/30 bg-warning/5 p-4">
                            <p class="text-sm font-bold text-warning mb-2">Tín hiệu AI cần lưu ý</p>
                            <ul class="list-disc list-inside space-y-1">
                                ${post.ai_flag_reasons.map(flag => `<li class="text-sm">${escapeHtml(flag)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    ${post.moderator_reason ? `
                        <div class="rounded-xl border border-danger/30 bg-danger/5 p-4">
                            <p class="text-sm font-bold text-danger mb-1">Lịch sử từ chối gần nhất</p>
                            <p class="text-sm">${escapeHtml(post.moderator_reason)}</p>
                        </div>
                    ` : ''}
                </section>

                <aside class="xl:col-span-4">
                    <div class="sticky top-4 space-y-4">
                        <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                            <p class="text-xs font-bold uppercase tracking-wider text-muted">Decision Brief</p>
                            <div class="mt-3 flex items-center justify-between">
                                <span class="text-sm text-muted">Mức rủi ro nội dung</span>
                                <span class="text-xs font-bold px-2 py-1 rounded-full ${risk.badgeClass}">${risk.label}</span>
                            </div>
                            <div class="mt-2 text-sm">Điểm AI: <span class="font-bold">${aiScore.toFixed(0)}</span>/100</div>
                            <div class="mt-2 text-sm">Nguồn queue: <span class="font-semibold">${queueItem ? getQueueSourceLabel(queueItem.source) : 'Không có'}</span></div>
                            <div class="mt-2 text-sm">Độ ưu tiên: <span class="font-semibold">${queueItem ? (queueItem.priority || 0) : 0}</span></div>
                        </div>

                        <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                            <p class="text-xs font-bold uppercase tracking-wider text-muted">Checklist duyệt</p>
                            <ul class="mt-3 space-y-2 text-sm">
                                <li class="flex items-start gap-2"><span class="material-symbols-outlined text-base text-primary">check_circle</span><span>Xác minh ngữ cảnh nội dung và media đính kèm.</span></li>
                                <li class="flex items-start gap-2"><span class="material-symbols-outlined text-base text-primary">check_circle</span><span>Đối chiếu với các tín hiệu AI hoặc báo cáo người dùng.</span></li>
                                <li class="flex items-start gap-2"><span class="material-symbols-outlined text-base text-primary">check_circle</span><span>Ghi rõ lý do nếu từ chối hoặc mute để audit sau này.</span></li>
                            </ul>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    `;
}

function getReviewRiskMeta(aiScore) {
    if (aiScore >= 80) {
        return {
            label: 'Rủi ro cao',
            badgeClass: 'bg-danger/10 text-danger'
        };
    }

    if (aiScore >= 50) {
        return {
            label: 'Rủi ro trung bình',
            badgeClass: 'bg-warning/10 text-warning'
        };
    }

    return {
        label: 'Rủi ro thấp',
        badgeClass: 'bg-success/10 text-success'
    };
}

function getQueueSourceLabel(source) {
    const labels = {
        ai_flagged: 'AI phát hiện',
        user_report: 'Người dùng báo cáo',
        manual_review: 'Review thủ công',
        appeal: 'Kháng nghị'
    };

    return labels[source] || 'Không xác định';
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
                            ${(user.account_status === 'banned' || user.account_status === 'warning') && user.ban_until ? 
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
        'deleted': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500">Đã xóa</span>',
        'active': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">Hoạt động</span>',
        'warning': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Muted tạm thời</span>',
        'banned': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger">Bị cấm</span>'
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

function showExportFormatDialog() {
    let overlay = document.getElementById('admin-export-overlay');
    if (overlay) {
        overlay.remove();
    }

    overlay = document.createElement('div');
    overlay.id = 'admin-export-overlay';
    overlay.className = 'fixed inset-0 bg-slate-950/45 z-[1200] flex items-center justify-center p-4 backdrop-blur-[2px]';
    overlay.innerHTML = `
        <div class="w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div class="px-6 py-5 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-emerald-500/10 border-b border-slate-200 dark:border-slate-800">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">Workflow moi: Xem truoc truoc khi xuat</div>
                        <h4 class="text-lg md:text-xl font-extrabold mt-2">Xem truoc du lieu xuat</h4>
                        <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">Bao cao se gom nguoi dung, bai viet, thoi gian dang, trang thai, diem AI, tuong tac, thong tin duyet va anh dau tien cua bai viet (neu co). Video se khong dua vao file xuat.</p>
                    </div>
                    <button id="export-close-top-btn" class="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800" title="Dong">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>

            <div class="px-6 py-5 grid grid-cols-1 xl:grid-cols-12 gap-5 max-h-[76vh] overflow-auto">
                <section class="xl:col-span-8 space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <p class="text-sm font-semibold">Bang xem truoc (10 dong dau theo bo loc hien tai)</p>
                        <button id="refresh-export-preview-btn" class="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <span class="material-symbols-outlined text-base">refresh</span>
                            Lam moi xem truoc
                        </button>
                    </div>
                    <div id="export-preview-wrap" class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                        <div class="text-center py-10 text-sm text-muted">Dang tai du lieu xem truoc...</div>
                    </div>
                </section>

                <aside class="xl:col-span-4 space-y-4">
                    <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40">
                        <p class="text-xs uppercase tracking-wider text-muted font-semibold">Bo loc hien tai</p>
                        <div class="mt-3 text-sm space-y-2">
                            <div class="flex items-center justify-between gap-3">
                                <span class="text-muted">Trang thai</span>
                                <span id="export-filter-status" class="font-semibold">Tat ca</span>
                            </div>
                            <div class="flex items-center justify-between gap-3">
                                <span class="text-muted">Tu khoa</span>
                                <span id="export-filter-search" class="font-semibold truncate max-w-[180px] text-right">Khong co</span>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p class="text-xs uppercase tracking-wider text-muted font-semibold">Dinh dang xuat</p>
                        <div class="mt-3 grid grid-cols-2 gap-2">
                            <button id="choose-pdf-btn" data-format="pdf" class="export-format-btn px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-white">PDF</button>
                            <button id="choose-docx-btn" data-format="docx" class="export-format-btn px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600">DOCX</button>
                        </div>
                        <p class="text-xs text-muted mt-3" id="export-format-hint">PDF: de chia se nhanh, giu bo cuc dong bo va kem thumbnail anh.</p>
                    </div>

                    <div class="flex flex-col sm:flex-row xl:flex-col gap-2">
                        <button id="run-export-btn" class="px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark">Xuat file ngay</button>
                        <button id="export-cancel-btn" class="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-medium">Huy</button>
                    </div>
                </aside>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const statusEl = document.getElementById('post-status-filter');
    const searchEl = document.getElementById('post-search') || document.getElementById('searchInput');
    const status = statusEl ? (statusEl.value || '').trim() : '';
    const search = searchEl ? (searchEl.value || '').trim() : '';
    let selectedFormat = 'pdf';

    const filterStatusNode = overlay.querySelector('#export-filter-status');
    const filterSearchNode = overlay.querySelector('#export-filter-search');
    if (filterStatusNode) {
        filterStatusNode.textContent = status ? status : 'Tat ca';
    }
    if (filterSearchNode) {
        filterSearchNode.textContent = search ? search : 'Khong co';
    }

    const closeDialog = () => overlay.remove();
    const refreshPreview = async () => {
        try {
            await renderExportPreview(overlay, { status, search });
        } catch (error) {
            console.error('Export preview error:', error);
            const previewWrap = overlay.querySelector('#export-preview-wrap');
            if (previewWrap) {
                previewWrap.innerHTML = '<div class="text-center py-10 text-sm text-danger">Khong the tai xem truoc. Vui long thu lai.</div>';
            }
            showError(error.message || 'Khong the tai du lieu xem truoc');
        }
    };

    overlay.querySelector('#export-cancel-btn').addEventListener('click', closeDialog);
    overlay.querySelector('#export-close-top-btn').addEventListener('click', closeDialog);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeDialog();
    });

    overlay.querySelector('#refresh-export-preview-btn').addEventListener('click', refreshPreview);

    const formatButtons = overlay.querySelectorAll('.export-format-btn');
    const formatHint = overlay.querySelector('#export-format-hint');
    const updateFormatUI = (format) => {
        selectedFormat = format;
        formatButtons.forEach(btn => {
            const active = btn.dataset.format === format;
            btn.classList.toggle('bg-primary', active);
            btn.classList.toggle('text-white', active);
            btn.classList.toggle('border', !active);
            btn.classList.toggle('border-slate-300', !active);
            btn.classList.toggle('dark:border-slate-600', !active);
        });

        if (formatHint) {
            formatHint.textContent = format === 'pdf'
                ? 'PDF: để chia sẻ nhanh, giữ bố cục đồng bộ và kèm thumbnail ảnh.'
                : 'DOCX: để chỉnh sửa tiếp trong Word, có mục ảnh minh họa để đối chiếu.';
        }
    };

    formatButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            updateFormatUI(btn.dataset.format || 'pdf');
        });
    });

    overlay.querySelector('#run-export-btn').addEventListener('click', async () => {
        const exportBtn = overlay.querySelector('#run-export-btn');
        const originalText = exportBtn.textContent;
        exportBtn.disabled = true;
        exportBtn.textContent = 'Dang xuat...';

        try {
            await exportPostsData(selectedFormat);
            closeDialog();
        } finally {
            exportBtn.disabled = false;
            exportBtn.textContent = originalText;
        }
    });

    updateFormatUI(selectedFormat);
    refreshPreview();
}

async function renderExportPreview(overlay, filters = {}) {
    const previewWrap = overlay.querySelector('#export-preview-wrap');
    if (!previewWrap) return;

    previewWrap.innerHTML = '<div class="text-center py-10 text-sm text-muted">Dang dong bo du lieu xem truoc...</div>';

    const previewData = await fetchExportPreviewData(filters);
    const rows = previewData.items || [];

    if (!rows.length) {
        previewWrap.innerHTML = '<div class="text-center py-10 text-sm text-muted">Khong co du lieu phu hop voi bo loc hien tai.</div>';
        return;
    }

    previewWrap.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                        <th class="px-4 py-3 text-xs font-bold text-muted uppercase">Người dùng</th>
                        <th class="px-4 py-3 text-xs font-bold text-muted uppercase">Nội dung</th>
                        <th class="px-4 py-3 text-xs font-bold text-muted uppercase">Ngày đăng</th>
                        <th class="px-4 py-3 text-xs font-bold text-muted uppercase">Trạng thái</th>
                        <th class="px-4 py-3 text-xs font-bold text-muted uppercase">AI</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${rows.map(post => `
                        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                            <td class="px-4 py-3">
                                <p class="text-sm font-semibold">${escapeHtml(post.author?.full_name || post.author?.username || 'Unknown')}</p>
                                <p class="text-xs text-muted">@${escapeHtml(post.author?.username || 'unknown')}</p>
                            </td>
                            <td class="px-4 py-3">
                                <p class="text-sm max-w-[320px] truncate">${escapeHtml(post.caption || 'Không có nội dung')}</p>
                            </td>
                            <td class="px-4 py-3 text-xs text-muted">
                                ${formatDateShort(post.created_at)} ${formatTimeShort(post.created_at)}
                            </td>
                            <td class="px-4 py-3">${getExportStatusBadge(post.status)}</td>
                            <td class="px-4 py-3 text-sm font-semibold">${post.ai_confidence_score || 0}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 text-xs text-muted">
            Đang xem ${rows.length} dòng đầu tiên trong tổng ${previewData.total || rows.length} bản ghi phù hợp.
        </div>
    `;
}

async function fetchExportPreviewData(filters = {}) {
    const token = localStorage.getItem('token');
    const status = (filters.status || '').trim();
    const search = (filters.search || '').trim();

    let url = `${API_BASE_URL}/moderation/posts?page=1&per_page=10`;
    if (status) {
        url += `&status=${encodeURIComponent(status)}`;
    }
    if (search) {
        url += `&search=${encodeURIComponent(search)}`;
    }

    const response = await fetch(url, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) {
        throw new Error('Không thể tải dữ liệu xem trước');
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error);
    }

    return {
        items: data.posts || [],
        total: data.total || 0
    };
}

function getExportStatusBadge(status) {
    const map = {
        pending: 'bg-warning/10 text-warning',
        published: 'bg-success/10 text-success',
        rejected: 'bg-danger/10 text-danger',
        flagged: 'bg-amber-100 text-amber-700',
        under_review: 'bg-sky-100 text-sky-700',
        deleted: 'bg-slate-200 text-slate-600'
    };

    const labels = {
        pending: 'Cho duyet',
        published: 'Da duyet',
        rejected: 'Tu choi',
        flagged: 'Gan co',
        under_review: 'Dang review',
        deleted: 'Da xoa'
    };

    const cls = map[status] || 'bg-slate-200 text-slate-600';
    const label = labels[status] || (status || 'Không rõ');
    return `<span class="inline-flex px-2 py-1 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

async function exportPostsData(format = 'pdf') {
    try {
        const token = localStorage.getItem('token');
        const statusEl = document.getElementById('post-status-filter');
        const searchEl = document.getElementById('post-search') || document.getElementById('searchInput');
        const status = statusEl ? (statusEl.value || '').trim() : '';
        const search = searchEl ? (searchEl.value || '').trim() : '';

        let url = `${API_BASE_URL}/moderation/posts/export?format=${encodeURIComponent(format)}&limit=1000`;
        if (status) {
            url += `&status=${encodeURIComponent(status)}`;
        }
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
            let errorMessage = 'Không thể xuất dữ liệu';
            try {
                const err = await response.json();
                errorMessage = err.error || errorMessage;
            } catch (_) {
                // Keep default error message
            }
            showError(errorMessage);
            return;
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;

        const disposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
        const fallback = `moderation_export.${format === 'docx' ? 'docx' : 'pdf'}`;
        link.download = filenameMatch ? filenameMatch[1] : fallback;

        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        showSuccess(`Xuất dữ liệu ${format.toUpperCase()} thành công`);
    } catch (error) {
        console.error('Export data error:', error);
        showError('Không thể xuất dữ liệu');
    }
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

            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div class="xl:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-lg font-bold">Xu hướng xử lý bài viết</h3>
                        <span class="text-xs text-muted">Tổng hợp toàn hệ thống</span>
                    </div>
                    <div id="moderationOverviewChart" class="h-72 flex items-end gap-4 md:gap-6"></div>
                </div>

                <div class="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 class="text-lg font-bold mb-4">Tỷ lệ xử lý</h3>
                    <div id="moderationOverviewSummary" class="space-y-3 text-sm">
                        <p class="text-muted">Đang tải dữ liệu...</p>
                    </div>
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

        const moderationStats = await getModerationOverviewStats(headers);
        renderModerationOverviewChart(moderationStats);
        renderModerationOverviewSummary(moderationStats);

        renderRecentActivity(pendingData.posts || [], flaggedData.posts || []);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        const activityEl = document.getElementById('overviewRecentActivity');
        if (activityEl) {
            activityEl.innerHTML = '<p class="text-sm text-danger">Không thể tải dữ liệu tổng quan.</p>';
        }
    }
}

async function getModerationOverviewStats(headers) {
    const perPage = 100;
    const firstRes = await fetch(`${API_BASE_URL}/moderation/posts?page=1&per_page=${perPage}`, {
        headers,
        credentials: 'include'
    });

    if (!firstRes.ok) {
        throw new Error('Không thể tải dữ liệu bài viết để thống kê');
    }

    const firstData = await firstRes.json();
    const pages = firstData.pages || 1;
    const allPosts = [...(firstData.posts || [])];

    if (pages > 1) {
        const remainingRequests = [];
        for (let page = 2; page <= pages; page += 1) {
            remainingRequests.push(
                fetch(`${API_BASE_URL}/moderation/posts?page=${page}&per_page=${perPage}`, {
                    headers,
                    credentials: 'include'
                }).then(res => res.json())
            );
        }

        const remainingPages = await Promise.all(remainingRequests);
        remainingPages.forEach(pageData => {
            if (Array.isArray(pageData.posts)) {
                allPosts.push(...pageData.posts);
            }
        });
    }

    const stats = {
        requested: 0,
        approvedByAdmin: 0,
        approvedByAI: 0,
        rejected: 0
    };

    allPosts.forEach(post => {
        if (post.status === 'pending' || post.status === 'under_review' || post.status === 'flagged') {
            stats.requested += 1;
        }

        if (post.moderation_status === 'moderator_approved' || post.moderator_decision === 'approve') {
            stats.approvedByAdmin += 1;
        }

        if (post.moderation_status === 'ai_approved') {
            stats.approvedByAI += 1;
        }

        if (post.status === 'rejected' || post.moderation_status === 'moderator_rejected' || post.moderator_decision === 'reject') {
            stats.rejected += 1;
        }
    });

    return stats;
}

function renderModerationOverviewChart(stats) {
    const chartEl = document.getElementById('moderationOverviewChart');
    if (!chartEl) return;

    const items = [
        { key: 'requested', label: 'Yêu cầu đăng', value: stats.requested, color: 'bg-cyan-500', softColor: 'bg-cyan-200/40' },
        { key: 'approvedByAdmin', label: 'Duyệt bởi Admin', value: stats.approvedByAdmin, color: 'bg-emerald-500', softColor: 'bg-emerald-200/40' },
        { key: 'approvedByAI', label: 'Duyệt bởi AI', value: stats.approvedByAI, color: 'bg-indigo-500', softColor: 'bg-indigo-200/40' },
        { key: 'rejected', label: 'Từ chối', value: stats.rejected, color: 'bg-rose-500', softColor: 'bg-rose-200/40' }
    ];

    const maxValue = Math.max(...items.map(item => item.value), 1);

    chartEl.innerHTML = items
        .map(item => {
            const height = Math.max(12, Math.round((item.value / maxValue) * 220));
            return `
                <div class="flex-1 min-w-0 flex flex-col items-center justify-end">
                    <p class="text-sm font-bold mb-2">${item.value}</p>
                    <div class="w-full max-w-24 h-56 rounded-lg ${item.softColor} flex items-end overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div class="w-full ${item.color}" style="height:${height}px"></div>
                    </div>
                    <p class="text-[11px] md:text-xs text-muted text-center mt-2 leading-tight">${item.label}</p>
                </div>
            `;
        })
        .join('');
}

function renderModerationOverviewSummary(stats) {
    const summaryEl = document.getElementById('moderationOverviewSummary');
    if (!summaryEl) return;

    const totalHandled = stats.approvedByAdmin + stats.approvedByAI + stats.rejected;
    const aiRate = totalHandled > 0 ? Math.round((stats.approvedByAI / totalHandled) * 100) : 0;
    const adminRate = totalHandled > 0 ? Math.round((stats.approvedByAdmin / totalHandled) * 100) : 0;

    summaryEl.innerHTML = `
        <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <span class="text-muted">Yêu cầu đang chờ</span>
            <span class="font-bold text-cyan-600">${stats.requested}</span>
        </div>
        <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <span class="text-muted">Duyệt bởi admin</span>
            <span class="font-bold text-emerald-600">${stats.approvedByAdmin}</span>
        </div>
        <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <span class="text-muted">Duyệt bởi AI</span>
            <span class="font-bold text-indigo-600">${stats.approvedByAI}</span>
        </div>
        <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <span class="text-muted">Bị từ chối</span>
            <span class="font-bold text-rose-600">${stats.rejected}</span>
        </div>
        <div class="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-muted space-y-1">
            <p>Tỉ lệ duyệt AI: <span class="font-semibold text-indigo-600">${aiRate}%</span></p>
            <p>Tỉ lệ duyệt Admin: <span class="font-semibold text-emerald-600">${adminRate}%</span></p>
        </div>
    `;
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

function loadReports(page = 1) {
    return loadReportItems(page);
}

async function loadReportItems(page = 1) {
    currentReportPage = page;

    const statusFilter = document.getElementById('post-status-filter');
    const rawStatus = statusFilter ? statusFilter.value : '';
    const allowedStatuses = ['pending', 'reviewing', 'resolved', 'dismissed', 'all'];
    const status = allowedStatuses.includes(rawStatus) ? rawStatus : '';
    const searchInput = document.getElementById('post-search');
    const search = searchInput ? (searchInput.value || '').trim() : '';

    try {
        const token = localStorage.getItem('token');
        let url = `${API_BASE_URL}/moderation/reports?page=${page}&per_page=10`;
        if (status) {
            url += `&status=${encodeURIComponent(status)}`;
        }
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url, {
            credentials: 'include',
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

        displayReports(data.reports || []);
        displayPagination('reports', data.current_page || 1, data.pages || 1);
    } catch (error) {
        console.error('Error loading reports:', error);
        showError('Không thể tải danh sách báo cáo');
    }
}

function displayReports(reports) {
    const container = document.getElementById('postsTable');

    if (!container) {
        return;
    }

    if (!reports || reports.length === 0) {
        container.innerHTML = '<div class="text-center py-12"><p class="text-muted">Không có báo cáo nào</p></div>';
        return;
    }

    const tableHTML = `
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Người báo cáo</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Bài viết</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Lý do</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Trạng thái</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ngày</th>
                    <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Hành động</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${reports.map(report => `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <img src="${report.reporter?.avatar_url || '/user/images/default-avatar.png'}" alt="Reporter" class="w-8 h-8 rounded-full bg-slate-100 object-cover"/>
                                <div>
                                    <p class="text-sm font-bold">${escapeHtml(report.reporter?.full_name || report.reporter?.username || 'Ẩn danh')}</p>
                                    <p class="text-xs text-muted">ID: ${report.reporter_id}</p>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate">${escapeHtml(report.post?.caption || 'Không có nội dung')}</p>
                            <p class="text-xs text-muted">Post ID: ${report.target_id}</p>
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-sm max-w-xs break-words">${escapeHtml(report.description || 'Không có mô tả')}</p>
                        </td>
                        <td class="px-6 py-4">
                            ${getReportStatusBadge(report.status)}
                        </td>
                        <td class="px-6 py-4">
                            <p class="text-xs text-muted">${formatDateShort(report.created_at)}</p>
                            <p class="text-[10px] text-muted">${formatTimeShort(report.created_at)}</p>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center justify-end gap-2">
                                <button onclick="showPostDetail(${report.target_id})" class="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="Xem bài viết">
                                    <span class="material-symbols-outlined">visibility</span>
                                </button>
                                ${report.status === 'pending' || report.status === 'reviewing' ? `
                                    <button onclick="approveReport(${report.id})" class="p-1.5 text-danger hover:bg-danger/10 rounded-lg" title="Chấp thuận báo cáo">
                                        <span class="material-symbols-outlined">gpp_bad</span>
                                    </button>
                                    <button onclick="dismissReport(${report.id})" class="p-1.5 text-success hover:bg-success/10 rounded-lg" title="Bác báo cáo">
                                        <span class="material-symbols-outlined">check_circle</span>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <p class="text-xs text-muted font-medium">Hiển thị ${reports.length} báo cáo</p>
            <div id="reports-pagination"></div>
        </div>
    `;

    container.innerHTML = tableHTML;
}

function getReportStatusBadge(status) {
    const badges = {
        pending: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Chờ duyệt</span>',
        reviewing: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Đang xem</span>',
        resolved: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger">Đã chấp thuận</span>',
        dismissed: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">Đã bác</span>'
    };

    return badges[status] || `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${escapeHtml(status || 'unknown')}</span>`;
}

function approveReport(reportId) {
    const reason = window.prompt('Nhập lý do khóa bài viết khi chấp thuận báo cáo:');
    if (!reason || !reason.trim()) {
        showError('Bạn cần nhập lý do để chấp thuận báo cáo');
        return;
    }

    submitReportReview(reportId, 'approve', reason.trim());
}

function dismissReport(reportId) {
    confirmAction('Bạn có chắc muốn bác báo cáo này?', () => {
        submitReportReview(reportId, 'dismiss', 'Report dismissed by admin');
    });
}

function submitReportReview(reportId, decision, note) {
    const token = localStorage.getItem('token');

    fetch(`${API_BASE_URL}/moderation/reports/${reportId}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ decision, note })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError(data.error);
            return;
        }

        if (decision === 'approve') {
            showSuccess('Đã chấp thuận báo cáo và khóa bài viết');
        } else {
            showSuccess('Đã bác báo cáo');
        }

        loadReportItems(currentReportPage);
        updateStats();
    })
    .catch(error => {
        console.error('Error reviewing report:', error);
        showError('Không thể xử lý báo cáo');
    });
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
