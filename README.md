# Moodle Video Server

A lightweight, robust video hosting server built for Moodle e-Learning platforms. It provides video uploads, background HLS transcoding using FFmpeg, storage in MinIO, and direct serving via Nginx.

## Features
- Scalable HLS Transcoding via BullMQ + Redis
- S3-compatible Video Storage using MinIO
- Reverse Proxy Caching and CORS with Nginx
- Fastify Node.js Application with JWT Auth

## Getting Started

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Update the values in .env appropriately.
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```
   This will spin up:
   - `video-server-app` (Fastify Server)
   - `video-server-worker` (BullMQ Transcoder Worker)
   - `video-server-minio` (S3 Storage)
   - `video-server-postgres` (Database)
   - `video-server-redis` (Job Queue / Cache)
   - `video-server-nginx` (Reverse Proxy for API + HLS)

3. **Database Initialization**
   The PostgreSQL database schema is automatically applied on first start, seeding an admin user:
   - Email: `admin@company.com`
   - Password: `password`

## Architecture

- **Upload:** Users authenticate with a JWT token to upload to `/api/videos/upload`. Raw videos are temporarily stored in MinIO's `raw-videos` bucket. A job is then queued via Redis to BullMQ.
- **Worker:** The transcoder worker picks up the job, downloads the file, calls FFmpeg to generate 360p, 720p, and 1080p HLS playlists + `.ts` fragments + thumbnail, then re-uploads to `hls-videos` and `thumbnails` buckets in MinIO.
- **Streaming:** Moodle directly fetches HLS via the Nginx proxy, passing through the `:80/hls/{video_id}/master.m3u8` endpoint which efficiently caches files with byte-range support.

## Endpoints Summary

- `POST /api/auth/login`
- `POST /api/videos/upload`
- `GET /api/videos/:id`
- `GET /api/videos`
- `GET /api/videos/:id/status`
- `DELETE /api/videos/:id`
- `GET /api/admin/videos`
- `GET /api/admin/jobs`
- `PATCH /api/admin/videos/:id`
