const verifyJWT = async (request, reply) => {
  try {
    // Support token from query param for SSE (EventSource doesn't support headers)
    if (request.query && request.query.token) {
      request.headers.authorization = `Bearer ${request.query.token}`;
    }
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
  }
};

const requireRole = (allowedRoles) => {
  return async (request, reply) => {
    try {
      // Assuming verifyJWT was called before this middleware in preHandler
      const userRole = request.user.role;
      if (userRole === 'admin') return; // Admin bypasses role restrictions
      if (!allowedRoles.includes(userRole)) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  };
};

module.exports = { verifyJWT, requireRole };
