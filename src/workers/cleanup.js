require('dotenv').config();
const { Worker, Queue } = require('bullmq');
const { deletePrefix, HLS_BUCKET, RAW_BUCKET, THUMB_BUCKET, minioClient } = require('../services/minio');
const pool = require('../db/pool');
const { redis } = require('../services/redis');

const { cleanupQueue, connection } = require('../services/queues');

const processCleanup = async (job) => {
  const { video_id } = job.data;
  console.log(`[Cleanup] Starting cleanup for video: ${video_id}`);

  try {
    // 1. Cleanup HLS segments
    console.log(`[Cleanup] Deleting HLS segments for ${video_id}...`);
    await deletePrefix(HLS_BUCKET, `${video_id}/`);

    // 2. Cleanup Thumbnail
    console.log(`[Cleanup] Deleting thumbnail for ${video_id}...`);
    await minioClient.removeObject(THUMB_BUCKET, `${video_id}.jpg`).catch(() => { });

    // 3. Cleanup Raw file (if exists)
    // We check common extensions or just use a prefix search in RAW_BUCKET if needed
    // However, usually RAW_BUCKET objects are named with video_id + extension
    // Let's list and delete anything starting with video_id in RAW_BUCKET just in case
    console.log(`[Cleanup] Deleting raw files for ${video_id}...`);
    await deletePrefix(RAW_BUCKET, `${video_id}`);

    console.log(`[Cleanup] Finished cleanup for video: ${video_id}`);
    return { success: true };
  } catch (err) {
    console.error(`[Cleanup] Error cleaning up video ${video_id}:`, err);
    throw err;
  }
};

const worker = new Worker('cleanup', processCleanup, {
  connection,
  concurrency: 5,
  autorun: false
});

worker.on('failed', (job, err) => {
  console.error(`Cleanup job ${job.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`Cleanup job ${job.id} has completed!`);
});

const start = async () => {
  console.log('Cleanup worker started. Listening for jobs...');
  worker.run();
};

const closeGracefully = async (signal) => {
  console.log(`[Cleanup] Received signal to terminate: ${signal}`);
  await worker.close();
  // We don't close pool/redis here because they might be shared,
  // but if run standalone, we should.
  if (require.main === module) {
    await pool.end();
    await redis.quit();
    process.exit(0);
  }
};

if (require.main === module) {
  process.on('SIGINT', () => closeGracefully('SIGINT'));
  process.on('SIGTERM', () => closeGracefully('SIGTERM'));
  start();
}

module.exports = { 
  cleanupQueue, 
  start, 
  worker, 
  closeGracefully 
};
