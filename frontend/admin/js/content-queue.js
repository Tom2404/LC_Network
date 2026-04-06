/**
 * Logic riêng cho trang Content Queue
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

async function updateQueueSummary() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/moderation/queue?page=1&per_page=50`, {
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await response.json();
        if (data.error) {
            return;
        }
        const queue = data.queue || [];
        const highPriority = queue.filter(item => {
            if (typeof item.priority === 'number') {
                return item.priority >= 80;
            }
            return item.priority === 'high';
        }).length;

        const pendingCount = document.getElementById('queuePendingCount');
        const countValues = data.total || queue.length || 0;
        if (pendingCount && pendingCount.textContent !== countValues.toString()) {
             pendingCount.textContent = countValues;
             pendingCount.classList.add('animate-scale-in');
             setTimeout(() => pendingCount.classList.remove('animate-scale-in'), 300);
        }

        document.getElementById('queueHighCount').textContent = highPriority;
        document.getElementById('queuePageCount').textContent = data.current_page || 1;
        document.getElementById('queueCount').textContent = countValues;
    } catch (error) {
        console.error('Queue summary error:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof checkAuth === 'function') {
        const ok = await checkAuth();
        if (!ok) return;
    }
    
    if (typeof currentTab !== 'undefined') {
        currentTab = 'queue';
    }
    
    if (typeof loadQueue === 'function') {
        await loadQueue(1);
    }
    
    await updateQueueSummary();
    setInterval(updateQueueSummary, 30000);
});
