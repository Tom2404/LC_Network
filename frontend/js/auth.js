// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop();
    const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
    
    if (!isLoggedIn() && !publicPages.includes(currentPage)) {
        window.location.href = 'login.html';
    } else if (isLoggedIn() && publicPages.includes(currentPage)) {
        window.location.href = 'index.html';
    }
    
    // Load user info if logged in
    if (isLoggedIn()) {
        loadUserInfo();
    }
});

// Load user info from localStorage
function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Update UI with user info
    const userNameElements = document.querySelectorAll('#userFullName, #modalUserName');
    userNameElements.forEach(el => {
        if (el) el.textContent = user.full_name || 'User';
    });
    
    const avatarElements = document.querySelectorAll('#navAvatar, #createPostAvatar, #modalAvatar');
    avatarElements.forEach(el => {
        if (el) el.src = user.avatar_url || 'images/default-avatar.png';
    });
}

// Logout function
function logout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        // Call logout API
        fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders()
        }).finally(() => {
            // Clear local storage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            
            // Redirect to login
            window.location.href = 'login.html';
        });
    }
}

// OAuth Login Functions
async function loginWithGoogle() {
    alert('Google OAuth integration coming soon!');
    // TODO: Implement Google OAuth
}

async function registerWithGoogle() {
    alert('Google OAuth integration coming soon!');
    // TODO: Implement Google OAuth
}

async function loginWithFacebook() {
    alert('Facebook OAuth integration coming soon!');
    // TODO: Implement Facebook OAuth
}

async function registerWithFacebook() {
    alert('Facebook OAuth integration coming soon!');
    // TODO: Implement Facebook OAuth
}

// Refresh token if expired
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
        logout();
        return null;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${refreshToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('accessToken', data.access_token);
            return data.access_token;
        } else {
            logout();
            return null;
        }
    } catch (error) {
        console.error('Failed to refresh token:', error);
        logout();
        return null;
    }
}

// Fetch with auto token refresh
async function fetchWithAuth(url, options = {}) {
    options.headers = {
        ...options.headers,
        ...getAuthHeaders()
    };
    
    let response = await fetch(url, options);
    
    // If unauthorized, try refreshing token
    if (response.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            options.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, options);
        }
    }
    
    return response;
}
