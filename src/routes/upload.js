const { v4: uuidv4 } = require('uuid');
const { Queue } = require('bullmq');
const path = require('path');
const pool = require('../db/pool');
const { minioClient, RAW_BUCKET } = require('../services/minio');
const { verifyJWT, requireRole } = require('../middleware/auth');

const transcodeQueue = new Queue('transcode', {
  connection: {
    host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
    port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
  }
});

const ALLOWED_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

module.exports = async function (fastify, opts) {
  fastify.post('/upload', { preHandler: [verifyJWT, requireRole(['uploader', 'admin'])] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const ext = path.extname(data.filename).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        return reply.code(400).send({ error: `File type not allowed. Allowed: ${ALLOWED_EXTS.join(', ')}` });
      }

      // Fields from multipart form
      const title = data.fields.title ? data.fields.title.value : data.filename;
      const description = data.fields.description ? data.fields.description.value : '';
      const course_id = data.fields.course_id ? data.fields.course_id.value : null;
      const access_level = data.fields.access_level ? data.fields.access_level.value : 'private';
      const uploader_id = request.user.id;

      const video_id = uuidv4();
      const objectName = `${video_id}/original${ext}`;

      // Stream to MinIO directly using minioClient.putObject
      // fastify-multipart file stream is a readable stream
      await minioClient.putObject(RAW_BUCKET, objectName, data.file);

      // Insert into PostgreSQL
      const insertQuery = `
        INSERT INTO videos (id, title, description, course_id, access_level, status, uploader_id)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      `;
      await pool.query(insertQuery, [video_id, title, description, course_id, access_level, uploader_id]);

      // Push to BullMQ
      await transcodeQueue.add('processVideo', { video_id, objectName, ext });

      return reply.code(201).send({ video_id, status: 'pending' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
