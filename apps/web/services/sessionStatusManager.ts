'use client';

import { markSessionStart, markSessionComplete } from './sessionApi';

type PresenceState = 'active' | 'idle' | 'offline';

export interface StatusObject {
  userId: string;
  isOnline: boolean;
  hasActiveSession: boolean;
  currentSessionId?: string;
  lastUpdated: number;
  presenceState?: PresenceState;
  lastSeenAt?: number | null;
}

type StatusCallback = (status: StatusObject) => void;

type MaybeWindow = typeof window | undefined;

const CACHE_TTL = 30 * 1000;
const SYNC_INTERVAL = 30 * 1000;
const HEARTBEAT_INTERVAL = 45 * 1000;
const IDLE_THRESHOLD = 60 * 1000;
const RETRY_LIMIT = 3;
const RETRY_BASE_DELAY = 1000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? API_BASE_URL.replace(/^http(s?):/, 'ws$1:');

const defaultStatus = (userId: string): StatusObject => ({
  userId,
  isOnline: false,
  hasActiveSession: false,
  currentSessionId: undefined,
  lastUpdated: Date.now(),
  presenceState: 'offline',
  lastSeenAt: null
});

class SessionStatusManager {
  private cache = new Map<string, StatusObject>();
  private subscribers = new Map<string, Set<StatusCallback>>();
  private lastFetched = new Map<string, number>();
  private ws: WebSocket | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private currentUserId: string | null = null;
  private isSyncing = false;
  private currentUserSubscribers = new Set<(userId: string | null) => void>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivity = Date.now();
  private presenceState: PresenceState = 'offline';
  private lastPresencePush = 0;
  private activityListenersAttached = false;
  private readonly activityHandler = () => {
    if (!this.currentUserId) {
      return;
    }
    this.lastActivity = Date.now();
    if (this.presenceState === 'idle') {
      void this.pushPresence('active');
    }
  };
  private readonly visibilityHandler = () => {
    if (!this.currentUserId) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      this.lastActivity = Date.now() - IDLE_THRESHOLD - 1000;
      void this.pushPresence('idle');
    } else {
      this.activityHandler();
    }
  };
  private readonly beforeUnloadHandler = () => {
    if (!this.currentUserId || typeof navigator.sendBeacon !== 'function') {
      return;
    }
    try {
      const blob = new Blob([JSON.stringify({ state: 'offline' })], {
        type: 'application/json'
      });
      navigator.sendBeacon(`${API_BASE_URL}/api/users/me/presence`, blob);
    } catch (error) {
      console.warn('Presence beacon failed', error);
    }
  };

  constructor() {
    if (this.isBrowser()) {
      this.currentUserId = this.resolveCurrentUserId();
      this.attachPresenceTracking();
      this.connectWebSocket();
      this.startPeriodicSync();
    }
  }

  public setCurrentUserId(userId: string | null): void {
    const previousUserId = this.currentUserId;
    if (!userId && previousUserId) {
      void this.pushPresence('offline', previousUserId);
    }
    this.currentUserId = userId;
    if (userId) {
      this.attachPresenceTracking();
      this.activityHandler();
      void this.pushPresence('active');
    } else {
      this.presenceState = 'offline';
    }
    this.currentUserSubscribers.forEach((listener) => {
      try {
        listener(userId);
      } catch (error) {
        console.warn('Current user listener failed', error);
      }
    });
  }

  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  public onCurrentUserChange(callback: (userId: string | null) => void): () => void {
    this.currentUserSubscribers.add(callback);
    callback(this.currentUserId);
    return () => {
      this.currentUserSubscribers.delete(callback);
    };
  }

  public async startSession(sessionId: string, userId: string): Promise<StatusObject> {
    await markSessionStart(sessionId);

    const updated = this.updateStatus(userId, {
      hasActiveSession: true,
      currentSessionId: sessionId,
      isOnline: true
    });
    this.broadcast(userId);
    return updated;
  }

  public async endSession(sessionId: string, userId: string): Promise<StatusObject> {
    await markSessionComplete(sessionId);

    const updated = this.updateStatus(userId, {
      hasActiveSession: false,
      currentSessionId: undefined
    });
    this.broadcast(userId);
    return updated;
  }

  public async checkUserStatus(userId: string): Promise<StatusObject> {
    const now = Date.now();
    const lastUpdate = this.lastFetched.get(userId);
    const cached = this.cache.get(userId);
    if (cached && lastUpdate && now - lastUpdate < CACHE_TTL) {
      return cached;
    }

    const status = await this.fetchStatus(userId);
    return status ?? defaultStatus(userId);
  }

  public async syncStatusWithBackend(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const userIds = Array.from(this.cache.keys());
      if (userIds.length === 0) {
        return;
      }
      await Promise.all(userIds.map((id) => this.fetchStatus(id).catch(() => undefined)));
    } finally {
      this.isSyncing = false;
    }
  }

  public subscribeToStatusChanges(userId: string, callback: StatusCallback): () => void {
    const callbacks = this.subscribers.get(userId) ?? new Set<StatusCallback>();
    callbacks.add(callback);
    this.subscribers.set(userId, callbacks);

    const cached = this.cache.get(userId);
    if (cached) {
      callback(cached);
    }

    return () => {
      const set = this.subscribers.get(userId);
      set?.delete(callback);
      if (set && set.size === 0) {
        this.subscribers.delete(userId);
      }
    };
  }

  private async fetchStatus(userId: string): Promise<StatusObject | undefined> {
    const response = await this.withRetry(() =>
      fetch(`${API_BASE_URL}/api/users/${userId}/status`, {
        method: 'GET',
        credentials: 'include'
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch status for ${userId}`);
    }

    const payload = (await response.json()) as {
      presenceState?: PresenceState;
      isOnline?: boolean;
      hasActiveSession?: boolean;
      lastSeenAt?: string | null;
    };
    const hydrated: StatusObject = {
      ...defaultStatus(userId),
      isOnline: Boolean(payload.isOnline),
      hasActiveSession: Boolean(payload.hasActiveSession),
      presenceState: payload.presenceState ?? (payload.isOnline ? 'active' : 'offline'),
      lastSeenAt: payload.lastSeenAt ? Date.parse(payload.lastSeenAt) : null,
      userId,
      lastUpdated: Date.now()
    };

    this.cache.set(userId, hydrated);
    this.lastFetched.set(userId, Date.now());
    this.broadcast(userId);
    return hydrated;
  }

  private updateStatus(userId: string, patch: Partial<StatusObject>): StatusObject {
    const current = this.cache.get(userId) ?? defaultStatus(userId);
    const next: StatusObject = {
      ...current,
      ...patch,
      userId,
      lastUpdated: Date.now()
    };
    this.cache.set(userId, next);
    this.lastFetched.set(userId, Date.now());
    return next;
  }

  private broadcast(userId: string): void {
    const status = this.cache.get(userId);
    if (!status) return;
    const callbacks = this.subscribers.get(userId);
    callbacks?.forEach((cb) => {
      try {
        cb(status);
      } catch (error) {
        console.warn('Session status subscriber failed', error);
      }
    });
  }

  private connectWebSocket(): void {
    if (this.ws || !this.isBrowser()) {
      return;
    }

    try {
      this.ws = new WebSocket(`${WS_BASE_URL.replace(/\/$/, '')}/status`);
      this.ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data as string) as Partial<StatusObject> & { userId?: string };
          if (!data?.userId) return;
          this.cache.set(data.userId, {
            ...defaultStatus(data.userId),
            ...data,
            presenceState: data.presenceState ?? (data.isOnline ? 'active' : 'offline')
          });
          this.lastFetched.set(data.userId, Date.now());
          this.broadcast(data.userId);
        } catch (error) {
          console.warn('Failed to parse status update', error);
        }
      });
      this.ws.addEventListener('close', () => {
        this.ws = null;
        setTimeout(() => this.connectWebSocket(), 2000);
      });
      this.ws.addEventListener('error', () => {
        this.ws?.close();
      });
    } catch (error) {
      console.warn('WebSocket connection failed', error);
    }
  }

  private startPeriodicSync(): void {
    if (this.syncTimer || !this.isBrowser()) {
      return;
    }
    this.syncTimer = setInterval(() => {
      this.syncStatusWithBackend().catch((error) => {
        console.warn('Status sync failed', error);
      });
    }, SYNC_INTERVAL);
  }

  private async withRetry(operation: () => Promise<Response>, attempt = 0): Promise<Response> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= RETRY_LIMIT) {
        throw error instanceof Error ? error : new Error(String(error));
      }
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.withRetry(operation, attempt + 1);
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private attachPresenceTracking(): void {
    if (!this.isBrowser() || this.activityListenersAttached) {
      return;
    }
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, this.activityHandler, { passive: true }));
    window.addEventListener('focus', this.activityHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this.startHeartbeat();
    this.activityListenersAttached = true;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }
    void this.pushPresence('active');
    this.heartbeatTimer = setInterval(() => {
      if (!this.currentUserId) {
        return;
      }
      const idle = Date.now() - this.lastActivity > IDLE_THRESHOLD;
      const nextState: PresenceState = idle ? 'idle' : 'active';
      void this.pushPresence(nextState);
    }, HEARTBEAT_INTERVAL);
  }

  private async pushPresence(state: PresenceState, targetUserId?: string): Promise<void> {
    const userId = targetUserId ?? this.currentUserId;
    if (!userId) {
      return;
    }
    const now = Date.now();
    if (!targetUserId && state === this.presenceState && now - this.lastPresencePush < HEARTBEAT_INTERVAL / 2) {
      return;
    }
    try {
      await fetch(`${API_BASE_URL}/api/users/me/presence`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
      if (!targetUserId) {
        this.presenceState = state;
        this.lastPresencePush = now;
      }
    } catch (error) {
      console.warn('Presence update failed', error);
    }
  }

  private resolveCurrentUserId(): string | null {
    const globalWindow = this.isBrowser() ? (window as MaybeWindow & Record<string, unknown>) : undefined;
    if (!globalWindow) {
      return null;
    }

    const fromGlobal = (globalWindow as Record<string, unknown>).__HUMANCHAT_USER_ID__;
    if (typeof fromGlobal === 'string') {
      return fromGlobal;
    }

    try {
      const stored = globalWindow.localStorage?.getItem('humanchat:userId');
      if (stored) {
        return stored;
      }
    } catch (error) {
      console.warn('Unable to read stored user id', error);
    }

    return null;
  }
}

export const sessionStatusManager = new SessionStatusManager();
export type { StatusObject as SessionStatus };
