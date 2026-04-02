const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'changeme';
  // Sign token with 24h expiration
  return jwt.sign(payload, secret, { expiresIn: '24h' });
};

module.exports = { generateToken };
