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

export const createRedisClient = (): Redis => {
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (isTestEnv) {
    return new NoopRedis() as unknown as Redis;
  }

  if (!env.redisUrl) {
    console.warn('[Redis] REDIS_URL missing; Redis-backed features are disabled (configure Upstash or another provider).');
    return new NoopRedis() as unknown as Redis;
  }

  let parsedUrl: URL | undefined;
  try {
    parsedUrl = new URL(env.redisUrl);
  } catch (error) {
    console.warn('[Redis] Failed to parse REDIS_URL; falling back to raw string.');
  }

  console.info('[Redis] Initializing connection', {
    host: parsedUrl?.hostname ?? 'unknown',
    port: parsedUrl?.port ?? '6379',
    useTls: env.redisUseTls,
    rejectUnauthorized: env.redisTlsRejectUnauthorized
  });

  let redisOptions: RedisOptions | undefined;
  if (env.redisUseTls) {
    const tlsHost = parsedUrl?.hostname;
    if (tlsHost) {
      redisOptions = {
        tls: {
          rejectUnauthorized: env.redisTlsRejectUnauthorized,
          servername: tlsHost
        }
      };
      console.info('[Redis] TLS enabled for connection', {
        host: tlsHost,
        rejectUnauthorized: env.redisTlsRejectUnauthorized
      });
    } else {
      console.warn('[Redis] Unable to determine hostname for TLS configuration, proceeding without TLS');
    }
  } else {
    console.info('[Redis] Connecting without TLS');
  }

  const client = redisOptions ? new Redis(env.redisUrl, redisOptions) : new Redis(env.redisUrl);
  
  client.on('connect', () => {
    console.info('[Redis] ✅ Connected successfully');
  });
  
  client.on('ready', () => {
    console.info('[Redis] ✅ Ready to accept commands');
  });
  
  client.on('error', (error: Error) => {
    console.error('[Redis] ❌ Connection error:', error.message);
    console.error('[Redis] Error details:', error);
  });
  
  client.on('close', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Redis] ⚠️  Connection closed');
    }
  });
  
  client.on('reconnecting', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Redis] 🔄 Reconnecting...');
    }
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
