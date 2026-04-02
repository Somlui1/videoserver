require('dotenv').config();
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const fastifyJwt = require('@fastify/jwt');
const fastifyMultipart = require('@fastify/multipart');

const pool = require('./db/pool');

const isProduction = process.env.NODE_ENV === 'production';

const app = Fastify({
  // Trust proxy headers from nginx (X-Forwarded-For, X-Forwarded-Proto)
  trustProxy: true,
  logger: isProduction
    ? { level: 'info' }    // JSON logs for production (no pino-pretty)
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      }
});

app.register(cors, {
  origin: true,
  credentials: true
});

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'changeme'
});

app.register(fastifyMultipart, {
  limits: {
    fileSize: 4 * 1024 * 1024 * 1024 // 4GB
  }
});

// Registers auth decorator directly
app.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Register Routes
app.register(require('./routes/auth'), { prefix: '/api/auth' });
app.register(require('./routes/upload'), { prefix: '/api/videos' });
app.register(require('./routes/stream'), { prefix: '/api/videos' });
app.register(require('./routes/admin'), { prefix: '/api/admin' });

// Healthcheck
app.get('/api/health', async (request, reply) => {
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = 'error';
    app.log.error(err, 'DB Healthcheck failed');
  }
  
  return { 
    status: 'ok', 
    db: dbStatus,
    timestamp: new Date().toISOString()
  };
});

// Setup Graceful Shutdown
const closeGracefully = async (signal) => {
  app.log.info(`Received signal to terminate: ${signal}`);
  await app.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    app.log.info('Server started successfully');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;
