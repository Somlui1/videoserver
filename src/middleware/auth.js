const verifyJWT = async (request, reply) => {
  try {
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
        reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  };
};

module.exports = { verifyJWT, requireRole };
