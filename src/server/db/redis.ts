import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

class NoopRedis {
  status: Redis['status'] = 'end';

  publish(): Promise<number> {
    return Promise.resolve(0);
  }

  subscribe(): Promise<number> {
    return Promise.resolve(0);
  }

  duplicate(): this {
    return this;
  }

  on(): this {
    return this;
  }

  get(): Promise<string | null> {
    return Promise.resolve(null);
  }

  set(): Promise<'OK'> {
    return Promise.resolve('OK');
  }

  lpush(): Promise<number> {
    return Promise.resolve(0);
  }

  ltrim(): Promise<'OK'> {
    return Promise.resolve('OK');
  }

  lrange(): Promise<string[]> {
    return Promise.resolve([]);
  }

  quit(): Promise<'OK'> {
    return Promise.resolve('OK');
  }

  disconnect(): void {
    // noop
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __humanchatRedis__: Redis | undefined;
}

const globalRedis = globalThis as typeof globalThis & { __humanchatRedis__?: Redis };

const createRedisClient = (): Redis => {
  if (!env.redisUrl) {
    console.warn('[Redis] REDIS_URL missing; disabling Redis features until Memorystore is configured.');
    return new NoopRedis() as unknown as Redis;
  }

  let redisOptions: RedisOptions | undefined;
  if (env.redisUseTls) {
    try {
      const parsed = new URL(env.redisUrl);
      redisOptions = {
        tls: {
          rejectUnauthorized: env.redisTlsRejectUnauthorized,
          servername: parsed.hostname
        }
      };
      console.info('[Redis] TLS enabled for Memorystore connection', {
        host: parsed.hostname,
        rejectUnauthorized: env.redisTlsRejectUnauthorized
      });
    } catch (error) {
      console.warn('[Redis] Failed to parse REDIS_URL for TLS configuration, proceeding without TLS', error);
    }
  }

  const client = redisOptions ? new Redis(env.redisUrl, redisOptions) : new Redis(env.redisUrl);
  client.on('error', (error: Error) => {
    console.error('[Redis] connection error', error);
  });
  return client;
};

const sharedRedis: Redis = globalRedis.__humanchatRedis__ ?? createRedisClient();
if (!globalRedis.__humanchatRedis__) {
  globalRedis.__humanchatRedis__ = sharedRedis;
}

export const redis: Redis = sharedRedis;

export const shutdownRedis = async (): Promise<void> => {
  if (!redis || redis.status === 'end') {
    return;
  }

  try {
    await redis.quit();
  } catch (error) {
    redis.disconnect(false);
  } finally {
    globalRedis.__humanchatRedis__ = undefined;
  }
};
