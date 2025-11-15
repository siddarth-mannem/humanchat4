'use client';

import type { Conversation, Session, Action } from '../../../src/lib/db';
import styles from './ConversationView.module.css';
import ProfileCard from './ProfileCard';

interface ActionRendererProps {
  action: Action;
  onOpenConversation?: (conversationId: string) => void;
  onCreateSession?: (conversation: Conversation, session: Session) => void;
  onSelectSlot?: (slotId: string) => void;
  onConnectNow?: (userId: string) => void;
  onBookTime?: (userId: string) => void;
}

const formatRate = (rate?: number) => (rate ? `$${rate.toFixed(2)}/min` : '');

const OfferConnection = ({
  action,
  onOpenConversation
}: {
  action: Extract<Action, { type: 'offer_connection' }>;
  onOpenConversation?: (conversationId: string) => void;
}) => (
  <div className={styles.actionStack}>
    <strong>Connection options</strong>
    {action.connectionOptions?.map((option, index) => (
      <div key={option.mode + index} className={styles.profileCard}>
        <div>{option.mode.toUpperCase()}</div>
        <p className={styles.profileHeadline}>{formatRate(option.ratePerMinute)}</p>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => onOpenConversation?.(action.targetUserId)}
        >
          Connect
        </button>
      </div>
    ))}
  </div>
);

export default function ActionRenderer({
  action,
  onOpenConversation,
  onCreateSession,
  onSelectSlot,
  onConnectNow,
  onBookTime
}: ActionRendererProps) {
  if (!action) return null;

  switch (action.type || action.actionType) {
    case 'show_profiles': {
      const profiles = (action as Extract<Action, { type: 'show_profiles' }>).profiles ?? [];
      return (
        <div className={styles.profileScroller}>
          {profiles.map((profile) => (
            <ProfileCard key={profile.userId} profile={profile} onConnectNow={onConnectNow} onBookTime={onBookTime} />
          ))}
        </div>
      );
    }
    case 'offer_connection':
      return <OfferConnection action={action as Extract<Action, { type: 'offer_connection' }> } onOpenConversation={onOpenConversation} />;
    case 'show_slots': {
      const slots = (action as Extract<Action, { type: 'show_slots' }>).slots ?? [];
      return (
        <div className={styles.calendarGrid}>
          {slots.map((slot) => (
            <button key={slot.id} className={styles.slotButton} type="button" onClick={() => onSelectSlot?.(slot.id)}>
              {slot.label}
            </button>
          ))}
        </div>
      );
    }
    case 'confirm_booking': {
      const confirm = action as Extract<Action, { type: 'confirm_booking' }>;
      return (
        <div className={styles.confirmationCard}>
          <strong>Booking confirmed</strong>
          <p>{confirm.summary}</p>
        </div>
      );
    }
    case 'system_notice': {
      const notice = action as Extract<Action, { type: 'system_notice' }>;
      return <div className={styles.noticeBanner}>{notice.notice || notice.label}</div>;
    }
    case 'create_session': {
      const payload = action as Extract<Action, { type: 'create_session' }>;
      return (
        <div className={styles.confirmationCard}>
          <strong>Session Ready</strong>
          <p>{payload.label ?? 'Sam prepped a new session for you.'}</p>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => onCreateSession?.(payload.conversation, payload.session)}
          >
            Join Session
          </button>
        </div>
      );
    }
    case 'open_conversation': {
      const payload = action as Extract<Action, { type: 'open_conversation' }>;
      return (
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => onOpenConversation?.(payload.conversationId)}
        >
          Jump into chat
        </button>
      );
    }
    default:
      return action.label ? <div className={styles.noticeBanner}>{action.label}</div> : null;
  }
}
