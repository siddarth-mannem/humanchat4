'use client';

import clsx from 'clsx';
import ConversationListItem from './ConversationListItem';
import styles from './ConversationSidebar.module.css';
import { useConversationData } from '../hooks/useConversationData';

interface ConversationSidebarProps {
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
}

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation
}: ConversationSidebarProps) {
  const { conversations, hasHumanConversations, error } = useConversationData();

  const handleSelect = (conversationId: string) => {
    onSelectConversation?.(conversationId);
  };

  const samEntry = conversations[0];
  const humanEntries = conversations.slice(1);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Conversations</span>
        <span className={styles.timestamp}>{new Date().toLocaleDateString()}</span>
      </div>
      <div className={styles.scroller}>
        <p className={styles.sectionTitle}>Concierge</p>
        <ul className={styles.list}>
          {samEntry && (
            <ConversationListItem
              entry={samEntry}
              isActive={activeConversationId === samEntry.conversation.conversationId}
              onSelect={handleSelect}
            />
          )}
        </ul>

        <p className={styles.sectionTitle}>Humans</p>
        <ul className={styles.list}>
          {humanEntries.map((entry) => (
            <ConversationListItem
              key={entry.conversation.conversationId}
              entry={entry}
              isActive={activeConversationId === entry.conversation.conversationId}
              onSelect={handleSelect}
            />
          ))}
        </ul>

        {!hasHumanConversations && (
          <div className={styles.emptyState}>
            <strong>No human conversations yet.</strong>
            <p style={{ marginTop: '8px', marginBottom: 0 }}>
              Once you connect with guests, they will appear here with their latest activity.
            </p>
          </div>
        )}

        {error && (
          <div className={clsx(styles.emptyState)} style={{ borderColor: '#f87171', color: '#fecaca' }}>
            Failed to load conversations. Please refresh.
          </div>
        )}
      </div>
    </aside>
  );
}
