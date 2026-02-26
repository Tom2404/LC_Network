// Search functionality - Can be included in all pages
let searchTimeout = null;
let currentSearchFilter = 'all';

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (!searchInput || !clearBtn) return;
    
    // Show/hide clear button based on input
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearBtn.classList.toggle('hidden', !query);
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Show search dropdown when typing
        if (query) {
            showSearchDropdown();
            // Debounce search (wait 300ms after user stops typing)
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        } else {
            closeSearchDropdown();
        }
    });
    
    // Show dropdown on focus if there's a value
    searchInput.addEventListener('focus', (e) => {
        if (e.target.value.trim()) {
            showSearchDropdown();
            performSearch(e.target.value.trim());
        }
    });
}

function showSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.classList.remove('hidden');
}

function closeSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        document.getElementById('clearSearchBtn').classList.add('hidden');
        closeSearchDropdown();
        searchInput.focus();
    }
}

function setSearchFilter(filter) {
    currentSearchFilter = filter;
    
    // Update active state
    ['all', 'people', 'posts'].forEach(f => {
        const btn = document.getElementById(`searchFilter${f.charAt(0).toUpperCase() + f.slice(1)}`);
        if (btn) {
            if (f === filter) {
                btn.classList.add('search-filter-active');
                btn.classList.remove('text-[#5e8d89]', 'hover:bg-white', 'dark:hover:bg-[#152a28]');
            } else {
                btn.classList.remove('search-filter-active');
                btn.classList.add('text-[#5e8d89]', 'hover:bg-white', 'dark:hover:bg-[#152a28]');
            }
        }
    });
    
    // Re-perform search with new filter
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        performSearch(query);
    }
}

