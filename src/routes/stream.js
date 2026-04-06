const pool = require('../db/pool');
const { minioClient, HLS_BUCKET, THUMB_BUCKET } = require('../services/minio');
const { transcodeQueue, cleanupQueue } = require('../services/queues');
const { verifyJWT, requireRole } = require('../middleware/auth');
const { redis } = require('../services/redis');

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
        // Updated to single original resolution subdirectory
        streams = {
          master: `/hls/${id}/master.m3u8`,
          'Original': `/hls/${id}/original/index.m3u8`,
          thumbnail: `/thumbnails/${id}.jpg`
        };
      }

      return reply.send({ ...video, playUrl: streams ? streams.master : null, streams });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // SSE Progress Endpoint
  fastify.get('/:id/progress', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { id } = request.params;

    // Set SSE headers manually
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    // 1. Push current state immediately
    try {
      const { rows } = await pool.query('SELECT progress, status FROM videos WHERE id = $1', [id]);
      if (rows[0]) {
        reply.raw.write(`data: ${JSON.stringify(rows[0])}\n\n`);
        if (rows[0].status === 'ready' || rows[0].status === 'error') {
          return reply.raw.end();
        }
      }
    } catch (err) {
      fastify.log.error('SSE initial state fetch error:', err);
    }

    // 2. Subscribe to Redis for real-time updates
    const sub = redis.duplicate();
    await sub.subscribe(`progress:${id}`);

    const cleanup = () => {
      sub.unsubscribe(`progress:${id}`).catch(() => {});
      sub.disconnect(); // Use disconnect or quit
      reply.raw.end();
    };

    sub.on('message', (channel, message) => {
      reply.raw.write(`data: ${message}\n\n`);
      const data = JSON.parse(message);
      if (data.status === 'ready' || data.status === 'error') {
        cleanup();
      }
    });

    // Handle client disconnect
    request.raw.on('close', cleanup);

    // Keep the request open
  });

  // List videos
  fastify.get('/', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { page = 1, limit = 10, search, course_id } = request.query;
    const offset = (page - 1) * limit;

    try {
      // Include progress in list
      let query = 'SELECT id, title, course_id, access_level, status, duration_seconds, progress, created_at FROM videos WHERE 1=1';
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

  // Polling endpoint (Legacy support, now includes progress)
  fastify.get('/:id/status', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { id } = request.params;
    try {
      const { rows } = await pool.query('SELECT status, progress FROM videos WHERE id = $1', [id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });
      return reply.send(rows[0]);
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

      // 1. Cancel any active/waiting transcode job
      const transcodeJob = await transcodeQueue.getJob(id);
      if (transcodeJob) {
        await transcodeJob.remove();
      }

      // 2. Offload cleanup to background worker
      await cleanupQueue.add('cleanup', { video_id: id });

      // 3. Delete from DB immediately (Optimistic response depends on this being fast)
      await pool.query('DELETE FROM videos WHERE id = $1', [id]);

      return reply.send({ message: 'Video deletion started' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
