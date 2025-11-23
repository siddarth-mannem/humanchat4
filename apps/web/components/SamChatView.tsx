'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, Conversation, Message, Session, ProfileSummary, SamShowcaseProfile } from '../../../src/lib/db';
import { addMessage, db } from '../../../src/lib/db';
import { sendSamMessage, type ConversationHistoryPayload } from '../utils/samAPI';
import styles from './ConversationView.module.css';
import MessageBubble from './MessageBubble';
import ActionRenderer from './ActionRenderer';
import VirtualMessageList from './VirtualMessageList';
import { notifyNewMessage } from '../utils/notifications';
import { SAM_CONCIERGE_ID, SAM_FALLBACK_CONVERSATION } from '../hooks/useConversationData';

interface SamChatViewProps {
  conversation: Conversation;
  messages: Message[];
  registerScrollContainer: (node: HTMLDivElement | null) => void;
  onOpenConversation?: (conversationId: string) => void;
  onConnectNow?: (userId: string) => void;
  onBookTime?: (profile: ProfileSummary) => void;
}

const isSamMessage = (message: Message) => message.type === 'sam_response' || message.senderId === 'sam';

const normalizeProfile = (profile: ProfileSummary | SamShowcaseProfile, index: number): SamShowcaseProfile => {
  if ('rate_per_minute' in profile || 'status' in profile) {
    const typed = profile as SamShowcaseProfile;
    return {
      name: typed.name ?? `Profile ${index + 1}`,
      headline: typed.headline ?? 'HumanChat expert',
      expertise: Array.isArray(typed.expertise) ? typed.expertise : [],
      rate_per_minute: typed.rate_per_minute ?? 0,
      status: typed.status ?? 'available'
    };
  }

  const legacy = profile as ProfileSummary;
  return {
    name: legacy.name ?? `Profile ${index + 1}`,
    headline: legacy.headline ?? 'HumanChat expert',
    expertise: legacy.scheduledRates?.map((slot) => `${slot.durationMinutes} min`) ?? [],
    rate_per_minute: legacy.instantRatePerMinute ?? 0,
    status: legacy.hasActiveSession ? 'booked' : legacy.isOnline ? 'available' : 'away'
  };
};

const migrateSamConversation = async (oldId: string, nextId: string): Promise<void> => {
  if (!nextId || oldId === nextId) {
    return;
  }

  console.log('[migrateSamConversation] Starting migration from', oldId, 'to', nextId);

  // Create or update the new conversation
  const existing = await db.conversations.get(nextId);
  if (!existing) {
    const snapshot = (await db.conversations.get(oldId)) ?? SAM_FALLBACK_CONVERSATION;
    await db.conversations.put({
      ...snapshot,
      conversationId: nextId,
      lastActivity: Date.now()
    });
    console.log('[migrateSamConversation] Created new conversation:', nextId);
  } else {
    console.log('[migrateSamConversation] Conversation already exists:', nextId);
  }

  // Migrate all messages to the new conversation
  const messages = await db.messages.where('conversationId').equals(oldId).toArray();
  console.log('[migrateSamConversation] Migrating', messages.length, 'messages');
  
  await Promise.all(
    messages.map((message) => {
      if (!message.id) return Promise.resolve();
      return db.messages.update(message.id, { conversationId: nextId });
    })
  );

  // Clean up old conversation if it's the default sam-concierge
  if (oldId === SAM_CONCIERGE_ID) {
    await db.conversations.delete(SAM_CONCIERGE_ID);
    console.log('[migrateSamConversation] Deleted old sam-concierge conversation');
  }
  
  console.log('[migrateSamConversation] Migration complete');
};

