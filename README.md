# 🔒 Social Media Content Moderation System

Hệ thống mạng xã hội với tính năng kiểm duyệt nội dung tự động sử dụng AI

## � Khởi động nhanh (Quick Start)

### Cài đặt
```bash
# Clone repository
git clone <repository-url>
cd Test

# Cài đặt dependencies cho backend
cd backend
pip install -r requirements.txt
cd ..
```

### Chạy ứng dụng (Một lệnh duy nhất!)
```bash
# Từ thư mục gốc của project
python start.py
```

Sau khi chạy, truy cập:
- **Ứng dụng web**: http://127.0.0.1:5000
- **API Backend**: http://127.0.0.1:5000/api
- **Admin Panel**: http://127.0.0.1:5000/admin (yêu cầu đăng nhập với role admin/moderator)

*Giống như Django, bạn chỉ cần chạy 1 file để khởi động cả backend và frontend!*

### Dừng server
Nhấn `Ctrl+C` trong terminal

---

## 📁 Cấu trúc Project

Project được tổ chức theo mô hình **Frontend-Backend** rõ ràng:

```
Test/
├── backend/                    # Backend API (Flask)
│   ├── app.py                 # Main application
│   ├── config.py              # Configuration
│   ├── controllers/           # API endpoints
│   ├── models/                # Database models
│   ├── utils/                 # Utilities
│   └── uploads/               # User uploaded files
│
├── frontend/
│   ├── user/                  # 👤 User Interface
│   │   ├── index.html        # Trang chủ
│   │   ├── login.html        # Đăng nhập
│   │   ├── register.html     # Đăng ký
│   │   ├── profile.html      # Hồ sơ
│   │   ├── post.html         # Chi tiết bài viết
│   │   ├── friends.html      # Bạn bè
│   │   ├── notifications.html # Thông báo
│   │   ├── css/              # Styles
│   │   ├── js/               # Scripts
│   │   ├── components/       # Components
│   │   └── images/           # Images
│   │
│   └── admin/                 # 🛡️ Admin Panel
│       ├── PostManager.html  # Dashboard
│       ├── login.html        # Login redirect page
│       ├── css/              # Admin styles
│       └── js/               # Admin scripts
│
├── database_schema.sql        # Database schema
└── start.py                   # Application launcher
```

### Lợi ích của cấu trúc này:

✅ **Tách biệt rõ ràng** - User và Admin interface độc lập  
✅ **Dễ bảo trì** - Mỗi module có thư mục riêng  
✅ **Dễ mở rộng** - Thêm tính năng mới không ảnh hưởng code cũ  
✅ **Team-friendly** - Nhiều người có thể làm việc song song  

Chi tiết:
- [User Interface Documentation](frontend/user/README.md)
- [Admin Panel Documentation](frontend/admin/README.md)

---

## �📋 Lộ trình phát triển

### Phase 1: Foundation & User Management ✅ (Đang thực hiện)
**Timeline: 2-3 tuần**

#### Week 1-2: Core Authentication
- [x] Thiết kế Database Schema
- [ ] Setup Backend Framework (Node.js + Express / Python + FastAPI / Java Spring Boot)
- [ ] User Registration & Login (Manual)
- [ ] OAuth2 Integration (Google, Facebook)
- [ ] JWT Token Management
- [ ] Email Verification
- [ ] Password Reset

#### Week 2-3: User Profile Management
- [ ] Profile CRUD Operations
- [ ] Avatar Upload & Storage
- [ ] Avatar AI Moderation (NSFW Detection)
- [ ] Activity Logging
- [ ] Account Status Management (Active, Warning, Banned)

---

### Phase 2: Content Management
**Timeline: 2-3 tuần**

#### Week 3-4: Post System
- [ ] Post CRUD Operations
- [ ] Media Upload (Images & Videos)
- [ ] Post Status Workflow (Pending → Review → Published/Rejected)
- [ ] Media Storage (AWS S3 / Cloudinary / Azure Blob)
- [ ] Soft Delete with 30-day retention

#### Week 5: Post Management Features
- [ ] Post Listing with Filters (Status, Date)
- [ ] Edit Post (triggers re-moderation)
- [ ] Post Visibility Settings (Public, Friends, Private)
- [ ] View Violation Details

