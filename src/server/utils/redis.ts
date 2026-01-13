/**
 * Redis utility functions for pub/sub
 */

import { redis } from '../db/redis.js';

/**
 * Publish a message to a Redis channel
 * @param channel - Redis channel name
 * @param message - Message to publish (will be stringified if object)
 */
export async function publishToRedis(channel: string, message: string | object): Promise<void> {
  try {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    await redis.publish(channel, payload);
  } catch (error) {
    console.error(`[Redis] Failed to publish to channel "${channel}":`, error);
    throw error;
  }
}

/**
 * Subscribe to a Redis channel
 * @param channel - Redis channel name
 * @param handler - Message handler function
 */
export async function subscribeToRedis(
  channel: string,
  handler: (message: string, channel: string) => void
): Promise<void> {
  const subscriber = redis.duplicate();
  
  subscriber.on('message', handler);
  await subscriber.subscribe(channel);
}
