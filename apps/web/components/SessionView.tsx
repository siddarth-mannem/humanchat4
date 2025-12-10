'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Conversation, InstantInvite, Message, Session } from '../../../src/lib/db';
import styles from './ConversationView.module.css';
import VideoArea, { type CallEndSummary } from './VideoArea';
import ChatArea from './ChatArea';
import EndCallFlow from './EndCallFlow';
import DonationModal from './DonationModal';
import { sessionStatusManager } from '../services/sessionStatusManager';
import VirtualMessageList from './VirtualMessageList';
import MessageBubble from './MessageBubble';
import InstantInvitePanel from './InstantInvitePanel';

interface SessionViewProps {
  conversation: Conversation;
  session: Session | null;
  invite?: InstantInvite | null;
  messages: Message[];
  registerScrollContainer: (node: HTMLDivElement | null) => void;
  onScrollToLatest?: () => void;
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

export default function SessionView({ conversation, session, invite, messages, registerScrollContainer, onScrollToLatest }: SessionViewProps) {
  const [now, setNow] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => sessionStatusManager.getCurrentUserId());
  const [callSummary, setCallSummary] = useState<(CallEndSummary & { peerName?: string }) | null>(null);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [callMode, setCallMode] = useState<'video' | 'audio' | null>(null);

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
  const shouldShowInvitePanel = Boolean(invite && (!session || session.status !== 'in_progress'));
  const invitePanel = shouldShowInvitePanel && invite ? <InstantInvitePanel invite={invite} currentUserId={currentUserId} /> : null;
  const peerLabel = useMemo(() => {
    const peer = conversation.participants.find((participant) => participant !== currentUserId);
    if (!peer) {
      return 'Session participant';
    }
    return conversation.participantLabels?.[peer] ?? peer;
  }, [conversation.participants, conversation.participantLabels, currentUserId]);

  useEffect(() => {
    setCallMode(null);
    setCallSummary(null);
    setShowDonationModal(false);
  }, [conversation.conversationId]);

  if (!session) {
    return (
      <div className={styles.sessionShell}>
        {invitePanel}
        <VirtualMessageList messages={orderedMessages} className={styles.messageList} registerScrollContainer={registerScrollContainer}>
          {(message) => (
            <MessageBubble message={message} variant={isUserMessage(message, conversation) ? 'user' : 'sam'} />
          )}
        </VirtualMessageList>
      </div>
    );
  }

  if (isScheduled) {
    return (
      <div className={styles.countdown}>
        {invitePanel}
        <strong>{formatCountdown(session!.startTime)}</strong>
        <p>Session starts in</p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className={styles.archivedView}>
        {invitePanel}
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

  if (!currentUserId) {
    return <div className={styles.error}>Sign in again to join this session.</div>;
  }

  const handleCallEnd = (summary: CallEndSummary) => {
    setCallSummary({ ...summary, peerName: peerLabel });
    setShowDonationModal(false);
    setCallMode(null);
  };

  const handleDismissSummary = () => {
    setCallSummary(null);
    setShowDonationModal(false);
    onScrollToLatest?.();
  };

  const shouldShowDonationModal = Boolean(callSummary?.donationAllowed && !callSummary.confidentialRate && showDonationModal && session);
  const canLaunchCall = Boolean(session && currentUserId);
  const callActive = Boolean(callMode && canLaunchCall);

  const handleLaunchCall = (mode: 'video' | 'audio') => {
    if (!canLaunchCall) return;
    setShowDonationModal(false);
    setCallSummary(null);
    setCallMode(mode);
  };

  return (
    <div className={styles.humanView}>
      {invitePanel}
      <div className={styles.callLauncher}>
        <div>
          <p className={styles.callLauncherTitle}>{callActive ? `Live ${callMode === 'audio' ? 'audio' : 'video'} call with ${peerLabel}` : `Chat with ${peerLabel}`}</p>
          <p className={styles.callLauncherSub}>
            {callActive ? 'Keep the text thread open while you are on the call. End the session any time.' : 'Use the buttons to start a video or audio session when both of you are ready. The chat stays open the entire time.'}
          </p>
        </div>
        <div className={styles.callButtons}>
          <button
            type="button"
            className={styles.callButtonPrimary}
            onClick={() => handleLaunchCall('video')}
            disabled={!canLaunchCall || callActive}
          >
            Start video call
          </button>
          <button
            type="button"
            className={styles.callButtonSecondary}
            onClick={() => handleLaunchCall('audio')}
            disabled={!canLaunchCall || callActive}
          >
            Start audio call
          </button>
        </div>
      </div>
      {callActive && session && currentUserId && (
        <div className={styles.callSurface}>
          <VideoArea session={session} currentUserId={currentUserId} onCallEnd={handleCallEnd} mediaMode={callMode ?? 'video'} />
        </div>
      )}
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