async function performSearch(query) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="p-8 text-center text-[#5e8d89]">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p class="text-sm">Đang tìm kiếm...</p>
        </div>
    `;
    
    try {
        const token = localStorage.getItem('accessToken');
        
        // Search based on filter
        if (currentSearchFilter === 'people') {
            // Only search users
            const usersResponse = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const usersData = await usersResponse.json();
            displaySearchResults(null, usersData, query);
        } else if (currentSearchFilter === 'posts') {
            // Only search posts
            const postsResponse = await fetch(`${API_URL}/posts/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const postsData = await postsResponse.json();
            displaySearchResults(postsData, null, query);
        } else {
            // Search both posts and users in parallel
            const [postsResponse, usersResponse] = await Promise.all([
                fetch(`${API_URL}/posts/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);
            
            const postsData = await postsResponse.json();
            const usersData = await usersResponse.json();
            displaySearchResults(postsData, usersData, query);
        }
        
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `
            <div class="p-8 text-center text-red-500">
                <span class="material-symbols-outlined text-4xl mb-2">error</span>
                <p class="text-sm">Lỗi kết nối. Vui lòng thử lại.</p>
            </div>
        `;
    }
}

function displaySearchResults(postsData, usersData, query) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;
    
    let html = '';
    
    const totalUsers = usersData?.total || 0;
    const totalPosts = postsData?.total || 0;
    const hasResults = totalUsers > 0 || totalPosts > 0;
    
    if (!hasResults) {
        container.innerHTML = `
            <div class="p-8 text-center text-[#5e8d89]">
                <span class="material-symbols-outlined text-5xl mb-2 opacity-50">search_off</span>
                <p class="font-medium mb-1">Không tìm thấy kết quả</p>
                <p class="text-sm">Thử tìm kiếm với từ khóa khác</p>
            </div>
        `;
        return;
    }
    
    // Display users results (if filter is 'all' or 'people')
    if (usersData && usersData.users && usersData.users.length > 0) {
        html += `
            <div class="border-b border-[#dae7e6] dark:border-[#2a3d3b]">
                <div class="px-4 py-2 bg-[#f0f5f4] dark:bg-[#1a3330]">
                    <h3 class="text-sm font-semibold text-[#5e8d89]">👥 NGƯỜI DÙNG (${totalUsers})</h3>
                </div>
                <div class="divide-y divide-[#f0f5f4] dark:divide-[#2a3d3b]">
        `;
        
        // Show maximum 5 users in dropdown
        const displayUsers = usersData.users.slice(0, 5);
        displayUsers.forEach(user => {
            const avatarUrl = user.avatar_url 
                ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`)
                : 'images/default-avatar.png';
            
            let friendButton = '';
            if (user.friendship_status === 'accepted') {
                friendButton = '<span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">✓ Bạn bè</span>';
            } else if (user.friendship_status === 'pending' && user.is_requester) {
                friendButton = '<span class="text-xs text-[#5e8d89]">Đã gửi lời mời</span>';
            } else if (user.friendship_status === 'pending' && !user.is_requester) {
                friendButton = `<button onclick="respondToFriendRequest(${user.id}, 'accept')" class="text-xs px-3 py-1 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors">Chấp nhận</button>`;
            } else {
                friendButton = `<button onclick="sendFriendRequest(${user.id})" class="text-xs px-3 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">Kết bạn</button>`;
            }
            
            html += `
                <div class="flex items-center gap-3 p-3 hover:bg-[#f0f5f4] dark:hover:bg-[#1a3330] transition-colors cursor-pointer" onclick="navigateToProfile(${user.id})">
                    <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 shrink-0"
                        style='background-image: url("${avatarUrl}");'></div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-sm text-[#101818] dark:text-white truncate">${user.full_name}</h4>
                        <p class="text-xs text-[#5e8d89] truncate">${user.email}</p>
                    </div>
                    <div onclick="event.stopPropagation()">
                        ${friendButton}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                ${totalUsers > 5 ? `<div class="p-3 text-center border-t border-[#dae7e6] dark:border-[#2a3d3b]"><a href="#" onclick="setSearchFilter('people'); return false;" class="text-sm text-primary hover:underline font-medium">Xem tất cả ${totalUsers} người →</a></div>` : ''}
            </div>
        `;
    }
    
    // Display posts results (if filter is 'all' or 'posts')
    if (postsData && postsData.posts && postsData.posts.length > 0) {
        html += `
            <div>
                <div class="px-4 py-2 bg-[#f0f5f4] dark:bg-[#1a3330]">
                    <h3 class="text-sm font-semibold text-[#5e8d89]">📝 BÀI VIẾT (${totalPosts})</h3>
                </div>
                <div class="divide-y divide-[#f0f5f4] dark:divide-[#2a3d3b]">
        `;
        
        // Show maximum 5 posts in dropdown
        const displayPosts = postsData.posts.slice(0, 5);
        displayPosts.forEach(post => {
            const authorAvatar = post.author?.avatar_url ? `${API_URL}${post.author.avatar_url}` : 'images/default-avatar.png';
            const timeAgo = getTimeAgo ? getTimeAgo(post.created_at) : 'Vừa xong';
            const caption = post.caption || '';
            const truncatedCaption = caption.length > 80 ? caption.substring(0, 80) + '...' : caption;
            const hasMedia = post.media && post.media.length > 0;
            
            html += `
                <div class="p-3 hover:bg-[#f0f5f4] dark:hover:bg-[#1a3330] transition-colors cursor-pointer" onclick="viewPost(${post.id})">
                    <div class="flex gap-2 mb-2">
                        <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 shrink-0"
                            style='background-image: url("${authorAvatar}");'></div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-sm text-[#101818] dark:text-white">${post.author?.full_name || 'Unknown'}</h4>
                            <p class="text-xs text-[#5e8d89]">${timeAgo}</p>
                        </div>
                    </div>
                    <p class="text-sm text-[#101818] dark:text-white">${truncatedCaption}</p>
                    ${hasMedia ? `<div class="flex gap-1 mt-2"><span class="material-symbols-outlined text-sm text-[#5e8d89]">${post.media[0].media_type === 'video' ? 'videocam' : 'image'}</span><span class="text-xs text-[#5e8d89]">${post.media.length} ${post.media[0].media_type === 'video' ? 'video' : 'ảnh'}</span></div>` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
                ${totalPosts > 5 ? `<div class="p-3 text-center border-t border-[#dae7e6] dark:border-[#2a3d3b]"><a href="#" onclick="setSearchFilter('posts'); return false;" class="text-sm text-primary hover:underline font-medium">Xem tất cả ${totalPosts} bài viết →</a></div>` : ''}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function navigateToProfile(userId) {
    closeSearchDropdown();
    window.location.href = `profile.html?id=${userId}`;
}

function viewPost(postId) {
    closeSearchDropdown();
    window.location.href = `post.html?id=${postId}`;
}

async function sendFriendRequest(userId) {
    try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${API_URL}/friends/request/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (typeof showNotification === 'function') {
                showNotification('Đã gửi lời mời kết bạn', 'success');
            }
            // Re-search to update UI
            const searchInput = document.getElementById('searchInput');
            if (searchInput && searchInput.value.trim()) {
                performSearch(searchInput.value.trim());
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification(data.error || 'Không thể gửi lời mời kết bạn', 'error');
            }
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        if (typeof showNotification === 'function') {
            showNotification('Lỗi khi gửi lời mời kết bạn', 'error');
        }
    }
}

async function respondToFriendRequest(userId, action) {
    try {
        const token = localStorage.getItem('accessToken');
        const endpoint = action === 'accept' ? 'accept' : 'reject';
        
        const response = await fetch(`${API_URL}/friends/request/${userId}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (typeof showNotification === 'function') {
                showNotification(action === 'accept' ? 'Đã chấp nhận lời mời kết bạn' : 'Đã từ chối lời mời', 'success');
            }
            // Re-search to update UI
            const searchInput = document.getElementById('searchInput');
            if (searchInput && searchInput.value.trim()) {
                performSearch(searchInput.value.trim());
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification(data.error || 'Có lỗi xảy ra', 'error');
            }
        }
    } catch (error) {
        console.error('Error responding to friend request:', error);
        if (typeof showNotification === 'function') {
            showNotification('Lỗi khi phản hồi lời mời kết bạn', 'error');
        }
    }
}

// Click outside to close search dropdown
document.addEventListener('click', (e) => {
    const searchDropdown = document.getElementById('searchDropdown');
    const searchInput = document.getElementById('searchInput');
    
    if (searchDropdown && searchInput) {
        if (!searchDropdown.contains(e.target) && !searchInput.contains(e.target)) {
            closeSearchDropdown();
        }
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const searchDropdown = document.getElementById('searchDropdown');
    
    // Search dropdown navigation
    if (searchDropdown && !searchDropdown.classList.contains('hidden')) {
        if (e.key === 'Escape') {
            closeSearchDropdown();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.blur();
        }
    }
    
    // Quick search shortcut (Ctrl/Cmd + K)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
    }
});
