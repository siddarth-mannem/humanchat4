'use client';

export interface StatusObject {
  userId: string;
  isOnline: boolean;
  hasActiveSession: boolean;
  currentSessionId?: string;
  lastUpdated: number;
}

type StatusCallback = (status: StatusObject) => void;

type MaybeWindow = typeof window | undefined;

const CACHE_TTL = 30 * 1000;
const SYNC_INTERVAL = 30 * 1000;
const RETRY_LIMIT = 3;
const RETRY_BASE_DELAY = 1000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? API_BASE_URL.replace(/^http(s?):/, 'ws$1:');

const defaultStatus = (userId: string): StatusObject => ({
  userId,
  isOnline: false,
  hasActiveSession: false,
  currentSessionId: undefined,
  lastUpdated: Date.now()
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

  constructor() {
    if (this.isBrowser()) {
      this.currentUserId = this.resolveCurrentUserId();
      this.connectWebSocket();
      this.startPeriodicSync();
    }
  }

  public setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
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
    const status = await this.withRetry(() =>
      fetch(`${API_BASE_URL}/api/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, userId })
      })
    );
    if (!status.ok) {
      throw new Error('Failed to start session');
    }

    const updated = this.updateStatus(userId, {
      hasActiveSession: true,
      currentSessionId: sessionId,
      isOnline: true
    });
    this.broadcast(userId);
    return updated;
  }

  public async endSession(sessionId: string, userId: string): Promise<StatusObject> {
    const response = await this.withRetry(() =>
      fetch(`${API_BASE_URL}/api/sessions/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, userId })
      })
    );
    if (!response.ok) {
      throw new Error('Failed to end session');
    }

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

    const payload = (await response.json()) as Partial<StatusObject>;
    const hydrated: StatusObject = {
      ...defaultStatus(userId),
      ...payload,
      userId: payload.userId ?? userId,
      lastUpdated: payload.lastUpdated ?? Date.now()
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
          const data = JSON.parse(event.data as string) as StatusObject;
          if (!data?.userId) return;
          this.cache.set(data.userId, { ...defaultStatus(data.userId), ...data });
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
