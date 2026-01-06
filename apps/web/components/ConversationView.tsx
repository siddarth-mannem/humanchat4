'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import styles from './ConversationView.module.css';
import { useConversationDetail } from '../hooks/useConversationDetail';
import SamChatView from './SamChatView';
import SessionView from './SessionView';
import type { ProfileSummary } from '../../../src/lib/db';
import BookingModal from './BookingModal';
import RequestForm from './RequestForm';
import { connectNow as connectNowWithProfile } from '../services/conversationClient';
import { sessionStatusManager } from '../services/sessionStatusManager';
import { SAM_DISPLAY_NAME } from '../hooks/useConversationData';

interface ConversationViewProps {
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  isMobile?: boolean;
  onBack?: () => void;
  onShowProfilePanel?: () => void;
}

type ScrollBinding = {
  node: HTMLDivElement | null;
  cleanup?: () => void;
};

export default function ConversationView({
  activeConversationId,
  onSelectConversation,
  isMobile,
  onBack,
  onShowProfilePanel
}: ConversationViewProps) {
  const { conversation, session, invite, messages, loading, error } = useConversationDetail(activeConversationId);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const bindingRef = useRef<ScrollBinding>({ node: null });
  const [bookingProfile, setBookingProfile] = useState<ProfileSummary | null>(null);
  const [requestProfile, setRequestProfile] = useState<ProfileSummary | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingProfileId, setConnectingProfileId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(sessionStatusManager.getCurrentUserId());
    return sessionStatusManager.onCurrentUserChange((userId) => setCurrentUserId(userId));
  }, []);

  const registerScrollContainer = useCallback(
    (node: HTMLDivElement | null) => {
      bindingRef.current.cleanup?.();
      bindingRef.current = { node };

      if (!node || !activeConversationId) {
        return;
      }

      const stored = scrollPositions.current.get(activeConversationId);
      if (typeof stored === 'number') {
        node.scrollTop = stored;
      } else {
        node.scrollTop = node.scrollHeight;
      }

      const handleScroll = () => {
        scrollPositions.current.set(activeConversationId, node.scrollTop);
      };

      node.addEventListener('scroll', handleScroll);
      const cleanup = () => {
        node.removeEventListener('scroll', handleScroll);
        scrollPositions.current.set(activeConversationId, node.scrollTop);
      };
      bindingRef.current.cleanup = cleanup;
    },
    [activeConversationId]
  );

  useEffect(() => {
    return () => {
      bindingRef.current.cleanup?.();
    };
  }, []);

  const scrollToLatest = useCallback(() => {
    const node = bindingRef.current.node;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
    if (activeConversationId) {
      scrollPositions.current.set(activeConversationId, node.scrollHeight);
    }
  }, [activeConversationId]);

  const summary = useMemo(() => {
    if (!activeConversationId) {
      return {
        title: 'No conversation selected',
        subtitle: 'Pick a conversation from the sidebar to get started.'
      };
    }
    if (!conversation) {
      return {
        title: 'Conversation not found',
        subtitle: 'It may have been removed locally. Try syncing again.'
      };
    }
    const resolveLabel = (participantId: string): string => {
      return conversation.participantLabels?.[participantId] ?? participantId;
    };

    const orderedLabels = conversation.participants.map(resolveLabel);
    const peerLabels = currentUserId
      ? conversation.participants
          .filter((participantId) => participantId !== currentUserId)
          .map(resolveLabel)
      : orderedLabels;

    const humanTitle = peerLabels.length > 0 ? peerLabels.join(', ') : orderedLabels.join(', ');

    return {
      title: conversation.type === 'sam' ? SAM_DISPLAY_NAME : humanTitle,
      subtitle: conversation.type === 'sam' ? 'AI Concierge' : 'Direct chat'
    };
  }, [activeConversationId, conversation, currentUserId]);

  const handleConnectNow = useCallback(
    async (profile: ProfileSummary) => {
      if (!profile.userId) {
        setConnectError('Unable to start a session for this profile.');
        return;
      }
      const currentUserId = sessionStatusManager.getCurrentUserId();
      if (!currentUserId) {
        setConnectError('Please sign back in to start a live session.');
        return;
      }

      setConnectingProfileId(profile.userId);
      setConnectError(null);
      try {
        const createdConversationId = await connectNowWithProfile(profile, currentUserId);
        onSelectConversation?.(createdConversationId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sam could not connect that session.';
        setConnectError(message);
      } finally {
        setConnectingProfileId((prev) => (prev === profile.userId ? null : prev));
      }
    },
    [onSelectConversation]
  );

  const router = useRouter();
  
  const otherParticipant = useMemo(() => {
    if (!conversation || !currentUserId || conversation.type === 'sam') return null;
    const otherId = conversation.participants.find(p => p !== currentUserId);
    if (!otherId) return null;
    return {
      id: otherId,
      name: conversation.participantLabels?.[otherId] || 'User',
      avatar: conversation.participantAvatars?.[otherId]
    };
  }, [conversation, currentUserId]);

  const handleScheduleClick = () => {
    if (!otherParticipant) return;
    router.push(`/experts/${otherParticipant.id}/schedule`);
  };

  return (
    <>
      <section className={clsx(styles.container, isMobile && styles.mobileContainer)}>
      <div className={styles.header}>
        {isMobile ? (
          <div className={styles.mobileHeader}>
            <button type="button" className={styles.mobileMenuButton} onClick={onBack} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 5H17.5M2.5 10H17.5M2.5 15H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <div className={styles.mobileHeaderTitle}>
              <div className={styles.mobileTitle}>{summary.title}</div>
              <div className={styles.mobileSubtitle}>{summary.subtitle}</div>
            </div>
            {onShowProfilePanel && (
              <button type="button" className={styles.mobileAccountButton} onClick={onShowProfilePanel} aria-label="Open account">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 10C12.7614 10 15 7.76142 15 5C15 2.23858 12.7614 0 10 0C7.23858 0 5 2.23858 5 5C5 7.76142 7.23858 10 10 10Z" fill="currentColor"/>
                  <path d="M10 12C5.58172 12 2 14.6863 2 18V20H18V18C18 14.6863 14.4183 12 10 12Z" fill="currentColor"/>
                </svg>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.headerTitleStack}>
              <div className={styles.title}>{summary.title}</div>
              <div className={styles.subtitle}>{summary.subtitle}</div>
            </div>
            <div className={styles.headerActions}>
              {otherParticipant && (
                <button
                  type="button"
                  onClick={handleScheduleClick}
                  className={styles.scheduleButton}
                  title={`Schedule time with ${otherParticipant.name}`}
                >
                  📅 Schedule
                </button>
              )}
              {conversation && (
                <div className={clsx(styles.metadata, styles.headerActionsMetadata)}>
                  Last activity • {new Date(conversation.lastActivity).toLocaleTimeString()}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {connectError && <div className={styles.error}>{connectError}</div>}
      <div className={styles.viewArea}>
        {!activeConversationId && <div className={styles.placeholder}>Choose a conversation to see the full history and context.</div>}
        {activeConversationId && loading && <div className={styles.loading}>Loading conversation…</div>}
        {activeConversationId && error && !loading && (
          <div className={styles.error}>Failed to load conversation. Please retry.</div>
        )}
        {activeConversationId && conversation && !loading && !error && (
          <div className={clsx(styles.viewArea)} key={conversation.conversationId}>
            {conversation.type === 'sam' ? (
              <SamChatView
                conversation={conversation}
                messages={messages}
                registerScrollContainer={registerScrollContainer}
                onOpenConversation={onSelectConversation}
                onConnectNow={handleConnectNow}
                connectingProfileId={connectingProfileId}
                onBookTime={(profile) => {
                  if (profile.managed && profile.confidentialRate) {
                    setRequestProfile(profile);
                    return;
                  }
                  setBookingProfile(profile);
                }}
              />
            ) : (
              <SessionView
                conversation={conversation}
                session={session}
                invite={invite}
                messages={messages}
                registerScrollContainer={registerScrollContainer}
                onScrollToLatest={scrollToLatest}
              />
            )}
          </div>
        )}
      </div>
      </section>
      <BookingModal open={Boolean(bookingProfile)} profile={bookingProfile} conversation={conversation ?? null} onClose={() => setBookingProfile(null)} />
      <RequestForm open={Boolean(requestProfile)} profile={requestProfile} conversation={conversation ?? null} onClose={() => setRequestProfile(null)} />
    </>
  );
}
