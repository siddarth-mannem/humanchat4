'use client';

import clsx from 'clsx';
import { useMemo, useRef, useState } from 'react';
import ConversationListItem from './ConversationListItem';
import styles from './ConversationSidebar.module.css';
import { useConversationData } from '../hooks/useConversationData';
import { useArchivedConversations } from '../hooks/useArchivedConversations';
import type { ManagedRequest } from '../../../src/lib/db';

interface ConversationSidebarProps {
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  collapsed?: boolean;
  requests?: ManagedRequest[];
  requestProfiles?: Record<string, { name?: string; headline?: string | null; avatarUrl?: string | null }>;
  requestLoading?: boolean;
  requestError?: string | null;
  onRequestAction?: (requestId: string, status: ManagedRequest['status']) => Promise<unknown> | void;
  requestActionPendingId?: string | null;
}

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleString();
};

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  collapsed,
  requests,
  requestProfiles,
  requestLoading,
  requestError,
  onRequestAction,
  requestActionPendingId
}: ConversationSidebarProps) {
  const { conversations, hasHumanConversations, error, reload, refreshing } = useConversationData();
  const { archive, unarchive, archivedIds, isArchived } = useArchivedConversations();
  const [pullHint, setPullHint] = useState<'idle' | 'ready' | 'refreshing'>('idle');
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<number>(0);
  const pulling = useRef(false);
  const pendingRequests = useMemo(() => {
    return (requests ?? []).filter((request) => request.status === 'pending');
  }, [requests]);
  const showRequestSection = pendingRequests.length > 0 || Boolean(requestLoading) || Boolean(requestError);

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

        {showRequestSection && (
          <>
            <p className={styles.sectionTitle}>Requests</p>
            {pendingRequests.length === 0 ? (
              <div className={styles.requestNotice}>
                {requestLoading ? 'Loading requests…' : requestError ?? 'No pending requests'}
              </div>
            ) : (
              <ul className={clsx(styles.list, styles.requestList)}>
                {pendingRequests.map((request) => {
                  const profile = requestProfiles?.[request.requesterId];
                  const displayName = profile?.name ?? 'New request';
                  const subtitle = profile?.headline ?? 'Waiting for your response';
                  const initials = displayName
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((segment) => segment[0]?.toUpperCase() ?? '')
                    .join('') || 'RQ';
                  const isUpdating = requestActionPendingId === request.requestId;

                  const handleAction = (status: ManagedRequest['status']) => {
                    if (!onRequestAction) {
                      return;
                    }
                    const outcome = onRequestAction(request.requestId, status);
                    if (outcome && typeof (outcome as Promise<unknown>).catch === 'function') {
                      (outcome as Promise<unknown>).catch((actionError) => {
                        console.warn('Request action failed', actionError);
                      });
                    }
                  };

                  return (
                    <li key={request.requestId} className={styles.requestItem}>
                      <div className={styles.requestAvatar}>
                        {profile?.avatarUrl ? (
                          <img src={profile.avatarUrl} alt={displayName} />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className={styles.requestBody}>
                        <div className={styles.requestHeader}>
                          <div>
                            <p className={styles.requestName}>{displayName}</p>
                            <p className={styles.requestMeta}>{subtitle}</p>
                          </div>
                          <span className={styles.requestTimestamp}>{formatRelativeTime(request.createdAt)}</span>
                        </div>
                        {request.message && <p className={styles.requestMessage}>{request.message}</p>}
                        <div className={styles.requestActions}>
                          <button
                            type="button"
                            className={styles.requestButton}
                            onClick={() => handleAction('declined')}
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'Updating…' : 'Decline'}
                          </button>
                          <button
                            type="button"
                            className={clsx(styles.requestButton, styles.requestButtonPrimary)}
                            onClick={() => handleAction('approved')}
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'Processing…' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

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
