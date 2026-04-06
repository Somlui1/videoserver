const Minio = require('minio');
const fs = require('fs/promises');
const path = require('path');
const { redis } = require('./redis');

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

const RAW_BUCKET = process.env.MINIO_BUCKET_RAW || 'raw-videos';
const HLS_BUCKET = process.env.MINIO_BUCKET_HLS || 'hls-videos';
const THUMB_BUCKET = process.env.MINIO_BUCKET_THUMBS || 'thumbnails';

/**
 * Recursively upload a directory to MinIO.
 */
const uploadDir = async (bucket, prefix, dirPath) => {
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

/**
 * Delete all objects with a given prefix in a bucket.
 * Handles large sets by batching removals in chunks of 1000.
 */
const deletePrefix = async (bucket, prefix) => {
  const objectsStream = minioClient.listObjectsV2(bucket, prefix, true);
  let batch = [];
  
  for await (const obj of objectsStream) {
    batch.push(obj.name);
    if (batch.length >= 1000) {
      await minioClient.removeObjects(bucket, batch);
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    await minioClient.removeObjects(bucket, batch);
  }
};

// Init buckets
const initBuckets = async () => {
  const buckets = [RAW_BUCKET, HLS_BUCKET, THUMB_BUCKET];
  for (const bucket of buckets) {
    try {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket);
        console.log(`Bucket ${bucket} created.`);
      }
    } catch (err) {
      console.error(`Error checking/creating bucket ${bucket}:`, err);
    }
  }

  // Set Public Read Policy on HLS and Thumbnails
  try {
    const publicPolicy = (bucketName) => ({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`]
        }
      ]
    });
    await minioClient.setBucketPolicy(HLS_BUCKET, JSON.stringify(publicPolicy(HLS_BUCKET)));
    await minioClient.setBucketPolicy(THUMB_BUCKET, JSON.stringify(publicPolicy(THUMB_BUCKET)));
    console.log('Public bucket policies applied successfully.');
  } catch (err) {
    console.error('Error setting bucket policies:', err);
  }
};

/**
 * Calculate total storage usage across all buckets with caching.
 */
const getTotalStorageUsage = async () => {
  const cacheKey = 'minio:storage_usage';
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.warn('Redis cache hit failed for storage usage:', err.message);
  }

  let totalBytes = 0;
  try {
    const buckets = [RAW_BUCKET, HLS_BUCKET, THUMB_BUCKET];
    for (const bucket of buckets) {
      const stream = minioClient.listObjectsV2(bucket, '', true);
      for await (const obj of stream) {
        totalBytes += obj.size;
      }
    }
  } catch (err) {
    console.error('Error listing MinIO objects for storage usage:', err);
    throw err;
  }

  const result = {
    bytes: totalBytes,
    formatted: (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    timestamp: new Date().toISOString()
  };

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5 min TTL
  } catch (err) {
    console.warn('Failed to cache storage usage in Redis:', err.message);
  }
  
  return result;
};

initBuckets();

module.exports = {
  minioClient,
  RAW_BUCKET,
  HLS_BUCKET,
  THUMB_BUCKET,
  uploadDir,
  deletePrefix,
  getTotalStorageUsage
};
