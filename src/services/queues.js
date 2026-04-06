const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
};

const transcodeQueue = new Queue('transcode', { connection });
const cleanupQueue = new Queue('cleanup', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

module.exports = {
  transcodeQueue,
  cleanupQueue,
  connection
};
