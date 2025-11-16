'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Conversation, Message, Session } from '../../../src/lib/db';
import styles from './ConversationView.module.css';
import VideoArea, { type CallEndSummary } from './VideoArea';
import ChatArea from './ChatArea';
import EndCallFlow from './EndCallFlow';
import DonationModal from './DonationModal';
import { sessionStatusManager } from '../services/sessionStatusManager';
import VirtualMessageList from './VirtualMessageList';
import MessageBubble from './MessageBubble';

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());
  const [callSummary, setCallSummary] = useState<(CallEndSummary & { peerName?: string }) | null>(null);
  const [showDonationModal, setShowDonationModal] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = sessionStatusManager.onCurrentUserChange((userId) => setCurrentUserId(userId));
    return () => unsubscribe();
  }, []);

  const orderedMessages = useMemo(() => [...messages].sort((a, b) => a.timestamp - b.timestamp), [messages]);
  const isInProgress = session?.status === 'in_progress';
  const isComplete = session?.status === 'complete';
  const isScheduled = !isInProgress && !isComplete && (session?.startTime ?? 0) > now;
  const peerLabel = useMemo(() => {
    const peer = conversation.participants.find((participant) => participant !== currentUserId);
    return peer ?? 'Session participant';
  }, [conversation.participants, currentUserId]);

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
        <VirtualMessageList messages={orderedMessages} className={styles.messageList} registerScrollContainer={registerScrollContainer}>
          {(message) => (
            <MessageBubble
              message={message}
              variant={isUserMessage(message, conversation) ? 'user' : 'sam'}
            />
          )}
        </VirtualMessageList>
      </div>
    );
  }

  if (!session || !currentUserId) {
    return <div className={styles.error}>Sign in again to join this session.</div>;
  }

  const handleCallEnd = (summary: CallEndSummary) => {
    setCallSummary({ ...summary, peerName: peerLabel });
    setShowDonationModal(false);
  };

  const handleDismissSummary = () => {
    setCallSummary(null);
    setShowDonationModal(false);
  };

  const shouldShowDonationModal = Boolean(callSummary?.donationAllowed && !callSummary.confidentialRate && showDonationModal && session);

  return (
    <div className={styles.sessionShell}>
      <div className={styles.videoSection}>
        <VideoArea session={session} currentUserId={currentUserId} onCallEnd={handleCallEnd} />
      </div>
      <div className={styles.chatSection}>
        <ChatArea conversation={conversation} messages={messages} registerScrollContainer={registerScrollContainer} currentUserId={currentUserId} />
      </div>
      {callSummary && (
        <EndCallFlow
          summary={callSummary}
          onDismiss={handleDismissSummary}
          onDonate={callSummary.donationAllowed ? () => setShowDonationModal(true) : undefined}
        />
      )}
      {shouldShowDonationModal && callSummary && (
        <DonationModal
          sessionId={callSummary.sessionId}
          hostName={callSummary.peerName ?? 'your host'}
          charityName={callSummary.charityName}
          paymentMode={callSummary.paymentMode}
          onClose={() => setShowDonationModal(false)}
        />
      )}
    </div>
  );
}
