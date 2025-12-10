import { Server } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { parse } from 'url';
import { createRedisClient, redis } from '../db/redis.js';
import { logger } from '../utils/logger.js';


const sessionChannels = new Map<string, Set<WebSocket>>();
const sessionMeta = new WeakMap<WebSocket, { sessionId: string; userId?: string }>();
const statusClients = new Set<WebSocket>();
const notificationChannels = new Map<string, Set<WebSocket>>();

const addToChannel = (collection: Map<string, Set<WebSocket>>, key: string, socket: WebSocket): void => {
  const existing = collection.get(key) ?? new Set<WebSocket>();
  existing.add(socket);
  collection.set(key, existing);
};

const removeSocket = (set?: Set<WebSocket>, socket?: WebSocket): void => {
  if (set && socket) {
    set.delete(socket);
  }
};

const broadcast = (set: Set<WebSocket> | undefined, data: unknown): void => {
  if (!set) return;
  const payload = JSON.stringify(data);
  set.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

const broadcastToSession = (sessionId: string, data: unknown, sender?: WebSocket): void => {
  const listeners = sessionChannels.get(sessionId);
  if (!listeners) return;
  const payload = JSON.stringify(data);
  listeners.forEach((client) => {
    if (client === sender) return;
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

const handleSessionMessage = (sessionId: string, socket: WebSocket, raw: RawData): void => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString());
  } catch (error) {
    console.warn('Ignoring non-JSON signaling payload', error);
    return;
  }

  if (!parsed || typeof parsed !== 'object') {
    return;
  }

  const meta = sessionMeta.get(socket);
  const envelope = {
    ...parsed,
    senderId: (parsed as { senderId?: string }).senderId ?? meta?.userId,
    sessionId,
    timestamp: Date.now()
  };

  broadcastToSession(sessionId, envelope, socket);
};

export const setupWebSockets = (server: Server): { wss: WebSocketServer; close: () => Promise<void> } => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket, req) => {
    const { pathname } = parse(req.url ?? '/');
    if (!pathname) {
      socket.close(1008, 'Invalid path');
      return;
    }

    if (pathname.startsWith('/session/')) {
      const sessionId = pathname.split('/')[2];
      if (!sessionId) {
        socket.close(1008, 'Missing session id');
        return;
      }

      const { query } = parse(req.url ?? '/', true);
      const userId = typeof query?.userId === 'string' ? query.userId : undefined;

      addToChannel(sessionChannels, sessionId, socket);
      sessionMeta.set(socket, { sessionId, userId });
      socket.send(
        JSON.stringify({
          type: 'session-ready',
          sessionId,
          userId,
          peers: sessionChannels.get(sessionId)?.size ?? 1
        })
      );

      socket.on('message', (message: RawData) => handleSessionMessage(sessionId, socket, message));
      socket.on('close', () => {
        removeSocket(sessionChannels.get(sessionId), socket);
        sessionMeta.delete(socket);
        broadcastToSession(sessionId, { type: 'peer-left', sessionId, userId }, socket);
      });
      return;
    }

    if (pathname === '/status') {
      statusClients.add(socket);
      socket.on('close', () => statusClients.delete(socket));
      return;
    }

    if (pathname.startsWith('/notifications/')) {
      const userId = pathname.split('/')[2];
      addToChannel(notificationChannels, userId, socket);
      socket.on('close', () => removeSocket(notificationChannels.get(userId), socket));
      return;
    }

    socket.close(1008, 'Unknown channel');
  });

  const subscriber = typeof redis.duplicate === 'function' ? redis.duplicate() : createRedisClient();

  const logEvent = (event: string): void => {
    logger.info('WebSocket Redis event', { event, status: subscriber.status });
  };

  subscriber.on('connect', () => logEvent('connect'));
  subscriber.on('ready', () => logEvent('ready'));
  subscriber.on('reconnecting', () => logEvent('reconnecting'));
  subscriber.on('end', () => logEvent('end'));
  subscriber.on('close', () => logEvent('close'));
  subscriber.on('error', (error: Error) => {
    logger.error('WebSocket Redis error', { message: error.message, stack: error.stack });
  });

  subscriber.subscribe('status', 'session', 'notification');
  subscriber.on('message', (channel: string, message: string) => {
    const payload = JSON.parse(message);
    logger.info('WebSocket dispatch', {
      channel,
      hasSessionId: Boolean(payload?.sessionId),
      hasUserId: Boolean(payload?.userId),
      type: payload?.type ?? null
    });
    switch (channel) {
      case 'status':
        broadcast(statusClients, payload);
        break;
      case 'session':
        broadcast(sessionChannels.get(payload.sessionId), payload);
        break;
      case 'notification':
        broadcast(notificationChannels.get(payload.userId), payload);
        break;
      default:
        break;
    }
  });

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
    const maybeQuit = subscriber as { quit?: () => Promise<unknown> };
    if (typeof maybeQuit.quit === 'function') {
      await maybeQuit.quit();
    } else {
      const maybeDisconnect = subscriber as { disconnect?: () => void };
      if (typeof maybeDisconnect.disconnect === 'function') {
        maybeDisconnect.disconnect();
      }
    }
  };

  return { wss, close };
};
