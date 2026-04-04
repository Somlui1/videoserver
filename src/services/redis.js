'use strict';

const Redis = require('ioredis');

// Build redis connection string or config
const redisConfig = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
  maxRetriesPerRequest: null, // Critical for BullMQ compatibility
};

const redis = new Redis(redisConfig);

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

module.exports = {
  redis,
  redisConfig,
};
