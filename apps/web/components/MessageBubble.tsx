'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Message } from '../../../src/lib/db';
import styles from './ConversationView.module.css';

interface MessageBubbleProps {
  message: Message;
  variant: 'sam' | 'user';
  children?: ReactNode;
}

export default function MessageBubble({ message, variant, children }: MessageBubbleProps) {
  return (
    <div className={clsx(styles.bubbleRow, variant === 'sam' ? styles.samRow : styles.userRow)}>
      <div className={styles.messageBubble}>
        <div className={styles.bubble}>{message.content}</div>
        {children}
        <span className={styles.messageMeta}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
