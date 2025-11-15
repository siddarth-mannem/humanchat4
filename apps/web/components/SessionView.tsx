'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Conversation, Message, Session } from '../../../src/lib/db';
import styles from './ConversationView.module.css';

interface SessionViewProps {
  conversation: Conversation;
  session: Session | null;
  messages: Message[];
  registerScrollContainer: (node: HTMLDivElement | null) => void;
}

const isUserMessage = (message: Message, conversation: Conversation) => {
  return conversation.participants.includes(message.senderId);
};

const formatCountdown = (target: number) => {
  const delta = Math.max(0, target - Date.now());
  const seconds = Math.floor(delta / 1000) % 60;
  const minutes = Math.floor(delta / (1000 * 60)) % 60;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export default function SessionView({ conversation, session, messages, registerScrollContainer }: SessionViewProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const orderedMessages = useMemo(() => messages.sort((a, b) => a.timestamp - b.timestamp), [messages]);
  const isInProgress = session?.status === 'in_progress';
  const isComplete = session?.status === 'complete';
  const isScheduled = !isInProgress && !isComplete && (session?.startTime ?? 0) > now;

  if (isScheduled) {
    return (
      <div className={styles.countdown}>
        <strong>{formatCountdown(session!.startTime)}</strong>
        <p>Session starts in</p>
      </div>
    );
  }

  if (isComplete || !session) {
    return (
      <div className={styles.archivedView}>
        <div className={styles.archivedNotice}>This session has ended. Messages are read-only.</div>
        <div className={styles.messageList} ref={registerScrollContainer}>
          {orderedMessages.map((message) => (
            <div
              key={message.id ?? `${message.timestamp}-${message.senderId}`}
              className={`${styles.bubbleRow} ${isUserMessage(message, conversation) ? styles.userRow : styles.samRow}`}
            >
              <div className={styles.bubble}>{message.content}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.humanView}>
      <div className={styles.sessionLayout}>
        <div className={styles.videoPanel}>Live Video Placeholder</div>
        <div className={styles.chatPanel}>
          <div className={styles.messageList} ref={registerScrollContainer}>
            {orderedMessages.map((message) => (
              <div
                key={message.id ?? `${message.timestamp}-${message.senderId}`}
                className={`${styles.bubbleRow} ${isUserMessage(message, conversation) ? styles.userRow : styles.samRow}`}
              >
                <div className={styles.bubble}>{message.content}</div>
              </div>
            ))}
          </div>
          <form className={styles.inputBar} onSubmit={(event) => event.preventDefault()}>
            <textarea placeholder="Message during session..." />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
