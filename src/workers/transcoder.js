require('dotenv').config();
const { Worker } = require('bullmq');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const pool = require('../db/pool');
const { minioClient, RAW_BUCKET, HLS_BUCKET, THUMB_BUCKET } = require('../services/minio');
const { transcodeToHLS, extractThumbnail } = require('../services/ffmpeg');

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
};

const processVideo = async (job) => {
  const { video_id, objectName, ext } = job.data;
  
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `transcode-${video_id}-`));
  const rawFilePath = path.join(tmpDir, `input${ext}`);
  const hlsDir = path.join(tmpDir, 'hls');
  const thumbPath = path.join(tmpDir, 'thumb.jpg');
  
  try {
    // 1. Update DB start
    await pool.query("UPDATE videos SET status = 'transcoding' WHERE id = $1", [video_id]);

    // 2. Download raw file from MinIO
    await minioClient.fGetObject(RAW_BUCKET, objectName, rawFilePath);

    // 3. Extract Thumbnail
    await extractThumbnail(rawFilePath, thumbPath);
    await minioClient.fPutObject(THUMB_BUCKET, `${video_id}.jpg`, thumbPath, { 'Content-Type': 'image/jpeg' });

    // 4. Run FFmpeg Transcoding
    await transcodeToHLS(rawFilePath, hlsDir);

    // 5. Upload HLS files to MinIO
    await uploadDirToMinio(HLS_BUCKET, video_id, hlsDir);

    // 6. Delete raw file from MinIO
    await minioClient.removeObject(RAW_BUCKET, objectName);

    // 7. Update DB success
    await pool.query("UPDATE videos SET status = 'ready' WHERE id = $1", [video_id]);
    
    return { success: true };
  } catch (err) {
    console.error(`Error processing job ${job.id}:`, err);
    await pool.query("UPDATE videos SET status = 'error' WHERE id = $1", [video_id]);
    throw err;
  } finally {
    // Cleanup temporary files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(console.error);
  }
};

const uploadDirToMinio = async (bucket, prefix, dirPath) => {
  const uploadRecursive = async (currentPath, bucketPrefix) => {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (let entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await uploadRecursive(fullPath, `${bucketPrefix}/${entry.name}`);
      } else {
        const fileExt = path.extname(entry.name);
        const metaData = {};
        if (fileExt === '.m3u8') metaData['Content-Type'] = 'application/vnd.apple.mpegurl';
        else if (fileExt === '.ts') metaData['Content-Type'] = 'video/MP2T';
        
        await minioClient.fPutObject(bucket, `${bucketPrefix}/${entry.name}`, fullPath, metaData);
      }
    }
  };
  await uploadRecursive(dirPath, prefix);
};

// Setup worker
const worker = new Worker('transcode', processVideo, {
  connection,
  concurrency: 1, // Limit concurrency depending on server CPU
  autorun: false // We start it manually below
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
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

if (require.main === module) {
  start();
}
