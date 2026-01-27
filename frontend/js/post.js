// Selected media files
let selectedMedia = [];

// Open create post modal
function openCreatePostModal(type = '') {
    const modal = document.getElementById('createPostModal');
    modal.classList.add('active');
    
    // Reset form
    document.getElementById('postCaption').value = '';
    selectedMedia = [];
    document.getElementById('mediaPreview').innerHTML = '';
}

// Close create post modal
function closeCreatePostModal() {
    const modal = document.getElementById('createPostModal');
    modal.classList.remove('active');
}

// Handle media file selection
function handleMediaSelect(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        // Check file type
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (!isImage && !isVideo) {
            alert('Chỉ chấp nhận file ảnh hoặc video');
            return;
        }
        
        // Check file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
            alert('File quá lớn. Kích thước tối đa 100MB');
            return;
        }
        
        selectedMedia.push({
            file: file,
            type: isImage ? 'image' : 'video',
            url: URL.createObjectURL(file)
        });
    });
    
    updateMediaPreview();
}

// Update media preview
function updateMediaPreview() {
    const preview = document.getElementById('mediaPreview');
    preview.innerHTML = '';
    
    selectedMedia.forEach((media, index) => {
        const item = document.createElement('div');
        item.className = 'media-preview-item';
        
        if (media.type === 'image') {
            item.innerHTML = `
                <img src="${media.url}" alt="Preview">
                <button class="remove-btn" onclick="removeMedia(${index})">×</button>
            `;
        } else {
            item.innerHTML = `
                <video src="${media.url}"></video>
                <button class="remove-btn" onclick="removeMedia(${index})">×</button>
            `;
        }
        
        preview.appendChild(item);
    });
}

// Remove media from selection
function removeMedia(index) {
    URL.revokeObjectURL(selectedMedia[index].url);
    selectedMedia.splice(index, 1);
    updateMediaPreview();
}

// Submit post
async function submitPost() {
    const caption = document.getElementById('postCaption').value.trim();
    const visibility = document.getElementById('postVisibility').value;
    
    if (!caption && selectedMedia.length === 0) {
        alert('Vui lòng nhập nội dung hoặc thêm ảnh/video');
        return;
    }
    
    try {
        // Upload media files first
        const uploadedMedia = [];
        
        for (const media of selectedMedia) {
            const mediaUrl = await uploadMediaFile(media.file, media.type);
            if (mediaUrl) {
                uploadedMedia.push({
                    type: media.type,
                    url: mediaUrl
                });
            }
        }
        
        // Create post
        const response = await fetchWithAuth(`${API_URL}/posts`, {
            method: 'POST',
            body: JSON.stringify({
                caption: caption,
                visibility: visibility,
                media: uploadedMedia
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Bài viết đã được tạo và đang chờ kiểm duyệt', 'success');
            closeCreatePostModal();
            
            // Reload newsfeed after a delay
            setTimeout(() => {
                loadNewsfeed();
            }, 1000);
        } else {
            showMessage(data.error || 'Không thể tạo bài viết', 'error');
        }
    } catch (error) {
        console.error('Failed to submit post:', error);
        showMessage('Lỗi kết nối server', 'error');
    }
}

// Upload media file
async function uploadMediaFile(file, type) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        
        const response = await fetch(`${API_URL}/posts/upload-media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return data.url;
        } else {
            console.error('Media upload failed:', data.error);
            return null;
        }
    } catch (error) {
        console.error('Failed to upload media:', error);
        return null;
    }
}

// Show post menu
function showPostMenu(postId) {
    // TODO: Implement post menu (edit, delete, report)
    alert('Post menu coming soon!');
}

// Share post
async function sharePost(postId) {
    // TODO: Implement share functionality
    alert('Share feature coming soon!');
}

// Show likes
function showLikes(postId) {
    // TODO: Implement show likes modal
    alert('Show likes coming soon!');
}

// Accept friend request
async function acceptFriendRequest(userId) {
    try {
        const response = await fetchWithAuth(`${API_URL}/friends/request/${userId}/accept`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showMessage('Đã chấp nhận lời mời kết bạn', 'success');
            loadFriendRequests();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Không thể chấp nhận lời mời', 'error');
        }
    } catch (error) {
        console.error('Failed to accept friend request:', error);
    }
}

// Reject friend request
async function rejectFriendRequest(userId) {
    try {
        const response = await fetchWithAuth(`${API_URL}/friends/request/${userId}/reject`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showMessage('Đã từ chối lời mời kết bạn', 'success');
            loadFriendRequests();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Không thể từ chối lời mời', 'error');
        }
    } catch (error) {
        console.error('Failed to reject friend request:', error);
    }
}

// Show message to user
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.display = 'block';
    }, 100);
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
        messageDiv.remove();
    }, 5000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('createPostModal');
    if (event.target === modal) {
        closeCreatePostModal();
    }
}
