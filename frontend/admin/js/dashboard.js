/**
 * Logic riêng cho trang Dashboard của Admin.
 *
 * - Fetches và hiển thị các số liệu thống kê tổng quan.
 * - Hiển thị danh sách các bài viết gần đây.
 * - Tự động cập nhật badge cho hàng đợi kiểm duyệt.
 */

// Đảm bảo các hàm và biến dùng chung đã được định nghĩa (ví dụ: trong admin.js)
// const API_BASE_URL = '...';
// function checkAuth() { ... }
// function getStatusBadge(status) { ... }
// function formatDateShort(dateString) { ... }
// function escapeHtml(unsafe) { ... }

/**
 * Chuyển đổi giữa chế độ Sáng và Tối.
 */
function toggleDarkMode() {
    const html = document.documentElement;
    const icon = document.getElementById('darkModeIcon');
    html.classList.toggle('dark');
    if (html.classList.contains('dark')) {
        icon.textContent = 'light_mode';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.textContent = 'dark_mode';
        localStorage.setItem('theme', 'light');
    }
}

/**
 * Lấy và cập nhật số lượng bài viết đang chờ duyệt trên badge.
 */
async function refreshQueueBadge() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/moderation/posts?status=pending&per_page=1`, {
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const data = await response.json();
        const badge = document.getElementById('queueCount');
        if (badge) {
            const currentCount = badge.textContent;
            const newCount = (data.total || 0).toString();
            badge.textContent = newCount;

            // Thêm hiệu ứng nếu có bài viết mới
            if (newCount > 0 && currentCount !== newCount) {
                badge.classList.add('animate-bounce');
                setTimeout(() => badge.classList.remove('animate-bounce'), 1000);
            }
        }
    } catch (error) {
        console.error('Failed to refresh queue badge:', error);
    }
}

/**
 * Tạo HTML cho một hàng trong bảng bài viết.
 * @param {object} post - Đối tượng bài viết.
 * @returns {string} - Chuỗi HTML của một `<tr>`.
 */
function createPostRow(post) {
    const author = post.author || {};
    const avatarUrl = author.avatar_url || '/user/images/default-avatar.png';
    const username = author.username || 'Người dùng ẩn danh';
    const fullName = author.full_name ? `<p class="text-[10px] text-muted truncate">${escapeHtml(author.full_name)}</p>` : '';
    const caption = post.caption ? escapeHtml(post.caption) : '<span class="text-muted italic">Không có nội dung</span>';
    const statusBadge = typeof getStatusBadge === 'function' ? getStatusBadge(post.status) : `<span class="px-2 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800">${post.status}</span>`;
    const createdAt = typeof formatDateShort === 'function' ? formatDateShort(post.created_at) : new Date(post.created_at).toLocaleDateString('vi-VN');

    return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <img src="${avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full bg-slate-100 object-cover border border-slate-200 dark:border-slate-700">
                    <div>
                        <p class="text-sm font-bold truncate">@${username}</p>
                        ${fullName}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <p class="text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate">${caption}</p>
            </td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4 text-sm text-muted">${createdAt}</td>
        </tr>
    `;
}

/**
 * Hiển thị giao diện Dashboard với dữ liệu đã được fetch.
 * @param {object} data - Dữ liệu thống kê và bài viết.
 */
