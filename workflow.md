# 🎬 Video Server — Project Architecture & Workflow

## 1. ภาพรวมโครงสร้าง Infrastructure (Docker Compose)

```mermaid
graph TB
    subgraph Internet["🌐 Internet"]
        User["👤 User / Browser"]
    end

    subgraph Docker["🐳 Docker Compose Network"]
        Nginx["🔒 Nginx\n(Reverse Proxy + SSL)\nPort 551→80, 552→443"]

        subgraph Frontend["Frontend"]
            Portal["⚛️ Portal\n(React + Vite)\nPort 4000"]
        end

        subgraph Backend["Backend"]
            App["⚡ Fastify App\n(REST API)\nPort 3000"]
            Worker["🔧 Worker\n(Transcoder)\nBullMQ Consumer"]
        end

        subgraph DataStores["Data Stores"]
            PG["🐘 PostgreSQL 15\n(Metadata DB)"]
            Redis["📮 Redis 7\n(Job Queue)"]
            MinIO["📦 MinIO\n(Object Storage)\nS3-Compatible"]
        end
    end

    User -->|"HTTPS :552"| Nginx
    Nginx -->|"/ → Portal"| Portal
    Nginx -->|"/api/ → App"| App
    Nginx -->|"/hls/ → MinIO"| MinIO
    Nginx -->|"/thumbnails/ → MinIO"| MinIO

    Portal -->|"REST API calls"| App
    App -->|"SQL Queries"| PG
    App -->|"Enqueue Jobs"| Redis
    App -->|"Upload Raw Video"| MinIO

    Worker -->|"Dequeue Jobs"| Redis
    Worker -->|"Update Status"| PG
    Worker -->|"Download Raw / Upload HLS"| MinIO

    style Nginx fill:#1a1a2e,stroke:#e94560,color:#fff
    style Portal fill:#16213e,stroke:#0f3460,color:#fff
    style App fill:#0f3460,stroke:#533483,color:#fff
    style Worker fill:#533483,stroke:#e94560,color:#fff
    style PG fill:#2d4059,stroke:#ea5455,color:#fff
    style Redis fill:#e94560,stroke:#fff,color:#fff
    style MinIO fill:#f07b3f,stroke:#fff,color:#fff
```

---

## 2. ขั้นตอนการ Upload & Transcode วิดีโอ (Step-by-Step)

```mermaid
sequenceDiagram
    actor User as 👤 User
    participant Nginx as 🔒 Nginx
    participant App as ⚡ Fastify API
    participant PG as 🐘 PostgreSQL
    participant MinIO as 📦 MinIO
    participant Redis as 📮 Redis (BullMQ)
    participant Worker as 🔧 Worker (Transcoder)

    Note over User,Worker: ── 🔑 Step 1: Login ──
    User->>Nginx: POST /api/auth/login {email, password}
    Nginx->>App: Proxy Forward
    App->>PG: SELECT user WHERE email = ?
    PG-->>App: user row (password_hash)
    App->>App: bcrypt.compare(password, hash)
    App-->>Nginx: { token: "JWT...", role: "uploader" }
    Nginx-->>User: JWT Token

    Note over User,Worker: ── 📤 Step 2: Upload Video ──
    User->>Nginx: POST /api/videos/upload<br/>(multipart/form-data + JWT)
    Nginx->>App: Proxy Forward (client_max_body_size 4G)
    App->>App: Verify JWT + Check Role (uploader/admin)
    App->>App: Validate file extension (.mp4, .mov, etc.)
    App->>App: Generate UUID → video_id
    App->>MinIO: putObject(raw-videos, "{video_id}/original.mp4", stream)
    MinIO-->>App: ✅ Upload Complete
    App->>PG: INSERT INTO videos (status='pending')
    PG-->>App: ✅ Row Inserted
    App->>Redis: transcodeQueue.add('processVideo', {video_id, objectName})
    Redis-->>App: ✅ Job Enqueued
    App-->>User: 201 { video_id, status: "pending" }

    Note over User,Worker: ── 🔄 Step 3: Transcode (Background Worker) ──
    Worker->>Redis: Dequeue Job
    Redis-->>Worker: { video_id, objectName, ext }
    Worker->>PG: UPDATE status = 'transcoding'

    Worker->>MinIO: fGetObject(raw-videos) → Download to /tmp
    MinIO-->>Worker: Raw video file

    Worker->>Worker: FFmpeg extractThumbnail (50% frame)
    Worker->>MinIO: fPutObject(thumbnails, "{video_id}.jpg")

    Worker->>Worker: FFmpeg transcodeToHLS<br/>→ 360p (800kbps)<br/>→ 720p (2500kbps)<br/>→ 1080p (5000kbps)<br/>+ master.m3u8

    Worker->>MinIO: Upload HLS segments & playlists → hls-videos/{video_id}/
    Worker->>MinIO: removeObject(raw-videos, original) → Cleanup raw
    Worker->>PG: UPDATE status = 'ready'
    Worker->>Worker: Cleanup /tmp files

    Note over User,Worker: ── 🔍 Step 4: Polling Status ──
    loop User polls every few seconds
        User->>Nginx: GET /api/videos/{id}/status (JWT)
        Nginx->>App: Proxy
        App->>PG: SELECT status FROM videos
        PG-->>App: { status }
        App-->>User: { status: "pending" | "transcoding" | "ready" | "error" }
    end
```