export default function SamChatView({
  conversation,
  messages,
  registerScrollContainer,
  onOpenConversation,
  onConnectNow,
  onBookTime
}: SamChatViewProps) {
  const [draft, setDraft] = useState('');
  const [isThinking, setThinking] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState(conversation.conversationId);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveConversationId(conversation.conversationId);
  }, [conversation.conversationId]);

  const orderedMessages = useMemo(() => [...messages].sort((a, b) => a.timestamp - b.timestamp), [messages]);

  const knownProfiles = useMemo(() => {
    const collected = new Map<string, SamShowcaseProfile>();

    orderedMessages.forEach((message) => {
      (message.actions ?? []).forEach((action) => {
        if ((action.type || action.actionType) !== 'show_profiles') return;
        const profiles = (action as Extract<Action, { type: 'show_profiles' }>).profiles ?? [];
        profiles.forEach((profile, index) => {
          const normalized = normalizeProfile(profile, index);
          const key = normalized.name?.toLowerCase() ?? `profile-${index}`;
          collected.set(key, normalized);
        });
      });
    });

    return Array.from(collected.values());
  }, [orderedMessages]);

  const handleContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      registerScrollContainer(node);
    },
    [registerScrollContainer]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [orderedMessages.length]);

  const localUserId = useMemo(() => {
    return conversation.participants.find((participant) => participant !== 'sam') ?? 'user_local';
  }, [conversation.participants]);

  const persistSamMessage = async (content: string, actions?: Action[]) => {
    console.log('[SamChatView] Persisting Sam message:', { content, actions, activeConversationId });
    await addMessage(activeConversationId, {
      senderId: 'sam',
      content,
      type: 'sam_response',
      actions,
      timestamp: Date.now()
    });
    await notifyNewMessage('Sam Concierge', content);
  };

  const handleCreateSessionAction = async (nextConversation: Conversation, session: Session) => {
    await db.conversations.put({ ...nextConversation, lastActivity: Date.now() });
    await db.sessions.put(session);
    onOpenConversation?.(nextConversation.conversationId);
  };

  const handleOpenConversation = (conversationId: string) => {
    if (!conversationId) return;
    onOpenConversation?.(conversationId);
  };

  const handleSlotSelection = async (slotId: string) => {
    await addMessage(activeConversationId, {
      senderId: localUserId,
      content: `Let's book slot ${slotId}.`,
      type: 'user_text',
      timestamp: Date.now()
    });
    try {
      await persistSamMessage('Got it — submitting that slot now.');
    } catch (error) {
      console.error(error);
    }
  };

  const handleQuickReply = (message: Message) => {
    setDraft((prev) => {
      if (prev.includes(message.content)) return prev;
      const quoted = `"${message.content}"`;
      return prev ? `${prev}\n${quoted}` : quoted;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    setSendError(null);
    setThinking(true);

    const historyPayload: ConversationHistoryPayload[] = orderedMessages.map((message) => ({
      role: isSamMessage(message) ? 'sam' : 'user',
      content: message.content,
      timestamp: new Date(message.timestamp).toISOString()
    }));

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const availableProfiles: SamShowcaseProfile[] =
      knownProfiles.length > 0
        ? knownProfiles
        : conversation.participants
            .filter((participant) => participant !== 'sam')
            .map((name) => ({
              name,
              headline: 'HumanChat expert',
              status: 'available' as const,
              expertise: [],
              rate_per_minute: 0
            }));

    await addMessage(activeConversationId, {
      senderId: localUserId,
      content: text,
      type: 'user_text',
      timestamp: Date.now()
    });

    try {
      const response = await sendSamMessage({
        conversationId: activeConversationId,
        message: text,
        conversationHistory: [...historyPayload, { role: 'user', content: text, timestamp: new Date().toISOString() }],
        userContext: {
          sidebarState: {
            activeConversationId: conversation.conversationId,
            totalParticipants: conversation.participants.length
          },
          timezone: userTimezone,
          availableProfiles
        }
      });

      console.log('[SamChatView] Received response:', response);
      console.log('[SamChatView] Response text:', response.text);
      console.log('[SamChatView] Response actions:', response.actions);
      
      if (response.conversationId && response.conversationId !== activeConversationId) {
        console.log('[SamChatView] Migrating conversation from', activeConversationId, 'to', response.conversationId);
        await migrateSamConversation(activeConversationId, response.conversationId);
        setActiveConversationId(response.conversationId);
        // Notify parent to switch to the new conversation so messages load correctly
        onOpenConversation?.(response.conversationId);
      }
      
      console.log('[SamChatView] About to persist message with text:', response.text);
      try {
        await persistSamMessage(response.text ?? 'Sam is thinking...', response.actions);
        console.log('[SamChatView] Message persisted successfully');
      } catch (persistError) {
        console.error('[SamChatView] Failed to persist message:', persistError);
        throw persistError;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach Sam right now.';
      setSendError(message);
      await persistSamMessage('Apologies, I could not send that request. Please try again.');
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className={styles.samView}>
      <VirtualMessageList messages={orderedMessages} className={styles.messageList} registerScrollContainer={handleContainerRef}>
        {(message) => {
          const fromSam = isSamMessage(message);
          return (
            <MessageBubble
              key={message.id ?? `${message.timestamp}-${message.senderId}`}
              message={message}
              variant={fromSam ? 'sam' : 'user'}
              onQuickReply={handleQuickReply}
            >
              {fromSam && message.actions && message.actions.length > 0 && (
                <div className={styles.actionStack}>
                  {message.actions.map((action, index) => (
                    <ActionRenderer
                      key={action.id ?? `${message.timestamp}-${index}`}
                      action={action}
                      onOpenConversation={handleOpenConversation}
                      onCreateSession={handleCreateSessionAction}
                      onSelectSlot={handleSlotSelection}
                      onConnectNow={onConnectNow}
                      onBookTime={onBookTime}
                    />
                  ))}
                </div>
              )}
            </MessageBubble>
          );
        }}
      </VirtualMessageList>
      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <textarea
          placeholder="Message Sam..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Send on Enter, new line on Shift+Enter
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (draft.trim() && !isThinking) {
                handleSubmit(event as any);
              }
            }
          }}
          disabled={isThinking}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          {isThinking && (
            <div className={styles.inputStatus}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              Thinking...
            </div>
          )}
          {sendError && <div className={styles.error}>{sendError}</div>}
          <button type="submit" disabled={!draft.trim() || isThinking}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
