/**
 * LiveKit token generation and room management
 */

import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import { env } from '../config/env.js';

export interface GenerateTokenOptions {
  roomName: string;
  userId: string;
  userName: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  metadata?: string;
}

/**
 * Generate a LiveKit access token for a participant
 */
export async function generateLiveKitToken(options: GenerateTokenOptions): Promise<string> {
  const {
    roomName,
    userId,
    userName,
    canPublish = true,
    canSubscribe = true,
    canPublishData = true,
    metadata,
  } = options;

  // Validate required env vars
  if (!env.liveKitApiKey || !env.liveKitApiSecret) {
    throw new Error('LiveKit credentials not configured');
  }

  console.log('[LiveKit] Generating token:', {
    roomName,
    userId,
    userName,
    apiKeyPrefix: env.liveKitApiKey?.substring(0, 8),
    hasSecret: !!env.liveKitApiSecret,
  });

  // Add unique suffix to prevent duplicate identity errors
  // LiveKit rejects connections with the same identity in the same room
  const uniqueIdentity = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const at = new AccessToken(env.liveKitApiKey, env.liveKitApiSecret, {
    identity: uniqueIdentity,
    name: userName,
    metadata,
  });

  // Video grants for the room
  const videoGrant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe,
    canPublishData,
  };

  at.addGrant(videoGrant);

  // Token expires in 1 hour
  at.ttl = '1h';

  const token = await at.toJwt();
  
  console.log('[LiveKit] Token generated:', {
    tokenType: typeof token,
    isString: typeof token === 'string',
    length: token.length,
    tokenPrefix: token.substring(0, 30) + '...',
  });

  return token;
}

/**
 * Generate room name for a call session
 */
export function generateRoomName(callId: string): string {
  return `call_${callId}`;
}

/**
 * Validate LiveKit configuration
 */
export function validateLiveKitConfig(): boolean {
  return Boolean(
    env.liveKitApiKey &&
    env.liveKitApiSecret &&
    env.liveKitServerUrl
  );
}
