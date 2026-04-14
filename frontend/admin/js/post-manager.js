/**
 * Logic riêng cho trang Post Manager
 */

let currentFilter = '';
let searchTimeout = null;

function setupEventListeners() {
    // Update active nav on click
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            document.querySelectorAll('nav a').forEach(l => l.classList.remove('active-link'));
            this.classList.add('active-link');
        });
    });
}

function switchTab(tab) {
    const titles = {
        'dashboard': 'Tổng quan',
        'posts': 'Quản lý Bài viết',
        'users': 'Quản lý Người dùng',
        'queue': 'Hàng đợi duyệt',
        'reports': 'Báo cáo Vi phạm',
        'settings': 'Cấu hình'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = titles[tab] || 'Admin Panel';
    currentTab = tab;
    
    if (typeof loadAdminData === 'function') {
        loadAdminData();
    }
}

function filterByStatus(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-primary', 'text-white');
        btn.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-slate-400');
    });
    
    // Fallback if event is not defined
    const target = window.event ? window.event.target : document.activeElement;
    if (target) {
        target.classList.add('active', 'bg-primary', 'text-white');
        target.classList.remove('bg-white', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-slate-400');
    }
    
    if (currentTab === 'posts') {
        const statusFilter = document.getElementById('post-status-filter');
        if (statusFilter) statusFilter.value = status;
        if (typeof loadPosts === 'function') loadPosts(1);
    }
}

function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        const searchValue = searchInput.value;
        if (currentTab === 'posts') {
            const postSearch = document.getElementById('post-search');
            if (postSearch) postSearch.value = searchValue;
            if (typeof loadPosts === 'function') loadPosts(1);
        } else if (currentTab === 'users') {
            const userSearch = document.getElementById('user-search');
            if (userSearch) userSearch.value = searchValue;
            if (typeof loadUsers === 'function') loadUsers(1);
        }
    }, 500);
}

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

async function updateStats() {
    try {
        const token = localStorage.getItem('token');
        // Get posts stats
        const postsResponse = await fetch(`${API_BASE_URL}/moderation/posts?per_page=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const postsData = await postsResponse.json();
        const totalPostsElem = document.getElementById('totalPosts');
        if (totalPostsElem) totalPostsElem.textContent = postsData.total || 0;

        // Get pending posts
        const pendingResponse = await fetch(`${API_BASE_URL}/moderation/posts?status=pending&per_page=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const pendingData = await pendingResponse.json();
        const pendingPostsElem = document.getElementById('pendingPosts');
        if (pendingPostsElem) pendingPostsElem.textContent = pendingData.total || 0;
        const queueCountElem = document.getElementById('queueCount');
        if (queueCountElem) queueCountElem.textContent = pendingData.total || 0;

        // Get flagged posts
        const flaggedResponse = await fetch(`${API_BASE_URL}/moderation/posts?status=flagged&per_page=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const flaggedData = await flaggedResponse.json();
        const flaggedCountElem = document.getElementById('flaggedCount');
        if (flaggedCountElem) flaggedCountElem.textContent = flaggedData.total || 0;

        // Simulate approved today (would need backend endpoint)
        const approvedTodayElem = document.getElementById('approvedToday');
        if (approvedTodayElem) approvedTodayElem.textContent = Math.floor(Math.random() * 50);

    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Set the current tab for this page
    if (typeof window.setCurrentTab === 'function') {
        window.setCurrentTab('posts');
    } else if (typeof currentTab !== 'undefined') {
        currentTab = 'posts';
    }

    // Authenticate and then load data
    if (typeof checkAuth === 'function') {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            console.error("Authentication failed. Halting further execution.");
            return; // Stop if not authenticated
        }
    }

    // Directly load posts for this page
    if (typeof loadPosts === 'function') {
        loadPosts(1);
    } else if (typeof loadAdminData === 'function') {
        // Fallback for older structure
        loadAdminData();
    }

    updateStats();
    setupEventListeners();

    // Refresh stats every 30 seconds
    setInterval(updateStats, 30000);
});
