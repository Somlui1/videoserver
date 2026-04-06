const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { generateToken } = require('../services/jwt');
const { verifyJWT } = require('../middleware/auth');

module.exports = async function (fastify, opts) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const { rows } = await pool.query('SELECT id, email, password_hash, name, role FROM users WHERE email = $1', [email]);
      
      if (rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const user = rows[0];
      
      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      return reply.send({ 
        token, 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch('/profile', { preHandler: [verifyJWT] }, async (request, reply) => {
    const { name, email } = request.body;
    const userId = request.user.id;

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.code(400).send({ error: 'Invalid email format' });
      }

      // Check if email is taken by another user
      const { rows } = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (rows.length > 0) {
        return reply.code(400).send({ error: 'Email already in use' });
      }
    }

    try {
      const { rows } = await pool.query(
        'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3 RETURNING id, email, name, role',
        [name, email, userId]
      );

      if (rows.length === 0) return reply.code(404).send({ error: 'User not found' });

      return reply.send(rows[0]);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
