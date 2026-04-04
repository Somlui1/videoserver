require('dotenv').config();
const { Worker } = require('bullmq');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const pool = require('../db/pool');
const { minioClient, RAW_BUCKET, HLS_BUCKET, THUMB_BUCKET, uploadDir, deletePrefix } = require('../services/minio');
const { transcodeToHLS, extractThumbnail, getMetadata } = require('../services/ffmpeg');
const { redis } = require('../services/redis');

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
};

const THROTTLE_MS = 5000;

const processVideo = async (job) => {
  const { video_id, objectName, ext } = job.data;
  
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `transcode-${video_id}-`));
  const rawFilePath = path.join(tmpDir, `input${ext}`);
  const hlsDir = path.join(tmpDir, 'hls');
  const thumbPath = path.join(tmpDir, 'thumb.jpg');
  
  let lastDbWrite = 0;

  try {
    // 1. Update DB start
    await pool.query("UPDATE videos SET status = 'transcoding', progress = 0 WHERE id = $1", [video_id]);

    // 2. Download raw file from MinIO
    await minioClient.fGetObject(RAW_BUCKET, objectName, rawFilePath);

    // 3. Extract Metadata & Thumb
    const metadata = await getMetadata(rawFilePath);
    await pool.query("UPDATE videos SET duration_seconds = $1 WHERE id = $2", [Math.round(metadata.duration), video_id]);
    
    await extractThumbnail(rawFilePath, thumbPath);
    await minioClient.fPutObject(THUMB_BUCKET, `${video_id}.jpg`, thumbPath, { 'Content-Type': 'image/jpeg' });

    // 4. Run FFmpeg Transcoding (clamps at 99%)
    await transcodeToHLS(rawFilePath, hlsDir, {
      onProgress: async ({ percent }) => {
        // Percent is already clamped at 99 in ffmpeg.js
        await redis.publish(`progress:${video_id}`, JSON.stringify({
          percent,
          status: 'transcoding'
        }));

        const now = Date.now();
        if (now - lastDbWrite >= THROTTLE_MS) {
          await pool.query("UPDATE videos SET progress = $1 WHERE id = $2", [percent, video_id]);
          lastDbWrite = now;
        }
      },
      onStart: async (cmd) => {
        console.log(`[Job ${job.id}] Started FFmpeg:`, cmd);
        // Immediate 0% update so UI knows transcoding started
        await redis.publish(`progress:${video_id}`, JSON.stringify({
          percent: 0,
          status: 'transcoding'
        }));
      },
      // Handlers for error finalization; set 100% only after storage upload is done.
      onError: async (err) => {
        await redis.publish(`progress:${video_id}`, JSON.stringify({
          percent: -1,
          status: 'error',
          error: err.message
        }));
        await pool.query(
          "UPDATE videos SET status = 'error', progress = -1, failed_at = NOW() WHERE id = $1", 
          [video_id]
        );
      }
    });

    // 5. Upload HLS files to MinIO (Final push before 100%)
    await uploadDir(HLS_BUCKET, video_id, hlsDir);

    // 6. Delete raw file from MinIO
    await minioClient.removeObject(RAW_BUCKET, objectName);

    // 7. Update DB success (Now 100% as storage is confirmed)
    await pool.query("UPDATE videos SET status = 'ready', progress = 100 WHERE id = $1", [video_id]);
    await redis.publish(`progress:${video_id}`, JSON.stringify({
      percent: 100,
      status: 'ready'
    }));

    return { success: true };
  } catch (err) {
    console.error(`Error processing job ${job.id}:`, err);
    
    // Cleanup partial HLS uploads to save space / avoid half-broken streams
    try {
      await deletePrefix(HLS_BUCKET, `${video_id}/`);
    } catch (_) { /* ignore prefix cleanup errors */ }

    // Ensure status is terminal if error occurred outside onProgress
    await pool.query(
      "UPDATE videos SET status = 'error', progress = -1, failed_at = NOW() WHERE id = $1", 
      [video_id]
    );
    await redis.publish(`progress:${video_id}`, JSON.stringify({
      percent: -1,
      status: 'error',
      error: err.message
    }));
    
    throw err;
  } finally {
    // Cleanup temporary files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(console.error);
  }
};

// Setup worker
// Default concurrency 1 to prevent OOM on memory-constrained servers.
// Can be increased for GPU-accelerated environments or high-RAM instances.
const worker = new Worker('transcode', processVideo, {
  connection,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1'),
  autorun: false
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

const start = async () => {
  console.log('Worker started. Listening for jobs...');
  worker.run();
};

const closeGracefully = async (signal) => {
  console.log(`Received signal to terminate: ${signal}`);
  await worker.close();
  await pool.end();
  await redis.quit();
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

if (require.main === module) {
  start();
}