---

## 3. ขั้นตอนการ Stream / เล่นวิดีโอ (HLS Playback)

```mermaid
sequenceDiagram
    actor User as 👤 User (HLS Player)
    participant Nginx as 🔒 Nginx
    participant App as ⚡ Fastify API
    participant PG as 🐘 PostgreSQL
    participant MinIO as 📦 MinIO
    participant Cache as 💾 Nginx Cache

    Note over User,Cache: ── 📋 Step 1: Get Video Metadata ──
    User->>Nginx: GET /api/videos/{id} (JWT)
    Nginx->>App: Proxy Forward
    App->>PG: SELECT * FROM videos WHERE id = ?
    PG-->>App: Video metadata (status, access_level, etc.)
    App->>App: Check access (private/org/enrolled)
    App-->>User: { title, status: "ready",<br/>playUrl: "/hls/{id}/master.m3u8",<br/>streams: { 1080p, 720p, 360p },<br/>thumbnail: "/thumbnails/{id}.jpg" }

    Note over User,Cache: ── 🖼️ Step 2: Load Thumbnail ──
    User->>Nginx: GET /thumbnails/{id}.jpg
    Nginx->>MinIO: Proxy → /thumbnails/{id}.jpg
    MinIO-->>Nginx: JPEG image
    Nginx-->>User: Thumbnail image

    Note over User,Cache: ── 🎬 Step 3: HLS Adaptive Streaming ──
    User->>Nginx: GET /hls/{id}/master.m3u8
    Nginx->>MinIO: Rewrite → /hls-videos/{id}/master.m3u8
    MinIO-->>Nginx: Master playlist
    Nginx-->>User: master.m3u8 (no-cache, max-age=30)

    User->>User: HLS Player selects quality<br/>based on bandwidth

    User->>Nginx: GET /hls/{id}/720p/index.m3u8
    Nginx->>MinIO: Rewrite → /hls-videos/{id}/720p/index.m3u8
    MinIO-->>Nginx: Quality playlist
    Nginx-->>User: index.m3u8

    loop Load video segments
        User->>Nginx: GET /hls/{id}/720p/seg0001.ts
        alt Cache HIT
            Cache-->>User: Cached segment (max-age=3600)
        else Cache MISS
            Nginx->>MinIO: /hls-videos/{id}/720p/seg0001.ts
            MinIO-->>Nginx: .ts segment
            Nginx->>Cache: Store in hls_cache (1h)
            Nginx-->>User: Video segment
        end
    end
```

---

## 4. ระบบ Authentication & Authorization

