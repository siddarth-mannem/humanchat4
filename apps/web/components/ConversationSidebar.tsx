'use client';

import clsx from 'clsx';
import { useRef, useState } from 'react';
import ConversationListItem from './ConversationListItem';
import styles from './ConversationSidebar.module.css';
import { useConversationData } from '../hooks/useConversationData';
import { useArchivedConversations } from '../hooks/useArchivedConversations';

interface ConversationSidebarProps {
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  collapsed?: boolean;
}

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  collapsed
}: ConversationSidebarProps) {
  const { conversations, hasHumanConversations, error, reload, refreshing } = useConversationData();
  const { archive, unarchive, archivedIds, isArchived } = useArchivedConversations();
  const [pullHint, setPullHint] = useState<'idle' | 'ready' | 'refreshing'>('idle');
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<number>(0);
  const pulling = useRef(false);

  const handleSelect = (conversationId: string) => {
    onSelectConversation?.(conversationId);
  };

  const samEntry = conversations[0];
  const humanEntries = conversations.slice(1).filter((entry) => !isArchived(entry.conversation.conversationId));
  const archivedEntries = conversations.slice(1).filter((entry) => isArchived(entry.conversation.conversationId));

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!scrollerRef.current) return;
    if (scrollerRef.current.scrollTop > 0) return;
    pulling.current = true;
    touchStart.current = event.touches[0].clientY;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!pulling.current) return;
    const delta = event.touches[0].clientY - touchStart.current;
    if (delta < 0) {
      pulling.current = false;
      setPullHint('idle');
      return;
    }
    if (delta > 80) {
      setPullHint('ready');
    } else {
      setPullHint('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (pullHint === 'ready') {
      setPullHint('refreshing');
      await reload();
    }
    setPullHint('idle');
    pulling.current = false;
  };

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.sidebarCollapsed)}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Conversations</span>
        <span className={styles.timestamp}>{new Date().toLocaleDateString()}</span>
      </div>
      <div
        className={styles.scroller}
        ref={scrollerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {(pullHint === 'ready' || pullHint === 'refreshing' || refreshing) && (
          <div className={styles.pullIndicator}>{pullHint === 'refreshing' || refreshing ? 'Refreshing…' : 'Release to refresh'}</div>
        )}
        <p className={styles.sectionTitle}>Concierge</p>
        <ul className={styles.list}>
          {samEntry && (
            <ConversationListItem
              entry={samEntry}
              isActive={activeConversationId === samEntry.conversation.conversationId}
              onSelect={handleSelect}
              onArchive={archive}
              showMetadata={!collapsed}
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
              onArchive={archive}
              showMetadata={!collapsed}
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

        {archivedEntries.length > 0 && (
          <div className={styles.archivedSection}>
            <p className={styles.sectionTitle}>Archived</p>
            <ul className={styles.list}>
              {archivedEntries.map((entry) => (
                <li key={entry.conversation.conversationId} className={styles.archivedItem}>
                  <ConversationListItem
                    entry={entry}
                    isActive={false}
                    onSelect={handleSelect}
                    showMetadata={!collapsed}
                    disableGestures
                  />
                  <button type="button" className={styles.unarchiveButton} onClick={() => unarchive(entry.conversation.conversationId)}>
                    Unarchive
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
