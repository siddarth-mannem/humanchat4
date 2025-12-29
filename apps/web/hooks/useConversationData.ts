'use client';

import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type Conversation, type Session, type Message } from '../../../src/lib/db';
import { formatRelativeTimestamp } from '../utils/time';
import { sessionStatusManager } from '../services/sessionStatusManager';

export interface ConversationListEntry {
  conversation: Conversation;
  meta: {
    displayName: string;
    initials: string;
    avatarUrl?: string;
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

export const SAM_CONCIERGE_ID = 'sam-concierge';
export const SAM_DISPLAY_NAME = 'Simple Sam';

export const SAM_FALLBACK_CONVERSATION: Conversation = {
  conversationId: SAM_CONCIERGE_ID,
  type: 'sam',
  participants: ['sam'],
  participantLabels: { sam: SAM_DISPLAY_NAME },
  lastActivity: Date.now(),
  unreadCount: 0
};

const ensureSamConversationRecord = async () => {
  const existing = await db.conversations.get(SAM_CONCIERGE_ID);
  if (existing) return existing;
  const seeded = { ...SAM_FALLBACK_CONVERSATION, lastActivity: Date.now() };
  await db.conversations.put(seeded);
  return seeded;
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
  return collection.find((item) => item.type === 'sam') ?? SAM_FALLBACK_CONVERSATION;
};

const buildParticipantNames = (conversation: Conversation, currentUserId?: string | null): string[] => {
  const peerIds = conversation.participants.filter((participantId) => participantId !== currentUserId);
  const labelSource = peerIds.length > 0 ? peerIds : conversation.participants;
  const labels = labelSource
    .map((id) => conversation.participantLabels?.[id] ?? null)
    .filter((value): value is string => Boolean(value && value.trim().length > 0));

  if (labels.length > 0) {
    return labels;
  }

  return labelSource;
};

export const useConversationData = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());
  const [payload, setPayload] = useState<ConversationPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [synced, setSynced] = useState(false);

  // Force resync if data format changed (increment this when schema changes)
  const SYNC_VERSION = 4;
  const SYNC_KEY = 'humanchat_sync_version';

