'use client';

import { useMemo } from 'react';
import type { Conversation, Session, Action, ProfileSummary, SamShowcaseProfile } from '../../../src/lib/db';
import styles from './ConversationView.module.css';
import ProfileCard from './ProfileCard';
import StatusBadge from './StatusBadge';

interface ActionRendererProps {
  action: Action;
  onOpenConversation?: (conversationId: string) => void;
  onCreateSession?: (conversation: Conversation, session: Session) => void;
  onSelectSlot?: (slotId: string) => void;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  connectingProfileId?: string | null;
  directoryProfiles?: ProfileSummary[];
  currentUserId?: string;
}

const formatRate = (rate?: number) => (rate ? `$${rate.toFixed(2)}/min` : '');

const isLegacyProfile = (profile: ProfileSummary | SamShowcaseProfile): profile is ProfileSummary => {
  return (profile as ProfileSummary).userId !== undefined;
};

const isLegacySessionPayload = (
  payload: Extract<Action, { type: 'create_session' }>
): payload is Extract<Action, { type: 'create_session' }> & { conversation: Conversation; session: Session } => {
  return 'conversation' in payload && 'session' in payload;
};

const isSessionProposal = (
  payload: Extract<Action, { type: 'create_session' }>
): payload is Extract<Action, { type: 'create_session' }> & {
  host: string;
  guest: string;
  suggested_start: string;
  duration_minutes: number;
  notes: string;
} => {
  return 'host' in payload && 'guest' in payload;
};

const ShowcaseProfile = ({ profile }: { profile: SamShowcaseProfile }) => {
  const presenceState = profile.status === 'away' ? 'idle' : 'active';
  return (
    <div className={styles.profileCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <strong>{profile.name}</strong>
          {profile.headline && <p className={styles.profileHeadline}>{profile.headline}</p>}
        </div>
        {typeof profile.rate_per_minute === 'number' && profile.rate_per_minute > 0 && (
          <span className={styles.profileHeadline}>{formatRate(profile.rate_per_minute)}</span>
        )}
      </div>
      {profile.expertise && profile.expertise.length > 0 && (
        <p className={styles.profileHeadline}>Focus: {profile.expertise.join(' • ')}</p>
      )}
      <StatusBadge
        isOnline={profile.status === 'available'}
        hasActiveSession={profile.status === 'booked'}
        presenceState={presenceState}
      />
    </div>
  );
};

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
  onBookTime,
  connectingProfileId,
  directoryProfiles,
  currentUserId
}: ActionRendererProps) {
  if (!action) return null;

  const profileDirectory = useMemo(() => {
    const map = new Map<string, ProfileSummary>();
    (directoryProfiles ?? []).forEach((profile) => {
      if (!profile?.name) {
        return;
      }
      if (currentUserId && profile.userId === currentUserId) {
        return;
      }
      map.set(profile.name.trim().toLowerCase(), profile);
    });
    return map;
  }, [directoryProfiles, currentUserId]);

  switch (action.type || action.actionType) {
    case 'show_profiles': {
      const profiles = (action as Extract<Action, { type: 'show_profiles' }>).profiles ?? [];
      const visibleProfiles = profiles.filter((profile) => {
        if (!currentUserId) {
          return true;
        }
        if (isLegacyProfile(profile)) {
          return profile.userId !== currentUserId;
        }
        return true;
      });
      const legacyProfiles = visibleProfiles.filter(isLegacyProfile) as ProfileSummary[];
      const showcaseProfiles = visibleProfiles.filter((profile) => !isLegacyProfile(profile)) as SamShowcaseProfile[];

      if (legacyProfiles.length > 0) {
        return (
          <div className={styles.profileScroller}>
            {legacyProfiles.map((profile) => (
              <ProfileCard
                key={profile.userId}
                profile={profile}
                onConnectNow={onConnectNow}
                onBookTime={onBookTime}
                isConnecting={connectingProfileId === profile.userId}
              />
            ))}
          </div>
        );
      }

      return (
        <div className={styles.profileScroller}>
          {showcaseProfiles.map((profile, index) => {
            const normalizedName = profile.name?.trim().toLowerCase() ?? '';
            const hydrated = normalizedName ? profileDirectory.get(normalizedName) : undefined;
            if (hydrated) {
              return (
                <ProfileCard
                  key={hydrated.userId ?? `${normalizedName}-${index}`}
                  profile={hydrated}
                  onConnectNow={onConnectNow}
                  onBookTime={onBookTime}
                  isConnecting={connectingProfileId === hydrated.userId}
                />
              );
            }
            return <ShowcaseProfile key={`${profile.name}-${index}`} profile={profile} />;
          })}
        </div>
      );
    }
    case 'offer_connection':
      return <OfferConnection action={action as Extract<Action, { type: 'offer_connection' }>} onOpenConversation={onOpenConversation} />;
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

      if (isLegacySessionPayload(payload)) {
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

      if (isSessionProposal(payload)) {
        return (
          <div className={styles.confirmationCard}>
            <strong>Session proposed</strong>
            <p>
              {payload.host} ↔ {payload.guest}
            </p>
            <p>Start: {payload.suggested_start}</p>
            <p>Duration: {payload.duration_minutes} min</p>
            <p>{payload.notes}</p>
          </div>
        );
      }

      return null;
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
    case 'offer_call': {
      const offer = action as Extract<Action, { type: 'offer_call' }>;
      return (
        <div className={styles.noticeBanner}>
          <strong>{offer.participant} is ready for a call.</strong>
          <p>{offer.availability_window}</p>
          <p>{offer.purpose}</p>
        </div>
      );
    }
    case 'follow_up_prompt': {
      const followUp = action as Extract<Action, { type: 'follow_up_prompt' }>;
      return (
        <div className={styles.noticeBanner}>
          <strong>Try asking Sam:</strong>
          <p>{followUp.prompt}</p>
        </div>
      );
    }
    default:
      return action.label ? <div className={styles.noticeBanner}>{action.label}</div> : null;
  }
}
