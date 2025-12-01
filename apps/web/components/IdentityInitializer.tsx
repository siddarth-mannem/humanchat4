'use client';

import { useEffect } from 'react';
import { AUTH_UPDATED_EVENT } from '../constants/events';
import { fetchCurrentUser } from '../services/authApi';
import { sessionStatusManager } from '../services/sessionStatusManager';

const USER_ID_STORAGE_KEY = 'humanchat:userId';

type GlobalWithIdentity = typeof window & Record<string, unknown>;

const updateClientIdentity = (userId: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  const globalWindow = window as GlobalWithIdentity;
  if (userId) {
    globalWindow.__HUMANCHAT_USER_ID__ = userId;
    try {
      window.localStorage?.setItem(USER_ID_STORAGE_KEY, userId);
    } catch (_) {
      /* localStorage unavailable; ignore */
    }
  } else {
    delete globalWindow.__HUMANCHAT_USER_ID__;
    try {
      window.localStorage?.removeItem(USER_ID_STORAGE_KEY);
    } catch (_) {
      /* localStorage unavailable; ignore */
    }
  }
};

const applyIdentity = (userId: string | null) => {
  sessionStatusManager.setCurrentUserId(userId);
  updateClientIdentity(userId);
};

export default function IdentityInitializer() {
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    let refreshQueued = false;

    const hydrate = async () => {
      if (pending) {
        refreshQueued = true;
        return;
      }
      pending = true;
      try {
        const identity = await fetchCurrentUser();
        if (!cancelled) {
          applyIdentity(identity?.id ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load current user identity', error);
        }
      } finally {
        pending = false;
        if (refreshQueued && !cancelled) {
          refreshQueued = false;
          void hydrate();
        }
      }
    };

    void hydrate();

    const handleAuthUpdated = () => {
      void hydrate();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated);
      }
    };
  }, []);

  return null;
}
