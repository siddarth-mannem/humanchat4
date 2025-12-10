'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from './ConversationView.module.css';
import { useConversationDetail } from '../hooks/useConversationDetail';
import SamChatView from './SamChatView';
import SessionView from './SessionView';
import type { ProfileSummary } from '../../../src/lib/db';
import BookingModal from './BookingModal';
import RequestForm from './RequestForm';
import { connectNow as connectNowWithProfile } from '../services/conversationClient';
import { sessionStatusManager } from '../services/sessionStatusManager';

interface ConversationViewProps {
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  isMobile?: boolean;
  onBack?: () => void;
}

type ScrollBinding = {
  node: HTMLDivElement | null;
  cleanup?: () => void;
};

export default function ConversationView({ activeConversationId, onSelectConversation, isMobile, onBack }: ConversationViewProps) {
  const { conversation, session, invite, messages, loading, error } = useConversationDetail(activeConversationId);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const bindingRef = useRef<ScrollBinding>({ node: null });
  const [bookingProfile, setBookingProfile] = useState<ProfileSummary | null>(null);
  const [requestProfile, setRequestProfile] = useState<ProfileSummary | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingProfileId, setConnectingProfileId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
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
      title: conversation.type === 'sam' ? 'Sam Concierge' : humanTitle,
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

  return (
    <>
      <section className={clsx(styles.container, isMobile && styles.mobileContainer)}>
      <div className={styles.header}>
        <div className={styles.headerTitleStack}>
          {isMobile && (
            <button type="button" className={styles.backButton} onClick={onBack}>
              ← Back
            </button>
          )}
          <div className={styles.title}>{summary.title}</div>
          <div className={styles.subtitle}>{summary.subtitle}</div>
        </div>
        {conversation && (
          <div className={styles.metadata}>
            Last activity • {new Date(conversation.lastActivity).toLocaleTimeString()}
          </div>
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
