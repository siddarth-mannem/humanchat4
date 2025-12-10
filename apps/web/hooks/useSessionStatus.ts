'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionStatusManager, type SessionStatus, type PresenceState } from '../services/sessionStatusManager';

interface SessionStatusState {
  isOnline: boolean;
  hasActiveSession: boolean;
  presenceState: PresenceState;
  isLoading: boolean;
}

const initialState: SessionStatusState = {
  isOnline: false,
  hasActiveSession: false,
  presenceState: 'offline',
  isLoading: false
};

const derivePresenceState = (status?: Pick<SessionStatus, 'presenceState' | 'isOnline'>): PresenceState => {
  if (status?.presenceState) {
    return status.presenceState;
  }
  return status?.isOnline ? 'active' : 'offline';
};

export const useSessionStatus = (userId?: string | null) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(sessionStatusManager.getCurrentUserId()));
  const [state, setState] = useState<SessionStatusState>({ ...initialState, isLoading: Boolean(userId) });

  useEffect(() => {
    return sessionStatusManager.onCurrentUserChange((currentUserId) => {
      setIsAuthenticated(Boolean(currentUserId));
    });
  }, []);

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

    if (!isAuthenticated) {
      setState({ ...initialState, isLoading: Boolean(userId) });
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
          setState({
            isOnline: status.isOnline,
            hasActiveSession: status.hasActiveSession,
            presenceState: derivePresenceState(status),
            isLoading: false
          });
        }
      })
      .catch((error) => {
        console.warn('Failed to load session status', error);
        if (!cancelled) {
          setState({ ...initialState, isLoading: false });
        }
      });

    unsubscribe = sessionStatusManager.subscribeToStatusChanges(userId, (status) => {
      setState({
        isOnline: status.isOnline,
        hasActiveSession: status.hasActiveSession,
        presenceState: derivePresenceState(status),
        isLoading: false
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId, isAuthenticated]);

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
