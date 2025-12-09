'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ManagedRequest } from '../../../src/lib/db';
import { fetchManagedRequests, updateRequestStatus } from '../services/requestApi';

interface ManagedRequestOptions {
  enabled?: boolean;
  pollMs?: number;
}

const DEFAULT_POLL = 20000;

export function useManagedRequests(options: ManagedRequestOptions = {}) {
  const { enabled = true, pollMs = DEFAULT_POLL } = options;
  const [requests, setRequests] = useState<ManagedRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    try {
      const data = await fetchManagedRequests();
      if (!mountedRef.current) return;
      setRequests(data);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const detail = err instanceof Error ? err.message : 'Unable to load requests.';
      setError(detail);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    const hydrate = async () => {
      if (cancelled) return;
      await refresh();
    };
    void hydrate();

    if (!pollMs) {
      return () => {
        cancelled = true;
      };
    }

    const id = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, pollMs, refresh]);

  const handleUpdateStatus = useCallback(
    async (requestId: string, status: ManagedRequest['status']) => {
      setUpdatingId(requestId);
      try {
        const updated = await updateRequestStatus(requestId, status);
        setRequests((prev) => {
          const existingIndex = prev.findIndex((request) => request.requestId === requestId);
          if (existingIndex === -1) {
            return [updated, ...prev];
          }
          const copy = [...prev];
          copy[existingIndex] = updated;
          return copy;
        });
        setError(null);
        return updated;
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unable to update request.';
        setError(detail);
        throw err;
      } finally {
        setUpdatingId((prev) => (prev === requestId ? null : prev));
      }
    },
    []
  );

  const pendingCount = useMemo(() => requests.filter((request) => request.status === 'pending').length, [requests]);

  return {
    requests,
    loading,
    error,
    pendingCount,
    refresh,
    updateStatus: handleUpdateStatus,
    updatingId
  };
}