```mermaid
flowchart TD
    A["🔑 POST /api/auth/login\n{email, password}"] --> B{ค้นหา User\nใน PostgreSQL}
    B -->|ไม่พบ| C["❌ 401 Invalid credentials"]
    B -->|พบ| D{ตรวจสอบรหัสผ่าน\nbcrypt.compare}
    D -->|ไม่ตรง| C
    D -->|ตรง| E["✅ สร้าง JWT Token\n{id, email, role}"]
    E --> F["📤 Response: { token, role }"]

    F --> G["📨 Request ต่อไป\nAuthorization: Bearer {token}"]
    G --> H{verifyJWT\nMiddleware}
    H -->|Invalid| I["❌ 401 Unauthorized"]
    H -->|Valid| J{requireRole\nMiddleware}
    J -->|Role = admin| K["✅ Allow (Admin bypass)"]
    J -->|Role ∈ allowedRoles| K
    J -->|Role ∉ allowedRoles| L["❌ 403 Forbidden"]

    subgraph Roles["👥 Role-Based Access"]
        R1["🛡️ admin\n• ทุกอย่าง\n• จัดการ videos\n• ดู jobs"]
        R2["📤 uploader\n• Upload video\n• Delete own video"]
        R3["👁️ viewer\n• ดูวิดีโอ org/enrolled\n• ไม่สามารถ upload"]
    end

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#0f3460,stroke:#533483,color:#fff
    style K fill:#2d6a4f,stroke:#fff,color:#fff
    style C fill:#e94560,stroke:#fff,color:#fff
    style I fill:#e94560,stroke:#fff,color:#fff
    style L fill:#e94560,stroke:#fff,color:#fff
```

---

## 5. Database ER Diagram

```mermaid
erDiagram
    USERS {
        UUID id PK "uuid_generate_v4()"
        VARCHAR email UK "NOT NULL"
        VARCHAR password_hash "bcrypt hashed"
        ENUM role "admin | uploader | viewer"
        TIMESTAMP created_at
    }

    VIDEOS {
        UUID id PK "uuid_generate_v4()"
        VARCHAR title "NOT NULL"
        TEXT description
        VARCHAR course_id "Moodle course link"
        ENUM access_level "private | enrolled | org"
        ENUM status "pending | transcoding | ready | error"
        UUID uploader_id FK "→ users.id"
        INTEGER duration_seconds
        BIGINT file_size_bytes
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    USERS ||--o{ VIDEOS : "uploads"
```

---

## 6. สรุป API Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/api/auth/login` | ❌ | — | Login รับ JWT Token |
| `POST` | `/api/videos/upload` | ✅ | uploader, admin | Upload วิดีโอ |
| `GET` | `/api/videos` | ✅ | any | List วิดีโอ (paginated) |
| `GET` | `/api/videos/:id` | ✅ | any | Metadata + HLS URLs |
| `GET` | `/api/videos/:id/status` | ✅ | any | Polling สถานะ transcode |
| `DELETE` | `/api/videos/:id` | ✅ | uploader (own), admin | ลบวิดีโอ + cleanup MinIO |
| `GET` | `/api/admin/videos` | ✅ | admin | List all วิดีโอ |
| `GET` | `/api/admin/jobs` | ✅ | admin | สถานะ BullMQ queue |
| `PATCH` | `/api/admin/videos/:id` | ✅ | admin | แก้ title, access_level |
| `GET` | `/api/health` | ❌ | — | Health check |

---

## 7. MinIO Storage Buckets

```mermaid
graph LR
    subgraph MinIO["📦 MinIO Object Storage"]
        B1["🎥 raw-videos\n(Private)\nTemp: original uploads"]
        B2["📺 hls-videos\n(Public Read)\nHLS segments & playlists"]
        B3["🖼️ thumbnails\n(Public Read)\nVideo thumbnail JPEGs"]
    end

    Upload["📤 Upload"] --> B1
    B1 -->|"Worker downloads\n& transcodes"| B2
    B1 -->|"Worker extracts\nthumbnail"| B3
    B1 -.->|"❌ Deleted after\ntranscode"| Trash["🗑️"]

    Nginx["🔒 Nginx"] -->|"/hls/*"| B2
    Nginx -->|"/thumbnails/*"| B3

    style B1 fill:#e94560,stroke:#fff,color:#fff
    style B2 fill:#0f3460,stroke:#fff,color:#fff
    style B3 fill:#533483,stroke:#fff,color:#fff
```
