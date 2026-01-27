# 🚀 Hướng dẫn cài đặt và chạy hệ thống

## 📋 Yêu cầu hệ thống

### Backend (Python)
- Python 3.9 trở lên
- MySQL 8.0+ hoặc PostgreSQL 13+
- pip (Python package manager)

### Frontend
- Trình duyệt web hiện đại (Chrome, Firefox, Edge, Safari)
- Không cần Node.js (HTML/CSS/JavaScript thuần)

### Optional
- Redis (cho caching và Celery)
- AWS S3 account (cho file storage production)

---

## 🔧 Cài đặt Backend

### Bước 1: Clone Repository
```bash
cd d:\Chap_6\PBL_5\Test
```

### Bước 2: Tạo Virtual Environment
```bash
cd backend
python -m venv venv

# Kích hoạt virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### Bước 3: Cài đặt Dependencies
```bash
pip install -r requirements.txt
```

### Bước 4: Cấu hình Database

#### Tạo Database MySQL
```sql
CREATE DATABASE social_media_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### Import Schema
```bash
mysql -u root -p social_media_db < ../database_schema.sql
```

### Bước 5: Cấu hình Environment Variables
```bash
# Copy file .env.example thành .env
copy .env.example .env

# Chỉnh sửa file .env với thông tin của bạn
```

**Các biến quan trọng cần cấu hình:**
```env
# Database
DATABASE_URL=mysql+pymysql://root:your_password@localhost/social_media_db

# JWT Secret Keys
SECRET_KEY=your-random-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Email (Gmail example)
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### Bước 6: Chạy Database Migrations
```bash
# Tạo migration folder
flask db init

# Tạo migration
flask db migrate -m "Initial migration"

# Apply migration
flask db upgrade
```

### Bước 7: Chạy Backend Server
```bash
python app.py
```

Server sẽ chạy tại: `http://localhost:5000`

---

## 🌐 Cài đặt Frontend

### Bước 1: Mở Frontend
Frontend là HTML/CSS/JavaScript thuần, không cần build.

```bash
cd ../frontend
```

### Bước 2: Chạy Frontend

**Option 1: Sử dụng Python HTTP Server**
```bash
python -m http.server 3000
```

**Option 2: Sử dụng Live Server (VS Code Extension)**
1. Cài đặt extension "Live Server" trong VS Code
2. Right-click vào `login.html` → "Open with Live Server"

**Option 3: Mở trực tiếp file HTML**
- Double click vào `frontend/login.html`
- Lưu ý: Một số tính năng có thể không hoạt động do CORS policy

Frontend sẽ chạy tại: `http://localhost:3000`

---

## 📝 Tài khoản mặc định

Sau khi chạy lần đầu, bạn cần đăng ký tài khoản mới.

### Tạo tài khoản Admin/Moderator (Manual)
```sql
-- Đăng nhập vào MySQL
mysql -u root -p social_media_db

-- Tạo tài khoản admin
INSERT INTO users (email, username, password_hash, full_name, oauth_provider, is_email_verified, account_status)
VALUES ('admin@example.com', 'admin', '$2b$12$...', 'Administrator', 'local', 1, 'active');

-- Gán role admin (thay YOUR_USER_ID bằng ID từ câu lệnh trên)
INSERT INTO user_roles (user_id, role) VALUES (YOUR_USER_ID, 'admin');
```

---

## 🧪 Test API với Postman

### Import Postman Collection

1. Mở Postman
2. Import file `postman_collection.json` (sẽ tạo riêng)
3. Cấu hình environment variables:
   - `base_url`: `http://localhost:5000/api`
   - `access_token`: (sẽ được set tự động sau khi login)

### Test các endpoints chính:

**1. Đăng ký:**
```
POST {{base_url}}/auth/register
Body: {
  "email": "test@example.com",
  "username": "testuser",
  "password": "Test@123456",
  "full_name": "Test User"
}
```

**2. Đăng nhập:**
```
POST {{base_url}}/auth/login
Body: {
  "email": "test@example.com",
  "password": "Test@123456"
}
```

**3. Tạo bài viết:**
```
POST {{base_url}}/posts
Headers: Authorization: Bearer {{access_token}}
Body: {
  "caption": "Hello World!",
  "visibility": "public"
}
```

---

## 🔍 Troubleshooting

### Lỗi kết nối Database
```
Error: (2003, "Can't connect to MySQL server...")
```
**Giải pháp:**
- Kiểm tra MySQL service đã chạy chưa
- Kiểm tra username/password trong `.env`
- Kiểm tra port 3306 có bị block không

### Lỗi Import Module
```
ModuleNotFoundError: No module named 'flask'
```
**Giải pháp:**
- Đảm bảo virtual environment đã được kích hoạt
- Chạy lại: `pip install -r requirements.txt`

