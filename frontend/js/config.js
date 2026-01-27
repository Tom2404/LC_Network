// API Configuration
const API_URL = 'http://localhost:5000/api';

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
