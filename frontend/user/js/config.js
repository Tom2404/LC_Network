// API Configuration
// Auto-detect current host to avoid CORS issues when using 127.0.0.1 vs localhost
const currentHost = window.location.hostname || 'localhost';
const currentPort = '5000';
const API_URL = `http://${currentHost}:${currentPort}/api`;

// Helper function to get auth token
function getAuthToken() {
    return localStorage.getItem('accessToken');
}

// Helper function to set auth headers
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
    };
}

// Helper function to check if user is logged in
function isLoggedIn() {
    return !!getAuthToken();
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_URL, getAuthToken, getAuthHeaders, isLoggedIn };
}
