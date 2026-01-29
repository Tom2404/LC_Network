// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = ['login.html', 'register.html', 'forgot-password.html'];
    
    console.log('[Auth] Current page:', currentPage);
    console.log('[Auth] Is logged in:', isLoggedIn());
    console.log('[Auth] Access token exists:', !!localStorage.getItem('accessToken'));
    
    if (!isLoggedIn() && !publicPages.includes(currentPage)) {
        console.log('[Auth] Not logged in, redirecting to login...');
        window.location.href = 'login.html';
    } else if (isLoggedIn() && publicPages.includes(currentPage)) {
        console.log('[Auth] Already logged in, redirecting to index...');
        window.location.href = 'index.html';
    } else {
        console.log('[Auth] Auth check passed, staying on current page');
    }
    
    // Load user info if logged in
    if (isLoggedIn()) {
        loadUserInfo();
    }
});

// Load user info from localStorage
function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    console.log('[Auth] Loading user info:', user);
    
    // Update UI with user info
    const userNameElements = document.querySelectorAll('#userFullName, #modalUserName');
    userNameElements.forEach(el => {
        if (el) {
            el.textContent = user.full_name || 'User';
            console.log('[Auth] Updated username element:', el.id);
        }
    });
    
    const avatarElements = document.querySelectorAll('#navAvatar, #createPostAvatar, #modalAvatar');
    avatarElements.forEach(el => {
        if (el) {
            el.src = user.avatar_url || 'images/default-avatar.png';
            console.log('[Auth] Updated avatar element:', el.id);
        }
    });
}

// Logout function
function logout(skipConfirm = false) {
    console.log('[Auth] Logout called, skipConfirm:', skipConfirm);
    
    console.log('[Auth] Clearing localStorage and redirecting...');
    
    // Call logout API
    fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
    }).finally(() => {
        // Clear local storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        console.log('[Auth] Redirecting to login.html');
        // Redirect to login
        window.location.href = 'login.html';
    });
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
    
    console.log('[Auth] Refreshing access token...');
    
    if (!refreshToken) {
        console.error('[Auth] No refresh token found');
        logout(true);
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
        
        console.log('[Auth] Refresh token response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('[Auth] New access token received');
            localStorage.setItem('accessToken', data.access_token);
            return data.access_token;
        } else {
            console.error('[Auth] Failed to refresh token, status:', response.status);
            logout(true);
            return null;
        }
    } catch (error) {
        console.error('[Auth] Failed to refresh token:', error);
        logout(true);
        return null;
    }
}

// Fetch with auto token refresh
async function fetchWithAuth(url, options = {}) {
    console.log('[Auth] Fetching with auth:', url);
    
    options.headers = {
        ...options.headers,
        ...getAuthHeaders()
    };
    
    let response = await fetch(url, options);
    
    console.log('[Auth] Response status:', response.status);
    
    // If unauthorized, try refreshing token
    if (response.status === 401) {
        console.log('[Auth] 401 Unauthorized, attempting token refresh...');
        const newToken = await refreshAccessToken();
        if (newToken) {
            console.log('[Auth] Token refreshed, retrying request...');
            options.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, options);
            console.log('[Auth] Retry response status:', response.status);
        }
    }
    
    return response;
}
