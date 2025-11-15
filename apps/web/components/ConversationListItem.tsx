'use client';

import clsx from 'clsx';
import styles from './ConversationSidebar.module.css';
import type { ConversationListEntry } from '../hooks/useConversationData';

interface ConversationListItemProps {
  entry: ConversationListEntry;
  isActive: boolean;
  onSelect: (conversationId: string) => void;
}

const statusIconMap = {
  active: '●',
  scheduled: '⏰'
} as const;

type StatusVariant = keyof typeof statusIconMap;

const statusClassMap: Record<StatusVariant, string> = {
  active: styles.statusActive,
  scheduled: styles.statusScheduled
};

export default function ConversationListItem({ entry, isActive, onSelect }: ConversationListItemProps) {
  const { conversation, meta } = entry;
  const isSam = conversation.type === 'sam';
  const unreadCount = conversation.unreadCount ?? 0;

  const handleClick = () => onSelect(conversation.conversationId);

  const statusVariant = meta?.status;
  const statusClass = statusVariant ? statusClassMap[statusVariant] : undefined;

  return (
    <li
      className={clsx(styles.listItem, isActive && styles.active, isSam && styles.samItem)}
      onClick={handleClick}
    >
      <div className={clsx(styles.avatar, isSam && styles.avatarSam)}>
        {isSam ? '✦' : meta?.initials}
      </div>
      <div className={styles.content}>
        <div className={styles.topRow}>
          <span className={styles.name}>{meta?.displayName ?? 'Unknown'}</span>
          <span className={styles.timestamp}>{meta?.relativeTimestamp}</span>
        </div>
        <div className={styles.preview}>{meta?.lastMessage ?? 'No messages yet'}</div>
        <div className={styles.badges}>
          {statusVariant && statusClass && (
            <span className={clsx(styles.status, statusClass)}>
              {statusIconMap[statusVariant]} {statusVariant === 'active' ? 'Active' : 'Scheduled'}
            </span>
          )}
          {unreadCount > 0 && <span className={clsx(styles.badge, styles.unread)}>{Math.min(unreadCount, 99)}</span>}
        </div>
      </div>
    </li>
  );
}