### Lỗi CORS khi gọi API từ Frontend
```
Access to fetch at 'http://localhost:5000/api/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```
**Giải pháp:**
- Kiểm tra Flask-CORS đã được cài đặt
- Trong `app.py`, đảm bảo CORS đã được config đúng
- Cập nhật `FRONTEND_URL` trong `.env`

### Email verification không gửi được
**Giải pháp:**
- Nếu dùng Gmail, cần tạo "App Password":
  1. Vào Google Account Settings
  2. Security → 2-Step Verification → App passwords
  3. Tạo app password mới
  4. Dùng password này trong `.env`

---

## 📚 Tài liệu API

### Authentication Endpoints

#### POST `/api/auth/register`
Đăng ký tài khoản mới

**Request:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "Password@123",
  "full_name": "Full Name",
  "phone_number": "0123456789"
}
```

**Response (201):**
```json
{
  "message": "Registration successful! Please check your email...",
  "user": {
    "id": 1,
    "username": "username",
    "email": "user@example.com",
    "full_name": "Full Name"
  }
}
```

#### POST `/api/auth/login`
Đăng nhập

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password@123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "username",
    "full_name": "Full Name"
  }
}
```

#### GET `/api/auth/verify-email/<token>`
Xác thực email

#### POST `/api/auth/refresh`
Làm mới access token (requires refresh token)

#### POST `/api/auth/logout`
Đăng xuất (requires access token)

---

### User Endpoints

#### GET `/api/users/profile`
Lấy thông tin profile của user hiện tại (requires auth)

#### PUT `/api/users/profile`
Cập nhật profile (requires auth)

**Request:**
```json
{
  "full_name": "New Name",
  "phone_number": "0987654321"
}
```

#### POST `/api/users/profile/avatar`
Upload avatar (requires auth, multipart/form-data)

#### GET `/api/users/activity-logs`
Xem lịch sử hoạt động (requires auth)

---

### Post Endpoints

#### POST `/api/posts`
Tạo bài viết mới (requires auth)

**Request:**
```json
{
  "caption": "Post content here",
  "visibility": "public",
  "media": [
    {
      "type": "image",
      "url": "/uploads/posts/images/abc123.jpg"
    }
  ]
}
```

#### GET `/api/posts`
Lấy danh sách bài viết (Newsfeed)

**Query params:**
- `page`: Trang (default: 1)
- `per_page`: Số bài viết mỗi trang (default: 20)
- `status`: Lọc theo trạng thái (optional)

#### GET `/api/posts/<id>`
Xem chi tiết bài viết

#### PUT `/api/posts/<id>`
Chỉnh sửa bài viết (requires auth, owner only)

#### DELETE `/api/posts/<id>`
Xóa bài viết (requires auth, owner only)

---

### Comment Endpoints

#### POST `/api/comments/post/<post_id>`
Tạo comment (requires auth)

**Request:**
```json
{
  "content": "Comment text here",
  "parent_comment_id": null
}
```

#### GET `/api/comments/post/<post_id>`
Lấy danh sách comment của bài viết

---

### Friend Endpoints

#### POST `/api/friends/request/<friend_id>`
Gửi lời mời kết bạn (requires auth)

#### POST `/api/friends/request/<requester_id>/accept`
Chấp nhận lời mời (requires auth)

#### POST `/api/friends/request/<requester_id>/reject`
Từ chối lời mời (requires auth)

#### GET `/api/friends`
Lấy danh sách bạn bè (requires auth)

#### GET `/api/friends/requests`
Lấy danh sách lời mời kết bạn (requires auth)

#### DELETE `/api/friends/<friend_id>`
Hủy kết bạn (requires auth)

---

## 🚀 Next Steps

### Phase 1 (Hiện tại - Hoàn thành)
- ✅ Database Schema
- ✅ User Authentication
- ✅ Post Management (CRUD)
- ✅ Comment System
- ✅ Friend System
- ✅ Frontend cơ bản

### Phase 2 (Tiếp theo)
- [ ] Like & Share features
- [ ] Report System
- [ ] Notification System
- [ ] Real-time updates (WebSocket)

### Phase 3 (Sau đó)
- [ ] Moderator Dashboard
- [ ] Appeal System
- [ ] User Management (Ban, Warn, Mute)

### Phase 4 (Cuối cùng)
- [ ] AI Content Moderation
- [ ] Admin Panel
- [ ] Analytics & Reports

---

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra lại các bước cài đặt
2. Xem phần Troubleshooting
3. Kiểm tra logs trong terminal/console
4. Tạo issue trên GitHub (nếu có)

---

## 📄 License

MIT License - Tự do sử dụng cho mục đích học tập và thương mại.
