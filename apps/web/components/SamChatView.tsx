'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, Conversation, Message, Session } from '../../../src/lib/db';
import { addMessage, db } from '../../../src/lib/db';
import { sendSamMessage } from '../utils/samAPI';
import styles from './ConversationView.module.css';
import MessageBubble from './MessageBubble';
import ActionRenderer from './ActionRenderer';

interface SamChatViewProps {
  conversation: Conversation;
  messages: Message[];
  registerScrollContainer: (node: HTMLDivElement | null) => void;
  onOpenConversation?: (conversationId: string) => void;
  onConnectNow?: (userId: string) => void;
  onBookTime?: (userId: string) => void;
}

const isSamMessage = (message: Message) => message.type === 'sam_response' || message.senderId === 'sam';

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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const orderedMessages = useMemo(() => [...messages].sort((a, b) => a.timestamp - b.timestamp), [messages]);

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
    await addMessage(conversation.conversationId, {
      senderId: 'sam',
      content,
      type: 'sam_response',
      actions,
      timestamp: Date.now()
    });
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
    await addMessage(conversation.conversationId, {
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    setSendError(null);
    setThinking(true);

    await addMessage(conversation.conversationId, {
      senderId: localUserId,
      content: text,
      type: 'user_text',
      timestamp: Date.now()
    });

    try {
      const response = await sendSamMessage(conversation.conversationId, text);
      await persistSamMessage(response.text ?? 'Sam is thinking...', response.actions);
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
      <div className={styles.messageList} ref={handleContainerRef}>
        {orderedMessages.map((message) => {
          const fromSam = isSamMessage(message);
          return (
            <MessageBubble key={message.id ?? `${message.timestamp}-${message.senderId}`} message={message} variant={fromSam ? 'sam' : 'user'}>
              {fromSam && message.actions && message.actions.length > 0 && (
                <div className={styles.actionStack}>
                  {message.actions.map((action) => (
                    <ActionRenderer
                      key={action.id}
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
        })}
      </div>
      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <textarea
          placeholder="Message Sam..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
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
