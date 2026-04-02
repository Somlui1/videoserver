# 🎥 Moodle Internal Video Server (HLS Streaming)
ระบบแพลตฟอร์มวิดีโอสตรีมมิ่งเซิร์ฟเวอร์แบบติดตั้งเอง (Self-Hosted) สำหรับองค์กร ทำหน้าที่เป็นระบบหลังบ้าน (Backend) ในการรับฝากวิดีโอ แปลงไฟล์ (Transcoding) เพื่อรองรับการสตรีมผ่านเครือข่ายความเร็วต่ำ และทำหน้าที่เก็บไฟล์วิดีโอเหมือน YouTube ย่อส่วน (Mini-YouTube) 

## 🏗 โครงสร้างและสถาปัตยกรรม (Architecture & Tech Stack)
ระบบถูกออกแบบโดยแยกส่วนการทำงานแบบ **Microservices-like (Dockerized)** โดยแบ่งออกเป็น 6 คอนเทนเนอร์หลักใน `docker-compose.yml`:

1. **Nginx (Reverse Proxy & Caching) - `Port 80`**
   - เป็นประตูหลักคอยรับ Traffic จากภายนอก
   - กระจาย API Request (ที่ขึ้นต้นด้วย `/api/`) ไปให้ Node.js App
   - ดึงไฟล์สตรีมมิ่ง (ที่ขึ้นต้นด้วย `/hls/`) จาก MinIO มาแสดงพร้อมระบบ CORS ป้องกันการดึงข้ามโดเมนเถื่อน 
2. **Node.js (Fastify API) - `video-server-app`**
   - จัดการ Request ของ Client เช่น ระบบ Login, Authentication (JWT), การสร้าง Metadata ตารางข้อมูล
   - รับไฟล์วิดีโอ (อัปโหลด) และส่งตรงเข้า MinIO Storage
3. **Node.js (BullMQ Worker) - `video-server-worker`**
   - ผู้ทำหน้าที่ "กรรมกรหลังบ้าน" ทำงานอยู่เบื้องหลัง ไม่กระทบ API ของหน้าเว็บ
   - ใช้ **FFmpeg** ดึงวิดีโอต้นฉบับมาหั่นเป็นชิ้นเล็กๆ ย่อยไฟล์ (`.ts` segments) เป็น 3 ความละเอียด (1080p, 720p, 360p) และแคปรูปขนาดย่อ
4. **PostgreSQL - `video-server-postgres`**
   - เก็บข้อมูลผู้ใช้งาน (Users), ข้อมูลวิดีโอ (Videos), สิทธิ์การมองเห็นวิดีโอ (Access Levels) และสถานะความคืบหน้า (Status)
5. **Redis - `video-server-redis`**
   - ทำหน้าที่รับส่งคิวงาน (Background Job Queue) ผ่าน BullMQ ระหว่าง Application กับ Worker
6. **MinIO (S3-Compatible Storage) - `video-server-minio`**
   - เสมือน AWS S3 เก็บไฟล์ระบบแยกเป็น 3 โกดัง:
     - `raw-videos` (ต้นฉบับ รอแปลง)
     - `hls-videos` (ไฟล์สตรีมที่หั่นแล้ว เป็น Public Bucket)
     - `thumbnails` (รูปปกวิดีโอปก)

---

## ✨ พฤติกรรมการทำงาน (The Workflow)
เมื่อมี User ต้องการอัปโหลดวิดีโอ กระบวนการจะทำงานดังนี้:
1. **[Browser]** ยิง `POST /api/videos/upload` พร้อมแนบวิดีโอ + JWT Token
2. **[Node.js API]** โยนไฟล์ขึ้นเก็บที่ MinIO Bucket `raw-videos` และเพิ่มฐานข้อมูล Videos Status: `pending`
3. **[Node.js API]** สั่งเพิ่มงาน (Job) เข้าไปต่อคิวใน **Redis** และส่ง Response `201 Created` กลับให้ User ทันที (ไม่ต้องรอให้แปลงไฟล์เสร็จ)
4. **[Worker]** จับสัญญาณจาก Redis ดึงงานออกมา, เปลี่ยนสถานะ DB เป็น `transcoding`, โหลดไฟล์ดั้งเดิมจาก MinIO
5. **[FFmpeg]** แปลงเป็น 360p, 720p, 1080p และสร้างไฟล์สารบัญ `master.m3u8`
6. **[Worker]** นำไฟล์อัปโหลดส่งไปที่ MinIO Bucket `hls-videos` ปรับ DB Status เป็น `ready` และลบไฟล์ดั้งเดิมทิ้ง

---

