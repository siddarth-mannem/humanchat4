'use client';

import clsx from 'clsx';
import { useRef, useState } from 'react';
import styles from './ConversationSidebar.module.css';
import type { ConversationListEntry } from '../hooks/useConversationData';

interface ConversationListItemProps {
  entry: ConversationListEntry;
  isActive: boolean;
  onSelect: (conversationId: string) => void;
  onArchive?: (conversationId: string) => void;
  onDelete?: (conversationId: string) => void;
  showMetadata?: boolean;
  disableGestures?: boolean;
  deletePending?: boolean;
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

export default function ConversationListItem({ entry, isActive, onSelect, onArchive, onDelete, showMetadata = true, disableGestures, deletePending }: ConversationListItemProps) {
  const { conversation, meta } = entry;
  const isSam = conversation.type === 'sam';
  const unreadCount = conversation.unreadCount ?? 0;
  const touchStart = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClick = () => onSelect(conversation.conversationId);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLLIElement>) => {
    if (disableGestures) return;
    touchStart.current = event.touches[0].clientX;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLLIElement>) => {
    if (disableGestures || touchStart.current === null) return;
    touchDelta.current = event.touches[0].clientX - touchStart.current;
  };

  const handleTouchEnd = () => {
    if (disableGestures || touchStart.current === null) return;
    if (touchDelta.current < -60 && onArchive) {
      onArchive(conversation.conversationId);
    }
    touchStart.current = null;
    touchDelta.current = 0;
  };

  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (!onDelete || isSam) {
      return;
    }
    setMenuOpen(false);
    onDelete(conversation.conversationId);
  };

  const handleMenuToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setMenuOpen(!menuOpen);
  };

  // Close menu when clicking outside
  const handleOutsideClick = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setMenuOpen(false);
    }
  };

  // Add/remove click listener for outside clicks
  if (typeof window !== 'undefined') {
    if (menuOpen) {
      setTimeout(() => document.addEventListener('click', handleOutsideClick), 0);
    } else {
      document.removeEventListener('click', handleOutsideClick);
    }
  }

  const statusVariant = meta?.status;
  const statusClass = statusVariant ? statusClassMap[statusVariant] : undefined;
  const avatarSeed = encodeURIComponent(meta?.displayName ?? conversation.conversationId);
  const avatarSrc = isSam
    ? '/icon.svg'
    : `https://api.dicebear.com/8.x/initials/svg?seed=${avatarSeed}`;

  return (
    <li
      className={clsx(styles.listItem, isActive && styles.active, isSam && styles.samItem)}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative' }}
    >
      <div className={clsx(styles.avatar, isSam && styles.avatarSam)}>
        <img src={avatarSrc} alt={meta?.displayName ?? 'Conversation'} loading="lazy" decoding="async" />
      </div>
      {onDelete && !isSam && (
        <div className={styles.menuContainer} ref={menuRef}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={handleMenuToggle}
            aria-label="More options"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={handleDeleteClick}
                disabled={deletePending}
              >
                {deletePending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      )}
      {showMetadata && (
        <div className={styles.content}>
          <div className={styles.topRow}>
            <span className={styles.name}>{meta?.displayName ?? 'Unknown'}</span>
            <div className={styles.topRowMeta}>
              <span className={styles.timestamp}>{meta?.relativeTimestamp}</span>            </div>
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
      )}
    </li>
  );
}
