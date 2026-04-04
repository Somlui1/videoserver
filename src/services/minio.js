const Minio = require('minio');
const fs = require('fs/promises');
const path = require('path');

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
 */
const deletePrefix = async (bucket, prefix) => {
  const objectsStream = minioClient.listObjectsV2(bucket, prefix, true);
  const objectsToRemove = [];
  for await (const obj of objectsStream) {
    objectsToRemove.push(obj.name);
  }
  if (objectsToRemove.length > 0) {
    await minioClient.removeObjects(bucket, objectsToRemove);
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

initBuckets();

module.exports = {
  minioClient,
  RAW_BUCKET,
  HLS_BUCKET,
  THUMB_BUCKET,
  uploadDir,
  deletePrefix
};
