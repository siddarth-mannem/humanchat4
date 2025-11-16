"use client";

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'humanchat.archivedConversations';

type ArchiveState = Record<string, number>;

export const useArchivedConversations = () => {
  const [archived, setArchived] = useState<ArchiveState>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setArchived(JSON.parse(raw));
      }
    } catch (error) {
      console.warn('Failed to read archived conversations', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(archived));
    } catch (error) {
      console.warn('Failed to persist archived conversations', error);
    }
  }, [archived]);

  const archive = useCallback((conversationId: string) => {
    setArchived((prev) => ({ ...prev, [conversationId]: Date.now() }));
  }, []);

  const unarchive = useCallback((conversationId: string) => {
    setArchived((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

  const isArchived = useCallback((conversationId: string) => Boolean(archived[conversationId]), [archived]);

  const archivedIds = Object.keys(archived).sort((a, b) => (archived[b] ?? 0) - (archived[a] ?? 0));

  return {
    archive,
    unarchive,
    archivedIds,
    isArchived
  };
};