---

### Phase 3: Social Features
**Timeline: 2 tuần**

#### Week 6-7: Interactions
- [ ] Like System (Posts & Comments)
- [ ] Comment System (with nested replies)
- [ ] Share/Repost Feature
- [ ] Comment AI Filtering (real-time)
- [ ] Newsfeed Algorithm (Friend posts + Recommendations)

#### Week 7: Friend System
- [ ] Friend Request (Send, Accept, Reject)
- [ ] Friend List
- [ ] Friend Suggestions (Mutual Friends, Interest-based)
- [ ] Block/Unblock Users

#### Week 7-8: Reporting
- [ ] Report Content (Posts, Comments, Users)
- [ ] Report Categorization
- [ ] Auto-hide after threshold (10 reports)
- [ ] Report Queue for Moderators

---

### Phase 4: Moderation System
**Timeline: 2-3 tuần**

#### Week 8-9: Moderator Dashboard
- [x] Moderation Queue (Priority-based)
- [x] Content Review Interface (Split View)
- [x] Moderator Actions (Approve, Reject, Ban)
- [ ] Lock Mechanism (prevent duplicate reviews)
- [ ] Batch Operations

#### Week 9-10: User Management
- [x] User Action System (Warn, Mute, Ban)
- [x] Violation History Tracking
- [ ] Appeal System
- [ ] Appeal Review Interface
- [ ] Moderator Performance Metrics

---

### Phase 5: AI Integration & Admin Panel
**Timeline: 3-4 tuần**

#### Week 10-12: AI Content Moderation
- [ ] **NLP Module**
  - [ ] Keyword Blacklist Matching (Aho-Corasick)
  - [ ] Fuzzy Matching (Levenshtein Distance)
  - [ ] Hate Speech Detection (BERT/ViBERT)
  - [ ] Spam Detection
  
- [ ] **Computer Vision Module**
  - [ ] NSFW Detection (Image Classification)
  - [ ] Violence Detection (Object Detection - YOLO)
  - [ ] OCR for Text in Images
  - [ ] Video Frame Sampling & Analysis

#### Week 12-13: AI Integration
- [ ] AI Confidence Score System
- [ ] Auto-approve/reject thresholds
- [ ] Grey Zone → Moderator Queue
- [ ] AI Suggestion for Moderators
- [ ] False Positive/Negative Tracking

#### Week 13-14: Admin Panel
- [x] User Management (CRUD, Role Assignment)
- [x] Moderator Management
- [ ] Blacklist Keyword Management
- [ ] AI Threshold Configuration
- [ ] System Settings Panel

#### Week 14: Analytics & Reporting
- [ ] Violation Statistics (Daily, Weekly, Monthly)
- [ ] Violation Type Distribution Charts
- [ ] Moderator Performance Dashboard
- [ ] User Growth & Activity Reports
- [ ] AI Accuracy Metrics

---

## 🗄️ Database Schema

### Core Tables

#### Users & Authentication
- `users` - User accounts
- `user_activity_logs` - Login history, actions
- `user_roles` - Role assignment (User, Moderator, Admin)

#### Content
- `posts` - User posts
- `post_media` - Images/Videos attached to posts
- `post_tags` - Auto-generated tags (NLP)
- `comments` - Post comments
- `likes` - Like tracking
- `shares` - Share/Repost tracking

#### Social Features
- `friendships` - Friend relationships
- `user_blocks` - Blocked users
- `user_interests` - User preferences (for recommendations)

#### Moderation
- `reports` - User reports
- `appeals` - User appeals
- `moderation_queue` - Items pending review
- `violation_history` - User violation records
- `banned_keywords` - Blacklisted keywords
- `moderator_metrics` - Moderator performance

#### System
- `system_settings` - Configurable parameters
- `notifications` - User notifications

---

## 🏗️ Tech Stack (Recommendations)

### Backend
**Option 1: Node.js Stack**
- Framework: Express.js / NestJS
- Database: MySQL / PostgreSQL
- ORM: Sequelize / Prisma
- Auth: Passport.js + JWT
- File Upload: Multer + AWS S3

**Option 2: Python Stack**
- Framework: FastAPI / Django
- Database: PostgreSQL
- ORM: SQLAlchemy / Django ORM
- Auth: OAuth2 + JWT
- AI Integration: TensorFlow, PyTorch, Transformers

