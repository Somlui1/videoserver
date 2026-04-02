const pool = require('../db/pool');
const { minioClient, HLS_BUCKET, THUMB_BUCKET } = require('../services/minio');
const { verifyJWT, requireRole } = require('../middleware/auth');

module.exports = async function (fastify, opts) {
  // Get video metadata + presigned URL
  fastify.get('/:id', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { id } = request.params;
    try {
      const { rows } = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });

      const video = rows[0];

      // Access check
      if (video.access_level === 'private' && video.uploader_id !== request.user.id && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      let streams = null;
      if (video.status === 'ready') {
        // Since the MinIO bucket is public and proxied via Nginx's /hls/,
        // we return clean, public-facing relative paths that the frontend can use directly.
        streams = {
          master: `/hls/${id}/master.m3u8`,
          '1080p': `/hls/${id}/1080p/index.m3u8`,
          '720p': `/hls/${id}/720p/index.m3u8`,
          '360p': `/hls/${id}/360p/index.m3u8`,
          thumbnail: `/thumbnails/${id}.jpg` // Optional if Nginx proxies /thumbnails/
        };
      }

      return reply.send({ ...video, playUrl: streams ? streams.master : null, streams });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // List videos
  fastify.get('/', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { page = 1, limit = 10, search, course_id } = request.query;
    const offset = (page - 1) * limit;

    try {
      let query = 'SELECT id, title, course_id, access_level, status, duration_seconds, created_at FROM videos WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (course_id) {
        query += ` AND course_id = $${paramCount}`;
        params.push(course_id);
        paramCount++;
      }

      if (search) {
        query += ` AND title ILIKE $${paramCount}`;
        params.push(`%${search}%`);
        paramCount++;
      }

      // Viewer restriction 
      if (request.user.role === 'viewer') {
        query += ` AND (access_level = 'org' OR access_level = 'enrolled')`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const { rows } = await pool.query(query, params);
      return reply.send({ data: rows, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Polling endpoint
  fastify.get('/:id/status', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { id } = request.params;
    try {
      const { rows } = await pool.query('SELECT status FROM videos WHERE id = $1', [id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });
      return reply.send({ status: rows[0].status });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete video
  fastify.delete('/:id', { preHandler: [verifyJWT, requireRole(['uploader', 'admin'])] }, async (request, reply) => {
    const { id } = request.params;
    try {
      const { rows } = await pool.query('SELECT uploader_id FROM videos WHERE id = $1', [id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });

      const video = rows[0];
      if (video.uploader_id !== request.user.id && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Cleanup MinIO HLS bucket
      const objectsStream = minioClient.listObjectsV2(HLS_BUCKET, `${id}/`, true);
      const objectsToRemove = [];
      for await (const obj of objectsStream) {
        objectsToRemove.push(obj.name);
      }
      if (objectsToRemove.length > 0) {
        await minioClient.removeObjects(HLS_BUCKET, objectsToRemove);
      }

      // Remove Thumbnail
      await minioClient.removeObject(THUMB_BUCKET, `${id}.jpg`).catch(() => { });

      // Delete from DB
      await pool.query('DELETE FROM videos WHERE id = $1', [id]);

      return reply.send({ message: 'Video deleted successfully' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
