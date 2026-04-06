/**
 * Logic riêng cho trang User Manager
 */

(() => {
    let umUsers = [];
    let umSelectedUser = null;
    let umSelectedSummary = null;
    let umStatus = '';
    let umSearchTimeout = null;

    document.addEventListener('DOMContentLoaded', async function () {
        if (typeof checkAuth === 'function') {
            const isOk = await checkAuth();
            if (!isOk) return;
        }

        initUserManagerEvents();
        await umLoadUsers(1);
    });

    function initUserManagerEvents() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(umSearchTimeout);
                umSearchTimeout = setTimeout(() => {
                    umLoadUsers(1);
                }, 400);
            });
        }

        document.querySelectorAll('.user-filter-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                umStatus = btn.dataset.status || '';
                document.querySelectorAll('.user-filter-btn').forEach((item) => {
                    item.classList.remove('bg-primary', 'text-white');
                    item.classList.add('border', 'border-slate-200', 'dark:border-slate-700');
                });
                btn.classList.add('bg-primary', 'text-white');
                btn.classList.remove('border', 'border-slate-200', 'dark:border-slate-700');
                umLoadUsers(1);
            });
        });

        const usersTableBody = document.getElementById('usersTableBody');
        if (usersTableBody) {
            usersTableBody.addEventListener('click', (event) => {
                const viewBtn = event.target.closest('[data-view-summary]');
                if (viewBtn) {
                    const userId = Number(viewBtn.dataset.userId);
                    umSetSelectedUser(userId);
                    umViewProfileSummary(userId);
                    return;
                }

                const target = event.target.closest('[data-user-id]');
                if (!target) return;
                const userId = Number(target.dataset.userId);
                umSetSelectedUser(userId);
            });
        }

        const warnBtn = document.getElementById('warnButton');
        if (warnBtn) {
            warnBtn.addEventListener('click', () => {
                if (!umSelectedUser) {
                    alert('Vui lòng chọn người dùng trước.');
                    return;
                }
                alert(`Đã chọn user @${umSelectedUser.username}. Bạn có thể mở rộng endpoint cảnh báo riêng ở bước sau.`);
            });
        }

        const banToggleBtn = document.getElementById('banToggleButton');
        if (banToggleBtn) {
            banToggleBtn.addEventListener('click', async () => {
                if (!umSelectedUser) {
                    alert('Vui lòng chọn người dùng trước.');
                    return;
                }
                await umToggleBan();
            });
        }
    }

    async function umLoadUsers(page = 1) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        const q = (document.getElementById('searchInput').value || '').trim();
        const params = new URLSearchParams({
            page: String(page),
            per_page: '50'
        });

        if (q) params.set('search', q);
        if (umStatus) params.set('status', umStatus);

        tbody.innerHTML = `
            <tr>
                <td class="px-6 py-8" colspan="5">
                    <p class="text-xs text-muted text-center">Đang tải dữ liệu người dùng...</p>
                </td>
            </tr>
        `;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/moderation/users?${params.toString()}`);
            if (!response) return;

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            umUsers = data.users || [];
            umRenderUsers(umUsers);
            umUpdateStats(umUsers, data.total || umUsers.length);

            if (umUsers.length > 0) {
                umSetSelectedUser(umUsers[0].id);
                umViewProfileSummary(umUsers[0].id);
            } else {
                umResetDetail();
            }
        } catch (error) {
            console.error('Lỗi load users:', error);
            tbody.innerHTML = `
                <tr>
                    <td class="px-6 py-8" colspan="5">
                        <p class="text-xs text-danger text-center">Không thể tải dữ liệu người dùng.</p>
                    </td>
                </tr>
            `;
        }
    }

    function umRenderUsers(users) {
        const tbody = document.getElementById('usersTableBody');

        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td class="px-6 py-8" colspan="5">
                        <p class="text-xs text-muted text-center">Không có người dùng phù hợp bộ lọc.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map((user) => {
            const avatar = user.avatar_url || '/user/images/default-avatar.png';
            const lastLogin = user.last_login_at ? umFormatDate(user.last_login_at) : 'Chưa đăng nhập';
            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" data-user-id="${user.id}">
                    <td class="px-6 py-4" data-user-id="${user.id}">
                        <div class="flex items-center gap-3" data-user-id="${user.id}">
                            <img src="${avatar}" alt="avatar" class="w-10 h-10 rounded-full bg-slate-100" data-user-id="${user.id}" />
                            <div data-user-id="${user.id}">
                                <p class="text-sm font-bold">@${umEscapeHtml(user.username || 'N/A')}</p>
                                <p class="text-xs text-muted">${umEscapeHtml(user.email || 'N/A')}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4" data-user-id="${user.id}">${umStatusBadge(user.account_status)}</td>
                    <td class="px-6 py-4 text-sm" data-user-id="${user.id}">${user.warning_count || 0}</td>
                    <td class="px-6 py-4 text-sm text-muted" data-user-id="${user.id}">${lastLogin}</td>
                    <td class="px-6 py-4 text-right">
                        <button class="text-xs text-primary font-bold hover:underline" data-view-summary="1" data-user-id="${user.id}">Xem chi tiết</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function umUpdateStats(users, totalFromApi) {
        const active = users.filter((u) => (u.account_status || '').toLowerCase() === 'active').length;
        const banned = users.filter((u) => (u.account_status || '').toLowerCase() === 'banned').length;

        document.getElementById('totalUsers').textContent = totalFromApi;
        document.getElementById('activeUsers').textContent = active;
        document.getElementById('bannedUsers').textContent = banned;
    }

    function umSetSelectedUser(userId) {
        const user = umUsers.find((u) => u.id === userId);
        if (!user) return;
        umSelectedUser = user;

        document.getElementById('detailFullName').textContent = user.full_name || '-';
        document.getElementById('detailUsername').textContent = `@${user.username || '-'}`;
        document.getElementById('detailEmail').textContent = user.email || '-';
        document.getElementById('detailPhone').textContent = user.phone_number || '-';
        document.getElementById('detailWarnings').textContent = String(user.warning_count || 0);
        document.getElementById('detailStatus').textContent = umStatusText(user.account_status);
        document.getElementById('detailCreatedAt').textContent = user.created_at ? umFormatDate(user.created_at) : '-';
        document.getElementById('detailLastLogin').textContent = user.last_login_at ? umFormatDate(user.last_login_at) : 'Chưa đăng nhập';
        document.getElementById('detailPosts').textContent = '...';
        document.getElementById('detailComments').textContent = '...';
        document.getElementById('detailFriends').textContent = '...';

        const banBtn = document.getElementById('banToggleButton');
        if ((user.account_status || '').toLowerCase() === 'banned') {
            banBtn.textContent = 'Mở khóa tài khoản';
            banBtn.classList.remove('bg-danger', 'hover:bg-danger/90');
            banBtn.classList.add('bg-success', 'hover:bg-success/90');
        } else {
            banBtn.textContent = 'Khóa tài khoản';
            banBtn.classList.remove('bg-success', 'hover:bg-success/90');
            banBtn.classList.add('bg-danger', 'hover:bg-danger/90');
        }
    }

    async function umViewProfileSummary(userId) {
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/moderation/users/${userId}/profile-summary`);
            if (!response) return;

            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }

            umSelectedSummary = result.summary || null;
            if (!umSelectedSummary) return;

            document.getElementById('detailFullName').textContent = umSelectedSummary.full_name || '-';
            document.getElementById('detailUsername').textContent = `@${umSelectedSummary.username || '-'}`;
            document.getElementById('detailEmail').textContent = umSelectedSummary.email || '-';
            document.getElementById('detailPhone').textContent = umSelectedSummary.phone_number || '-';
            document.getElementById('detailWarnings').textContent = String(umSelectedSummary.warning_count || 0);
            document.getElementById('detailStatus').textContent = umStatusText(umSelectedSummary.account_status);
            document.getElementById('detailCreatedAt').textContent = umSelectedSummary.created_at ? umFormatDate(umSelectedSummary.created_at) : '-';
            document.getElementById('detailLastLogin').textContent = umSelectedSummary.last_login_at ? umFormatDate(umSelectedSummary.last_login_at) : 'Chưa đăng nhập';
            document.getElementById('detailPosts').textContent = String((umSelectedSummary.stats && umSelectedSummary.stats.posts) || 0);
            document.getElementById('detailComments').textContent = String((umSelectedSummary.stats && umSelectedSummary.stats.comments) || 0);
            document.getElementById('detailFriends').textContent = String((umSelectedSummary.stats && umSelectedSummary.stats.friends) || 0);
        } catch (error) {
            console.error('Lỗi tải tóm tắt profile:', error);
            alert('Không thể tải tóm tắt Trang cá nhân của người dùng này.');
        }
    }

    function umResetDetail() {
        umSelectedUser = null;
        umSelectedSummary = null;
        document.getElementById('detailFullName').textContent = '-';
        document.getElementById('detailUsername').textContent = '-';
        document.getElementById('detailEmail').textContent = '-';
        document.getElementById('detailPhone').textContent = '-';
        document.getElementById('detailWarnings').textContent = '0';
        document.getElementById('detailStatus').textContent = '-';
        document.getElementById('detailPosts').textContent = '0';
        document.getElementById('detailComments').textContent = '0';
        document.getElementById('detailFriends').textContent = '0';
        document.getElementById('detailCreatedAt').textContent = '-';
        document.getElementById('detailLastLogin').textContent = '-';
    }

    async function umToggleBan() {
        const isBanned = (umSelectedUser.account_status || '').toLowerCase() === 'banned';
        const endpoint = isBanned
            ? `${API_BASE_URL}/moderation/users/${umSelectedUser.id}/unban`
            : `${API_BASE_URL}/moderation/users/${umSelectedUser.id}/ban`;

        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        if (!isBanned) {
            options.body = JSON.stringify({ reason: 'Khóa tài khoản từ trang Quản lý Người dùng' });
        }

        try {
            const response = await authenticatedFetch(endpoint, options);
            if (!response) return;

            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }

            await umLoadUsers(1);
        } catch (error) {
            console.error('Lỗi cập nhật trạng thái tài khoản:', error);
            alert('Không thể cập nhật trạng thái tài khoản.');
        }
    }

    function umStatusBadge(status) {
        const normalized = (status || '').toLowerCase();
        if (normalized === 'banned') {
            return '<span class="text-xs bg-danger/10 text-danger px-2 py-1 rounded-full">Đã khóa</span>';
        }
        return '<span class="text-xs bg-success/10 text-success px-2 py-1 rounded-full">Đang hoạt động</span>';
    }

    function umStatusText(status) {
        const normalized = (status || '').toLowerCase();
        if (normalized === 'banned') return 'Đã khóa';
        return 'Đang hoạt động';
    }

    function umFormatDate(dateString) {
        try {
            return new Date(dateString).toLocaleString('vi-VN');
        } catch (error) {
            return dateString || '-';
        }
    }

    function umEscapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value;
        return div.innerHTML;
    }
    
    // Export global search event hook if needed by common admin template
    window.handleSearch = function() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const event = new Event('input');
            searchInput.dispatchEvent(event);
        }
    };
})();

function toggleDarkMode() {
    const html = document.documentElement;
    const icon = document.getElementById('darkModeIcon');
    if (!icon) return;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        icon.textContent = 'dark_mode';
    } else {
        html.classList.add('dark');
        icon.textContent = 'light_mode';
    }
}