**Option 3: Java Spring Boot Stack** (Enterprise)
- Framework: Spring Boot
- Database: PostgreSQL / MySQL
- ORM: Hibernate / JPA
- Auth: Spring Security + OAuth2
- AI: OpenCV, Deeplearning4j

### AI/ML
- NLP: Hugging Face Transformers (BERT, ViT)
- Computer Vision: TensorFlow, PyTorch, OpenCV
- Image Classification: ResNet, EfficientNet
- Object Detection: YOLO, Faster R-CNN
- OCR: Tesseract, PaddleOCR

### Storage
- Database: PostgreSQL / MySQL
- Cache: Redis
- File Storage: AWS S3 / Azure Blob / Cloudinary
- Search: Elasticsearch (optional)

### Infrastructure
- Queue: RabbitMQ / Apache Kafka (for AI processing)
- Container: Docker
- Orchestration: Kubernetes (production)
- Monitoring: Prometheus + Grafana

---

## 🚀 Getting Started

### Prerequisites
- Database: MySQL 8.0+ hoặc PostgreSQL 13+
- Runtime: Node.js 18+ / Python 3.9+ / Java 17+
- Package Manager: npm/yarn / pip / maven

### Installation

1. **Clone Repository**
```bash
git clone <repository-url>
cd social-media-moderation
```

2. **Database Setup**
```bash
# Import schema
mysql -u root -p < database_schema.sql

# Or for PostgreSQL
psql -U postgres -d your_database < database_schema.sql
```

3. **Backend Setup**
```bash
cd backend
npm install  # or pip install -r requirements.txt
cp .env.example .env
# Configure environment variables
```

4. **Run Application**
```bash
npm run dev  # or python main.py
```

---

## 📊 Database Design Highlights

### User Status Management
- **Active**: Full permissions
- **Warning**: View-only mode (1-2 violations)
- **Banned**: Permanent or temporary block

### Post Moderation Flow
```
User submits → Status: PENDING
      ↓
   AI Analysis
      ↓
  Confidence > 80%? → Auto Approve/Reject
      ↓
  50-80%? → Send to Moderator Queue
      ↓
  Moderator Review → Final Decision
```

### AI Confidence Zones
- **>80%**: Auto-action (approve/reject)
- **50-80%**: Grey zone → Human review
- **<50%**: Auto-approve

### Report Thresholds
- 1 report → Low priority queue
- 10+ reports → Auto-hide + High priority review

---

## 🔐 Security Features

- Password hashing (bcrypt)
- JWT token authentication
- OAuth2 integration
- Email verification
- Rate limiting
- IP logging
- XSS protection
- SQL injection prevention

---

## 📈 Performance Considerations

- Indexed database queries
- Redis caching for frequent queries
- Async AI processing (job queue)
- CDN for media delivery
- Database connection pooling
- Pagination for large datasets

---

## 🧪 Testing Strategy

- Unit Tests: Core business logic
- Integration Tests: API endpoints
- E2E Tests: Critical user flows
- Load Testing: Concurrent users
- AI Model Testing: Accuracy metrics

---

## 📝 API Documentation

(Coming soon - Swagger/OpenAPI)

---

## 🛡️ Admin Panel

Admin Panel được tổ chức riêng trong thư mục `frontend/admin/` để dễ dàng quản lý và phát triển.

### Cấu trúc
```
frontend/admin/
├── index.html        # Giao diện chính
├── css/
│   └── admin.css    # Styles riêng cho admin
└── js/
    └── admin.js     # Logic xử lý admin
```

### Tính năng
- 📝 **Quản lý Bài viết**: Duyệt/từ chối bài, mute user vi phạm
- 👥 **Quản lý Người dùng**: Ban/unban, xem lịch sử vi phạm
- ⏳ **Hàng đợi duyệt**: Xử lý bài viết chờ kiểm duyệt

### Truy cập
URL: http://127.0.0.1:5000/admin

Chi tiết xem: [frontend/admin/README.md](frontend/admin/README.md)

---

## 🤝 Contributing

(Guidelines for team collaboration)

---

## 📄 License

(Your license here)

---

## 📞 Support

(Contact information)
