// This script starts all background workers
const transcoder = require('./transcoder');
const cleanup = require('./cleanup');

const pool = require('../db/pool');
const { redis } = require('../services/redis');

async function main() {
  console.log('Initializing all workers...');
  
  // Start both workers. They run their own loops.
  transcoder.start();
  cleanup.start();
  
  console.log('All workers (transcoder, cleanup) are running.');
}

const closeGracefully = async (signal) => {
  console.log(`[All Workers] Received signal to terminate: ${signal}`);
  
  // Close both workers gracefully
  await Promise.all([
    transcoder.worker.close(),
    cleanup.worker.close()
  ]);
  
  // Close shared connections
  await pool.end();
  await redis.quit();
  
  console.log('All workers and connections closed.');
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

main().catch(err => {
  console.error('Fatal error starting workers:', err);
  process.exit(1);
});