## 💻 คู่มือสำหรับ Frontend Web Developer: วิธีผูกหน้าเว็บเข้ากับเซิร์ฟเวอร์นี้
หากคุณต้องการเขียนเว็บไซต์ด้วย React, Vue, Moodle Page หรือแค่ HTML เปล่าๆ เพื่อเชื่อมกับระบบนี้ ให้ทำตามขั้นตอนต่อไปนี้:

### Step 1: ล็อกอินเพื่อขอ Access Token (JWT)
ระบบไม่อนุญาตให้อัปโหลดโดยพลการ ผู้ใช้หรือแอดมินต้อง Login เพื่อรับ Token เสมอ
- **Endpoint**: `POST http://<Server_IP>/api/auth/login`
- **Body JSON**: `{"email": "admin@company.com", "password": "password"}`
- **Response**: นำค่า `token` ที่ได้ เก็บไว้ในตัวแปรหรือ `localStorage` (มีรูปแบบเป็น JWT เริ่มต้นด้วย `eyJ...`)

### Step 2: การพัฒนาหน้าอัปโหลดวิดีโอ (Upload Pipeline)
ในฝั่ง Frontend ต้องใช้ `FormData` เพื่อส่งไฟล์ Binary แนบไปกับ Metadata
- **Endpoint**: `POST http://<Server_IP>/api/videos/upload`
- **Headers**: `"Authorization": "Bearer <TOKEN>"`
- **Body (FormData)**:
  - `file`: ไฟล์วิดีโอต้นฉบับ (mp4, mov)
  - `title`: ชื่อวิดีโอ
  - `course_id`: (ถ้ามี) จับคู่เข้ากับวิชาใน Moodle
  - `access_level`: ระดับการเข้าถึง (`private`, `enrolled` หรือ `org` ทุกคนในองค์กรดูได้)
- **Response**: ระบบจะให้ `{ "video_id": "uuid..." }` กลับมา

### Step 3: การ Polling เช็คสถานะการแปลงไฟล์
เขียน Frontend ให้ยิงเช็ค `GET /api/videos/<video_id>/status` บน Backend ทุกๆ 3-5 วินาที เพื่อเช็คว่า:
- `status: "pending"` -> รอคิวเข้ากระบวนการ
- `status: "transcoding"` -> FFmpeg กำลังทำงาน
- `status: "error"` -> แปลงไฟล์พัง
- `status: "ready"` -> เสร็จสมบูรณ์! หยุดการ Polling ได้

### Step 4: การดึงกลับมาแสดงผล (Streaming Player)
เมื่อวิดีโอ `ready` ให้ยิง API เพื่อดึง Metadata ทั้งหมดผ่าน Endpoint: `GET /api/videos/<video_id>` (แนบ Header `Authorization: Bearer <TOKEN>`) กลับมา คุณจะได้ข้อมูลพร้อมลิงก์:
```json
{
  "streams": {
    "master": "/hls/uuid.../master.m3u8",
    "1080p": "/hls/uuid.../1080p/index.m3u8",
    "720p": "/hls/uuid.../720p/index.m3u8",
    "360p": "/hls/uuid.../360p/index.m3u8"
  }
}
```

**การติดตั้ง Video Player ฝั่ง Browser**:
Browser ทั่วไปยกเว้น Safari จะไม่รู้จักไฟล์ `.m3u8` โดยกำเนิด ดังนั้นในฝั่งเว็บไซต์คุณต้องติดตั้ง Library **`hls.js`** หรือ **`video.js`**

**โครงสร้างโค้ด Player อย่างง่ายใน React / JS (ตัวอย่าง):**
```html
<video id="my-video" controls style="width: 100%;"></video>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  var video = document.getElementById('my-video');
  var videoUrl = 'http://<Server_IP>/hls/<video_id>/master.m3u8'; // นำมาจาก API
  
  if (Hls.isSupported()) {
    var hls = new Hls();
    hls.loadSource(videoUrl); // สตรีม HLS Adaptive Auto-Resolution
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = videoUrl; // รองรับ Safari Natively
  }
</script>
```

---

## 🔒 แนวทางด้าน Security และ CORS ที่ตั้งค่าไว้
- **อัปโหลดไฟล์ขนาดใหญ่**: Nginx และ Node.js ปลดล็อกให้รับได้สูงสุด **4GB**
- **CORS Access**: ขณะนี้ Nginx ถูกตั้งค่า `Access-Control-Allow-Origin: *` เพื่อให้นักพัฒนาเทสต์ Local ได้ แต่เมื่อใช้จริงคุณควรเปลี่ยนค่าใน `docker-compose.yml` -> `MOODLE_DOMAIN` ให้จำกัดวงเฉพาะ Domain Moodle ของบริษัท เพื่อป้องกันเว็บไซต์อื่นแฮ็กดึงวิดีโอ (Hotlinking) ไปใช้เปลืองเน็ตแบนด์วิดท์เซิร์ฟเวอร์ครับ!
