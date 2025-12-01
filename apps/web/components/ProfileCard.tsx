'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { ProfileSummary } from '../../../src/lib/db';
import styles from './ProfileCard.module.css';
import StatusBadge from './StatusBadge';
import RateDisplay from './RateDisplay';

interface ProfileCardProps {
  profile: ProfileSummary;
  onConnectNow?: (userId: string) => void;
  onBookTime?: (profile: ProfileSummary) => void;
}

export default function ProfileCard({ profile, onConnectNow, onBookTime }: ProfileCardProps) {
  const [expanded, setExpanded] = useState(false);

  const canConnect = Boolean(profile.isOnline && !profile.hasActiveSession);
  const tooltip = profile.hasActiveSession ? 'Currently in a call' : undefined;
  const managedConfidential = Boolean(profile.managed && profile.confidentialRate);
  const contributionBlurb = useMemo(() => {
    if (managedConfidential) {
      return `${profile.name ?? 'This talent'} works through a representative. Send a request and their team will coordinate the details.`;
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

  const secondaryLabel = managedConfidential ? 'Send Request' : 'Book Time';
  const secondaryClass = managedConfidential ? styles.requestButton : styles.secondaryButton;

  return (
    <article className={styles.card}>
      <div className={styles.headerRow}>
        <img
          src={profile.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile.name ?? 'Human')}`}
          alt={profile.name}
          className={styles.avatar}
          loading="lazy"
        />
        <div className={styles.nameBlock}>
          <strong className={styles.name}>{profile.name}</strong>
          {profile.headline && <p className={styles.headline}>{profile.headline}</p>}
        </div>
      </div>

      <StatusBadge
        isOnline={profile.isOnline}
        hasActiveSession={profile.hasActiveSession}
        presenceState={profile.presenceState}
      />

      {profile.bio && (
        <div className={clsx(styles.bio, !expanded && styles.bioCollapsed)}>
          {profile.bio}
          {!expanded && (
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
        isOnline={profile.isOnline}
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
              disabled={!canConnect}
              onClick={() => canConnect && onConnectNow?.(profile.userId)}
            >
              Connect Now
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
