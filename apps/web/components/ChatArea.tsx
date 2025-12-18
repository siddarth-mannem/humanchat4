'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message } from '../../../src/lib/db';
import { sendMessage as sendMessageApi } from '../services/conversationClient';
import styles from './ConversationView.module.css';
import VirtualMessageList from './VirtualMessageList';
import MessageBubble from './MessageBubble';

interface ChatAreaProps {
  conversation: Conversation;
  messages: Message[];
  registerScrollContainer: (node: HTMLDivElement | null) => void;
  currentUserId: string | null;
}

export default function ChatArea({ conversation, messages, registerScrollContainer, currentUserId }: ChatAreaProps) {
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const orderedMessages = useMemo(() => [...messages].sort((a, b) => a.timestamp - b.timestamp), [messages]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    setIsTyping(true);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(() => setIsTyping(false), 1200);
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !currentUserId) return;
    setDraft('');
    setIsTyping(false);

    try {
      // Send message to backend API - backend will save to PostgreSQL and broadcast via WebSocket
      // The WebSocket notification will add it to IndexedDB for all participants (including sender)
      await sendMessageApi(conversation.conversationId, currentUserId, message, 'user_text');
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: Show error toast to user
    }
  };

  const handleQuickReply = (message: Message) => {
    setDraft((prev) => (prev ? `${prev}\n${message.content}` : message.content));
  };

  return (
    <div className={styles.chatArea}>
      <VirtualMessageList messages={orderedMessages} className={styles.messageList} registerScrollContainer={registerScrollContainer}>
        {(message) => {
          const isMine = currentUserId ? message.senderId === currentUserId : false;
          return (
            <MessageBubble
              message={message}
              variant={isMine ? 'user' : 'sam'}
              onQuickReply={handleQuickReply}
              currentUserId={currentUserId}
              conversation={conversation}
            />
          );
        }}
      </VirtualMessageList>
      {isTyping && <div className={styles.typingIndicator}>Typing…</div>}
      <form ref={formRef} className={styles.chatInputBar} onSubmit={handleSubmit}>
        <textarea
          placeholder="Message during session…"
          value={draft}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!currentUserId) {
                return;
              }
              formRef.current?.requestSubmit();
            }
          }}
          disabled={!currentUserId}
        />
        <button type="submit" disabled={!draft.trim() || !currentUserId}>
          Send
        </button>
      </form>
    </div>
  );
}
