'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { ProfileSummary } from '../../../src/lib/db';
import styles from './ProfileCard.module.css';
import StatusBadge from './StatusBadge';
import RateDisplay from './RateDisplay';

interface ProfileCardProps {
  profile: ProfileSummary;
  onConnectNow?: (userId: string) => void;
  onBookTime?: (userId: string) => void;
}

export default function ProfileCard({ profile, onConnectNow, onBookTime }: ProfileCardProps) {
  const [expanded, setExpanded] = useState(false);

  const canConnect = Boolean(profile.isOnline && !profile.hasActiveSession);
  const tooltip = profile.hasActiveSession ? 'Currently in a call' : undefined;

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

      <StatusBadge isOnline={profile.isOnline} hasActiveSession={profile.hasActiveSession} />

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
        instantRatePerMinute={profile.instantRatePerMinute}
        scheduledRates={profile.scheduledRates}
        isOnline={profile.isOnline}
        charityName={profile.charityName}
      />

      <div className={styles.actions}>
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
        <button className={styles.secondaryButton} type="button" onClick={() => onBookTime?.(profile.userId)}>
          Book Time
        </button>
      </div>
    </article>
  );
}
