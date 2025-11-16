'use client';

import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type Conversation, type Session, type Message } from '../../../src/lib/db';
import { formatRelativeTimestamp } from '../utils/time';

export interface ConversationListEntry {
  conversation: Conversation;
  meta: {
    displayName: string;
    initials: string;
    lastMessage: string;
    relativeTimestamp: string;
    status?: 'active' | 'scheduled';
  };
}

const buildInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
};

const SAM_FALLBACK: Conversation = {
  conversationId: 'sam-concierge',
  type: 'sam',
  participants: ['sam'],
  lastActivity: Date.now(),
  unreadCount: 0
};

type ConversationPayload = {
  conversations: Conversation[];
  sessions: Session[];
  lastMessages: Record<string, Message | undefined>;
};

const fetchConversationPayload = async (): Promise<ConversationPayload> => {
  const [conversations, sessions] = await Promise.all([
    db.conversations.toArray(),
    db.sessions.toArray()
  ]);

  const lastMessagesEntries = await Promise.all(
    conversations.map(async (conversation: Conversation) => {
      const messages = await db.messages
        .where('conversationId')
        .equals(conversation.conversationId)
        .sortBy('timestamp');
      const lastMessage = messages.length ? messages[messages.length - 1] : undefined;
      return [conversation.conversationId, lastMessage] as const;
    })
  );

  return {
    conversations,
    sessions,
    lastMessages: Object.fromEntries(lastMessagesEntries)
  };
};

const buildStatus = (session?: Session | null): 'active' | 'scheduled' | undefined => {
  if (!session) return undefined;
  if (session.status === 'in_progress') return 'active';
  if (session.status === 'pending' && session.startTime > Date.now()) return 'scheduled';
  return undefined;
};

const ensureSamConversation = (collection: Conversation[]): Conversation => {
  return collection.find((item) => item.type === 'sam') ?? SAM_FALLBACK;
};

export const useConversationData = () => {
  const [payload, setPayload] = useState<ConversationPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const subscription = liveQuery(fetchConversationPayload).subscribe({
      next: (value: ConversationPayload) => {
        setPayload(value);
        setError(null);
      },
      error: (err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return () => undefined;
    const handler = () => {
      void reload();
    };
    window.addEventListener('humanchat-sync', handler as EventListener);
    return () => {
      window.removeEventListener('humanchat-sync', handler as EventListener);
    };
  }, []);

  const reload = async () => {
    setRefreshing(true);
    try {
      const next = await fetchConversationPayload();
      setPayload(next);
    } finally {
      setRefreshing(false);
    }
  };

  const conversations: ConversationListEntry[] = useMemo(() => {
    if (!payload) {
      return [
        {
          conversation: SAM_FALLBACK,
          meta: {
            displayName: 'Sam Concierge',
            initials: 'SAM',
            lastMessage: 'Need anything? I can help you prep.',
            relativeTimestamp: 'just now'
          }
        }
      ];
    }

    const { conversations: records, sessions, lastMessages } = payload;
    const sessionMap = new Map(sessions.map((session) => [session.sessionId, session]));

    const normalized = records.map<ConversationListEntry>((conversation) => {
      const session = conversation.linkedSessionId
        ? sessionMap.get(conversation.linkedSessionId) ?? null
        : null;
      const status = buildStatus(session ?? undefined);
      const lastMessage = lastMessages[conversation.conversationId]?.content ?? '';
      const displayName =
        conversation.type === 'sam' ? 'Sam Concierge' : conversation.participants.join(', ');

      return {
        conversation,
        meta: {
          displayName,
          initials: conversation.type === 'sam' ? 'SAM' : buildInitials(displayName || 'Human'),
          lastMessage: lastMessage || 'No messages yet',
          relativeTimestamp: formatRelativeTimestamp(conversation.lastActivity),
          status
        }
      };
    });

    const samConversation = ensureSamConversation(normalized.map((entry) => entry.conversation));
    const samEntry =
      normalized.find((entry) => entry.conversation.conversationId === samConversation.conversationId) ??
      {
        conversation: samConversation,
        meta: {
          displayName: 'Sam Concierge',
          initials: 'SAM',
          lastMessage: 'Need anything? I can help you prep.',
          relativeTimestamp: formatRelativeTimestamp(samConversation.lastActivity)
        }
      };

    const humanEntries = normalized
      .filter((entry) => entry.conversation.type === 'human')
      .sort((a, b) => b.conversation.lastActivity - a.conversation.lastActivity);

    return [samEntry, ...humanEntries];
  }, [payload]);

  const hasHumanConversations = useMemo(() => {
    return conversations.slice(1).some((entry) => entry.conversation.type === 'human');
  }, [conversations]);

  const unreadTotal = conversations.reduce((sum, entry) => sum + (entry.conversation.unreadCount ?? 0), 0);

  return {
    conversations,
    hasHumanConversations,
    error,
    reload,
    refreshing,
    unreadTotal
  };
};
