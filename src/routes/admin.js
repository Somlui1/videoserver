const { Queue } = require('bullmq');
const pool = require('../db/pool');
const { verifyJWT, requireRole } = require('../middleware/auth');

const transcodeQueue = new Queue('transcode', {
  connection: {
    host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
    port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
  }
});

module.exports = async function (fastify, opts) {
  fastify.get('/videos', { preHandler: [verifyJWT, requireRole(['admin'])] }, async (request, reply) => {
    try {
      const { rows } = await pool.query('SELECT * FROM videos ORDER BY created_at DESC LIMIT 100');
      return reply.send({ data: rows });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/jobs', { preHandler: [verifyJWT, requireRole(['admin'])] }, async (request, reply) => {
    try {
      const waiting = await transcodeQueue.getWaitingCount();
      const active = await transcodeQueue.getActiveCount();
      const completed = await transcodeQueue.getCompletedCount();
      const failed = await transcodeQueue.getFailedCount();
      
      return reply.send({
        waiting, active, completed, failed
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch('/videos/:id', { preHandler: [verifyJWT, requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params;
    const { title, access_level } = request.body;
    
    try {
      const { rows } = await pool.query(
        'UPDATE videos SET title = COALESCE($1, title), access_level = COALESCE($2, access_level), updated_at = NOW() WHERE id = $3 RETURNING *',
        [title, access_level, id]
      );
      if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });
      
      return reply.send(rows[0]);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
