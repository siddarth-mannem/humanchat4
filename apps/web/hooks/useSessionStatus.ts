'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionStatusManager, type SessionStatus } from '../services/sessionStatusManager';

interface SessionStatusState {
  isOnline: boolean;
  hasActiveSession: boolean;
  isLoading: boolean;
}

const initialState: SessionStatusState = {
  isOnline: false,
  hasActiveSession: false,
  isLoading: false
};

export const useSessionStatus = (userId?: string | null) => {
  const [state, setState] = useState<SessionStatusState>({ ...initialState, isLoading: Boolean(userId) });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    if (!userId) {
      setState({ ...initialState, isLoading: false });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    sessionStatusManager
      .checkUserStatus(userId)
      .then((status) => {
        if (!cancelled) {
          setState({ isOnline: status.isOnline, hasActiveSession: status.hasActiveSession, isLoading: false });
        }
      })
      .catch((error) => {
        console.warn('Failed to load session status', error);
        if (!cancelled) {
          setState({ ...initialState, isLoading: false });
        }
      });

    unsubscribe = sessionStatusManager.subscribeToStatusChanges(userId, (status) => {
      setState({ isOnline: status.isOnline, hasActiveSession: status.hasActiveSession, isLoading: false });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId]);

  return state;
};

export const useMySessionStatus = () => {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [userId, setUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());

  useEffect(() => {
    const unsubscribe = sessionStatusManager.onCurrentUserChange((next) => {
      setUserId(next);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return () => undefined;
    }

    let cancelled = false;
    sessionStatusManager
      .checkUserStatus(userId)
      .then((next) => {
        if (!cancelled) {
          setStatus(next);
        }
      })
      .catch((error) => console.warn('Unable to load current user status', error));

    const unsubscribe = sessionStatusManager.subscribeToStatusChanges(userId, (next) => {
      setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  const startSession = useCallback(
    async (sessionId: string) => {
      if (!userId) {
        throw new Error('Cannot start session without a userId');
      }
      const updated = await sessionStatusManager.startSession(sessionId, userId);
      setStatus(updated);
      return updated;
    },
    [userId]
  );

  const endSession = useCallback(
    async (sessionId: string) => {
      if (!userId) {
        throw new Error('Cannot end session without a userId');
      }
      const updated = await sessionStatusManager.endSession(sessionId, userId);
      setStatus(updated);
      return updated;
    },
    [userId]
  );

  const currentSession = useMemo(() => status, [status]);

  return { startSession, endSession, currentSession };
};
