'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { ProfileSummary } from '../../../src/lib/db';
import styles from './ProfileCard.module.css';
import StatusBadge from './StatusBadge';
import RateDisplay from './RateDisplay';
import { useSessionStatus, type PrefetchedSessionStatus } from '../hooks/useSessionStatus';

const HUMAN_FALLBACK = 'Human';

const ensureHumanCopy = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : HUMAN_FALLBACK;
};

const hasCustomCopy = (value?: string | null): boolean => {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed.length > 0);
};

interface ProfileCardProps {
  profile: ProfileSummary;
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  isConnecting?: boolean;
  disableLiveStatus?: boolean;
  prefetchedStatus?: PrefetchedSessionStatus | null;
}

export default function ProfileCard({
  profile,
  onConnectNow,
  onBookTime,
  isConnecting,
  disableLiveStatus,
  prefetchedStatus
}: ProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    isOnline: liveOnline,
    hasActiveSession: liveActiveSession,
    presenceState: livePresence,
    isLoading: statusLoading
  } = useSessionStatus(profile.userId, {
    disabled: disableLiveStatus,
    prefetchedStatus
  });

  const allowLiveStatus = Boolean(profile.userId) && !disableLiveStatus;
  const hasLiveStatus = allowLiveStatus && !statusLoading;
  const fallbackPresence = profile.presenceState ?? (profile.isOnline ? 'active' : 'offline');
  const isOnline = hasLiveStatus ? liveOnline : Boolean(profile.isOnline);
  const hasActiveSession = hasLiveStatus ? liveActiveSession : Boolean(profile.hasActiveSession);
  const presenceState = hasLiveStatus ? livePresence : fallbackPresence;

  const managedConfidential = Boolean(profile.managed && profile.confidentialRate);
  const canInstantConnect = Boolean(isOnline && !hasActiveSession && !managedConfidential);
  const tooltip = (() => {
    if (managedConfidential) {
      return 'This profile handles chats via private requests. Use Schedule.';
    }
    if (hasActiveSession) {
      return 'Currently in a call';
    }
    if (!isOnline) {
      return 'Offline right now';
    }
    return undefined;
  })();
  const headlineCopy = ensureHumanCopy(profile.headline);
  const bioCopy = ensureHumanCopy(profile.bio);
  const hasCustomBio = hasCustomCopy(profile.bio);
  const contributionBlurb = useMemo(() => {
    if (managedConfidential) {
      return `${profile.name ?? 'This talent'} keeps these chats private. Send a request and their team will coordinate the details.`;
    }
    if (profile.conversationType === 'charity' && profile.instantRatePerMinute) {
      return `${profile.name} charges $${profile.instantRatePerMinute.toFixed(2)}/min — all proceeds go to ${profile.charityName ?? 'their charity partner'}.`;
    }
    if (profile.conversationType === 'free' && profile.donationPreference === 'on') {
      return `${profile.name} talks for free and accepts tips.`;
    }
    if (profile.conversationType === 'paid' && profile.donationPreference === 'on') {
      return `${profile.name} offers paid sessions with optional donations.`;
    }
    return null;
  }, [managedConfidential, profile.conversationType, profile.donationPreference, profile.instantRatePerMinute, profile.name, profile.charityName]);

  const secondaryLabel = managedConfidential ? 'Send Request' : 'Schedule';
  const secondaryClass = managedConfidential ? styles.requestButton : styles.secondaryButton;

  return (
    <article className={styles.card}>
      <div className={styles.headerRow}>
        <img
          src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name ?? 'Human')}&background=4f46e5&color=fff&size=128`}
          alt={profile.name}
          className={styles.avatar}
          loading="lazy"
        />
        <div className={styles.nameBlock}>
          <strong className={styles.name}>{profile.name}</strong>
          <p className={styles.headline}>{headlineCopy}</p>
        </div>
      </div>

      <StatusBadge
        isOnline={isOnline}
        hasActiveSession={hasActiveSession}
        presenceState={presenceState}
      />

      {bioCopy && (
        <div className={clsx(styles.bio, !expanded && styles.bioCollapsed)}>
          {bioCopy}
          {!expanded && hasCustomBio && (
            <button className={styles.readMore} type="button" onClick={() => setExpanded(true)}>
              Read more
            </button>
          )}
        </div>
      )}

      <RateDisplay
        conversationType={profile.conversationType}
        confidentialRate={profile.confidentialRate}
        displayMode={profile.displayMode}
        instantRatePerMinute={profile.instantRatePerMinute}
        scheduledRates={profile.scheduledRates}
        isOnline={isOnline}
        charityName={profile.charityName}
        donationPreference={profile.donationPreference}
      />

      {contributionBlurb && <p className={styles.sessionBlurb}>{contributionBlurb}</p>}

      <div className={styles.actions}>
        {!managedConfidential && (
          <div className={styles.tooltip}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!canInstantConnect || Boolean(isConnecting)}
              onClick={() => canInstantConnect && !isConnecting && onConnectNow?.(profile)}
            >
              {isConnecting ? 'Connecting…' : 'Connect Now'}
            </button>
            {tooltip && <span className={styles.tooltipText}>{tooltip}</span>}
          </div>
        )}
        <button className={secondaryClass} type="button" onClick={() => onBookTime?.(profile)}>
          {secondaryLabel}
        </button>
      </div>
    </article>
  );
}