  // Sync conversations from backend on mount (after refresh/first load)
  useEffect(() => {
    console.log('Sync effect triggered:', { synced, currentUserId });
    
    if (!currentUserId) {
      console.log('Skipping sync: no current user');
      return;
    }
    
    // Check if we need to force a resync due to version change
    const lastSyncVersion = parseInt(localStorage.getItem(SYNC_KEY) || '0', 10);
    const needsResync = lastSyncVersion < SYNC_VERSION;
    
    if (needsResync) {
      console.log('Forcing resync due to version change:', lastSyncVersion, '->', SYNC_VERSION);
      // Don't return - let it fall through to sync
    } else if (synced) {
      console.log('Skipping sync: already synced');
      return;
    }
    
    // Mark as synced immediately to prevent duplicate runs
    setSynced(true);
    
    // Add a delay to ensure authentication cookie is set
    const timer = setTimeout(() => {
      void syncFromBackend(needsResync);
    }, 1000); // Wait 1 second for auth to complete
    
    const syncFromBackend = async (isResync: boolean) => {
      try {
        console.log('Starting conversation sync from backend...', { isResync });
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
        const response = await fetch(`${API_BASE_URL}/api/conversations`, {
          credentials: 'include'
        });
        
        console.log('Conversations API response:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to sync conversations from backend:', response.status, errorText);
          
          // If unauthorized, retry after another second
          if (response.status === 401) {
            console.log('Got 401, will retry sync after authentication...');
            setTimeout(() => {
              setSynced(false); // Reset to trigger another sync attempt
            }, 2000);
          }
          setSynced(true);
          return;
        }
        
        const data = await response.json();
        console.log('Raw API response:', data);
        
        // Backend wraps response in { success: true, data: { conversations: [...] } }
        const conversations = data.data?.conversations || data.conversations || [];
        
        console.log(`Syncing ${conversations.length} conversations from backend`, conversations);
        
        // Clear existing messages to avoid duplicates on resync
        if (isResync) {
          console.log('Clearing existing messages for fresh sync...');
          await db.messages.clear();
        }
        
        console.log(`Syncing ${conversations.length} conversations from backend`);
        
        // Save conversations to IndexedDB
        for (const conv of conversations) {
          await db.conversations.put({
            conversationId: conv.id,
            type: conv.type,
            participants: conv.participants || [],
            participantLabels: conv.participant_display_map || {},
            participantAvatars: conv.participant_avatars || {},
            linkedSessionId: conv.linked_session_id || undefined,
            lastActivity: new Date(conv.last_activity).getTime(),
            unreadCount: 0
          });
          
          // Fetch messages for this conversation
          try {
            const messagesResponse = await fetch(`${API_BASE_URL}/api/conversations/${conv.id}/messages`, {
              credentials: 'include'
            });
            
            if (messagesResponse.ok) {
              const messagesData = await messagesResponse.json();
              const messages = messagesData.data?.messages || messagesData.messages || [];
              console.log(`  - Fetched ${messages.length} messages for conversation ${conv.id}`);
              
              // Save messages to IndexedDB using backend message IDs for duplicate detection
              for (const msg of messages) {
                console.log(`    Checking message: id=${msg.id}, content="${msg.content?.substring(0, 20)}..."`);
                
                if (!msg.id) {
                  console.warn(`    ⚠️  Message without ID, skipping:`, msg);
                  continue;
                }
                
                // Use put instead of add - with &messageId as primary key, put will upsert
                console.log(`    → Upserting message ${msg.id}`);
                await db.messages.put({
                  messageId: msg.id,
                  conversationId: msg.conversation_id,
                  senderId: msg.sender_id ?? '',
                  content: msg.content,
                  timestamp: new Date(msg.created_at).getTime(),
                  type: msg.message_type,
                  actions: msg.actions
                });
              }
              console.log(`  - Synced ${messages.length} messages for conversation ${conv.id}`);
            }
          } catch (msgError) {
            console.warn(`Failed to sync messages for conversation ${conv.id}:`, msgError);
          }
        }
        
        console.log('Conversation sync complete');
        localStorage.setItem(SYNC_KEY, SYNC_VERSION.toString());
        setSynced(true);
      } catch (error) {
        console.error('Error syncing conversations:', error);
        setSynced(true); // Don't block on error
      }
    };
    
    return () => clearTimeout(timer);
  }, [currentUserId, synced]);

  useEffect(() => {
    void ensureSamConversationRecord();
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

  useEffect(() => {
    return sessionStatusManager.onCurrentUserChange((userId: string | null) => {
      setCurrentUserId(userId);
    });
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
          conversation: SAM_FALLBACK_CONVERSATION,
          meta: {
            displayName: SAM_DISPLAY_NAME,
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
        conversation.type === 'sam' ? SAM_DISPLAY_NAME : buildParticipantNames(conversation, currentUserId).join(', ');
      
      // Extract avatar URL for the first peer (non-current user)
      const peerIds = conversation.participants.filter((id) => id !== currentUserId);
      const primaryPeerId = peerIds.length > 0 ? peerIds[0] : conversation.participants[0];
      const avatarUrl = conversation.participantAvatars?.[primaryPeerId] || undefined;

      return {
        conversation,
        meta: {
          displayName,
          initials: conversation.type === 'sam' ? 'SAM' : buildInitials(displayName || 'Human'),
          avatarUrl,
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
          displayName: SAM_DISPLAY_NAME,
          initials: 'SAM',
          lastMessage: 'Need anything? I can help you prep.',
          relativeTimestamp: formatRelativeTimestamp(samConversation.lastActivity)
        }
      };

    const humanEntries = normalized
      .filter((entry) => entry.conversation.type === 'human')
      .sort((a, b) => b.conversation.lastActivity - a.conversation.lastActivity);

    return [samEntry, ...humanEntries];
  }, [payload, currentUserId]);

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
