'use client';

import { db, saveInstantInvite } from '../../../src/lib/db';
import { sessionStatusManager } from './sessionStatusManager';
import {
  mapConversationRecord,
  mapInviteRecord,
  mapSessionRecord,
  type ConversationRecord,
  type InstantInviteRecord,
  type SessionRecord
} from './conversationMapper';

interface InstantInviteNotification {
  type: 'instant_invite';
  event: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  invite: InstantInviteRecord;
  conversation?: ConversationRecord;
  session?: SessionRecord;
}

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/^http/i, 'ws');

class InstantInviteChannel {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private unsubscribe?: () => void;
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    this.unsubscribe = sessionStatusManager.onCurrentUserChange((nextUserId) => {
      this.userId = nextUserId;
      this.resetConnection();
    });
    this.userId = sessionStatusManager.getCurrentUserId();
    this.resetConnection();
  }

  private resetConnection(): void {
    this.ws?.close();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.userId && !this.disposed) {
      this.connect();
    }
  }

  private connect(): void {
    if (!this.userId || this.ws || this.disposed) {
      return;
    }
    try {
      this.ws = new WebSocket(`${WS_BASE_URL.replace(/\/$/, '')}/notifications/${this.userId}`);
      this.ws.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data as string) as InstantInviteNotification;
          if (payload?.type === 'instant_invite' && payload.invite) {
            void this.handleInviteNotification(payload);
          }
        } catch (error) {
          console.warn('Failed to parse invite notification', error);
        }
      });
      this.ws.addEventListener('close', () => {
        this.ws = null;
        if (!this.disposed && this.userId) {
          this.reconnectTimer = setTimeout(() => this.connect(), 1500);
        }
      });
      this.ws.addEventListener('error', () => {
        this.ws?.close();
      });
    } catch (error) {
      console.warn('Instant invite channel failed to connect', error);
    }
  }

  private async handleInviteNotification(payload: InstantInviteNotification): Promise<void> {
    const invite = mapInviteRecord(payload.invite);
    await saveInstantInvite(invite);

    if (payload.conversation) {
      const participants = payload.conversation.participants ?? [];
      const conversation = mapConversationRecord(payload.conversation, participants, payload.conversation.linked_session_id ?? null);
      await db.conversations.put(conversation);
    }

    if (payload.session) {
      const session = mapSessionRecord(payload.session);
      await db.sessions.put(session);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.ws?.close();
    this.unsubscribe?.();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

let channel: InstantInviteChannel | null = null;

export const initInstantInviteChannel = (): InstantInviteChannel => {
  if (!channel) {
    channel = new InstantInviteChannel();
  }
  return channel;
};

export const disposeInstantInviteChannel = (): void => {
  channel?.dispose();
  channel = null;
};
