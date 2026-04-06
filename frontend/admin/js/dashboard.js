/**
 * Logic riêng cho trang Dashboard
 */

function toggleDarkMode() {
    const html = document.documentElement;
    const icon = document.getElementById('darkModeIcon');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        icon.textContent = 'dark_mode';
    } else {
        html.classList.add('dark');
        icon.textContent = 'light_mode';
    }
}

async function refreshQueueBadge() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/moderation/posts?status=pending&per_page=1`, {
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await response.json();
        const badge = document.getElementById('queueCount');
        if (badge) {
            badge.textContent = data.total || 0;
            // Animation for new items
            if (data.total > 0 && badge.textContent !== (data.total || 0).toString()) {
                badge.classList.add('animate-bounce');
                setTimeout(() => badge.classList.remove('animate-bounce'), 1000);
            }
        }
    } catch (error) {
        console.error('Queue badge error:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Make sure checkAuth is available from admin.js
    if (typeof checkAuth === 'function') {
        const ok = await checkAuth();
        if (!ok) return;
    }
    
    if (typeof currentTab !== 'undefined') {
        currentTab = 'dashboard';
    }
    
    if (typeof loadDashboard === 'function') {
        loadDashboard();
    }
    
    refreshQueueBadge();
    setInterval(refreshQueueBadge, 30000);
});
