import Redis from 'ioredis';

import { log, warn, error, Verbose } from './services.js'
import conf, { revealConf } from './conf.js'

export let redisClient = null

export async function connectToRedis() {
  if (conf.redis.enable) {
    redisClient = new Redis(conf.redis.url, {
      connectTimeout: conf.redis.connectTimeoutSeconds * 1000,
    });
    await redisClient.ping();
    log(`Connected to Redis at ${conf.redis.url}`);
  }
}

(async () => {
  if (conf.redis.enable) {
    await connectToRedis();
  }
})()
