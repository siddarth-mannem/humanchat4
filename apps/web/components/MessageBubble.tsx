'use client';

import clsx from 'clsx';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { Conversation, Message } from '../../../src/lib/db';
import styles from './ConversationView.module.css';

interface MessageBubbleProps {
  message: Message;
  variant: 'sam' | 'user';
  children?: ReactNode;
  onQuickReply?: (message: Message) => void;
  currentUserId?: string | null;
  conversation?: Conversation | null;
}

const getVisibleMessageContent = (
  message: Message,
  currentUserId: string | null,
  conversation: Conversation | null
): string => {
  if (
    message.type !== 'system_notice' ||
    !message.actions ||
    message.actions.length === 0 ||
    !currentUserId ||
    !conversation
  ) {
    return message.content;
  }

  const bookingAction = message.actions.find(
    (a) => a.type === 'booking_cancelled' && a.payload
  );

  if (!bookingAction || !bookingAction.payload) {
    return message.content;
  }

  const { expertId } = bookingAction.payload as { expertId?: string };
  const userRole = currentUserId === expertId ? 'expert' : 'client';

  const roleSpecificAction = message.actions.find(
    (a) =>
      a.type === 'booking_cancelled' &&
      (a as any).visibility === userRole &&
      typeof (a as any).content === 'string'
  );

  return (roleSpecificAction as any)?.content ?? message.content;
};

export default function MessageBubble({
  message,
  variant,
  children,
  onQuickReply,
  currentUserId,
  conversation
}: MessageBubbleProps) {
  const touchStartX = useRef<number | null>(null);
  const touchDelta = useRef(0);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    touchDelta.current = event.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    if (touchDelta.current > 60 && onQuickReply) {
      onQuickReply(message);
    }
    touchStartX.current = null;
    touchDelta.current = 0;
  };

  const content = getVisibleMessageContent(message, currentUserId, conversation);

  return (
    <div
      className={clsx(styles.bubbleRow, variant === 'sam' ? styles.samRow : styles.userRow)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.messageBubble}>
        <div className={styles.bubble}>{content}</div>
        {children}
        <span className={styles.messageMeta}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