function renderDashboardUI(data) {
    const container = document.getElementById('mainContent');
    if (!container) return;

    const recentPosts = data.recentPosts || [];
    const postRows = recentPosts.length > 0
        ? recentPosts.map(createPostRow).join('')
        : `<tr><td colspan="4" class="px-6 py-8 text-center text-muted font-medium">Chưa có bài viết nào</td></tr>`;

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-2">
            <!-- Card: Tổng bài viết -->
            <div class="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 transition-transform hover:-translate-y-1 duration-300">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <span class="material-symbols-outlined">article</span>
                    </div>
                    <span class="text-sm font-medium text-success flex items-center"><span class="material-symbols-outlined text-sm mr-1">trending_up</span>Tất cả</span>
                </div>
                <p class="text-muted text-sm font-medium uppercase tracking-wider mb-1">Tổng bài viết</p>
                <h3 class="text-3xl font-bold text-slate-900 dark:text-white">${data.totalPosts}</h3>
            </div>
            <!-- Card: Chờ duyệt -->
            <div class="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 transition-transform hover:-translate-y-1 duration-300">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                        <span class="material-symbols-outlined">pending_actions</span>
                    </div>
                    ${data.pendingCount > 0 ? '<span class="flex h-3 w-3 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-warning"></span></span>' : ''}
                </div>
                <p class="text-muted text-sm font-medium uppercase tracking-wider mb-1">Chờ duyệt</p>
                <h3 class="text-3xl font-bold text-slate-900 dark:text-white">${data.pendingCount}</h3>
            </div>
            <!-- Card: Bị báo cáo -->
            <div class="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 transition-transform hover:-translate-y-1 duration-300">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                        <span class="material-symbols-outlined">flag</span>
                    </div>
                    ${data.flaggedCount > 0 ? '<span class="px-2 text-[10px] uppercase tracking-wider font-bold text-danger bg-danger/10 rounded-full flex items-center whitespace-nowrap"><span class="material-symbols-outlined text-xs mr-1">warning</span>Cần chú ý</span>' : ''}
                </div>
                <p class="text-muted text-sm font-medium uppercase tracking-wider mb-1">Bị báo cáo / AI Cờ</p>
                <h3 class="text-3xl font-bold text-slate-900 dark:text-white">${data.flaggedCount}</h3>
            </div>
            <!-- Card: Tài khoản bị khóa -->
            <div class="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 transition-transform hover:-translate-y-1 duration-300">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-12 h-12 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                        <span class="material-symbols-outlined">block</span>
                    </div>
                </div>
                <p class="text-muted text-sm font-medium uppercase tracking-wider mb-1">Tài khoản bị khóa</p>
                <h3 class="text-3xl font-bold text-slate-900 dark:text-white">${data.bannedUsers}</h3>
            </div>
        </div>

        <div class="glass rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-6">
            <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 class="text-lg font-bold">Bài viết gần đây</h3>
                <a href="/admin/posts" class="text-sm text-primary hover:underline font-medium">Xem tất cả bài viết</a>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                            <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Người dùng</th>
                            <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Nội dung</th>
                            <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Trạng thái</th>
                            <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ngày đăng</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                        ${postRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Hiển thị thông báo lỗi trên giao diện.
 * @param {Error} error - Đối tượng lỗi.
 */
function renderError(error) {
    const container = document.getElementById('mainContent');
    if (!container) return;
    container.innerHTML = `
        <div class="glass p-8 text-center max-w-lg mx-auto mt-12 rounded-2xl border border-danger/20">
            <div class="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-3xl">error</span>
            </div>
            <h3 class="text-xl font-bold text-danger mb-2">Lỗi tải dữ liệu Dashboard</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 mb-6">${error.message}</p>
            <button onclick="window.loadDashboard()" class="px-6 py-2.5 bg-danger text-white hover:bg-danger/90 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-danger/20">Thử lại</button>
        </div>
    `;
}

/**
 * Lấy dữ liệu và render trang Dashboard.
 */
window.loadDashboard = async function () {
    const container = document.getElementById('mainContent');
    if (!container) return;

    // Hiển thị spinner loading
    container.innerHTML = `
        <div class="text-center py-16">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p class="text-muted mt-4">Đang tải dữ liệu tổng quan...</p>
        </div>
    `;

    try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const apiEndpoints = [
            fetch(`${API_BASE_URL}/moderation/posts?per_page=5`, { headers, credentials: 'include' }),
            fetch(`${API_BASE_URL}/moderation/posts?status=pending&per_page=1`, { headers, credentials: 'include' }),
            fetch(`${API_BASE_URL}/moderation/posts?status=flagged&per_page=1`, { headers, credentials: 'include' }),
            fetch(`${API_BASE_URL}/moderation/users?status=banned&per_page=1`, { headers, credentials: 'include' })
        ];

        const responses = await Promise.all(apiEndpoints);

        // Kiểm tra tất cả response có OK không
        for (const response of responses) {
            if (!response.ok) {
                throw new Error(`Yêu cầu API thất bại: ${response.status} ${response.statusText}`);
            }
        }

        const [postsData, pendingData, flaggedData, usersData] = await Promise.all(responses.map(res => res.json()));

        const dashboardData = {
            totalPosts: postsData.total || 0,
            pendingCount: pendingData.total || 0,
            flaggedCount: flaggedData.total || 0,
            bannedUsers: usersData.total || 0,
            recentPosts: postsData.posts || []
        };

        renderDashboardUI(dashboardData);

    } catch (error) {
        console.error("Dashboard error:", error);
        renderError(error);
    }
};

// Khởi tạo khi DOM đã tải xong
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof checkAuth === 'function') {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;
    }

    if (typeof window.loadDashboard === 'function') {
        window.loadDashboard();
    }

    refreshQueueBadge();
    setInterval(refreshQueueBadge, 30000); // Cập nhật mỗi 30 giây
});

