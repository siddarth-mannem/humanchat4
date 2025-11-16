'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message } from '../../../src/lib/db';
import { addMessage } from '../../../src/lib/db';
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
    await addMessage(conversation.conversationId, {
      senderId: currentUserId,
      content: message,
      type: 'user_text'
    });
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
            <MessageBubble message={message} variant={isMine ? 'user' : 'sam'} onQuickReply={handleQuickReply} />
          );
        }}
      </VirtualMessageList>
      {isTyping && <div className={styles.typingIndicator}>Typing…</div>}
      <form className={styles.chatInputBar} onSubmit={handleSubmit}>
        <textarea placeholder="Message during session…" value={draft} onChange={handleChange} disabled={!currentUserId} />
        <button type="submit" disabled={!draft.trim() || !currentUserId}>
          Send
        </button>
      </form>
    </div>
  );
}
