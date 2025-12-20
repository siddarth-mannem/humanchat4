'use client';

import { useMemo, useState } from 'react';
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

const SOCIAL_LINK_FIELDS = [
  { key: 'linkedinUrl', label: 'LinkedIn' },
  { key: 'facebookUrl', label: 'Facebook' },
  { key: 'instagramUrl', label: 'Instagram' },
  { key: 'quoraUrl', label: 'Quora' },
  { key: 'mediumUrl', label: 'Medium' },
  { key: 'youtubeUrl', label: 'YouTube' },
  { key: 'otherSocialUrl', label: 'Website' }
] as const;

type SocialLinkKey = (typeof SOCIAL_LINK_FIELDS)[number]['key'];

interface SocialLinkEntry {
  key: SocialLinkKey;
  label: string;
  url: string;
  display: string;
}

const deriveDisplayUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return value;
  }
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
  const [showDetails, setShowDetails] = useState(false);
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
  const avatarSrc =
    profile.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name ?? 'Human')}&background=4f46e5&color=fff&size=128`;
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

  const socialLinks = useMemo<SocialLinkEntry[]>(() => {
    return SOCIAL_LINK_FIELDS.reduce<SocialLinkEntry[]>((acc, field) => {
      const value = profile[field.key];
      if (!value) {
        return acc;
      }
      acc.push({
        key: field.key,
        label: field.label,
        url: value,
        display: deriveDisplayUrl(value)
      });
      return acc;
    }, []);
  }, [profile]);

  const renderActions = (containerClass: string) => (
    <div className={containerClass}>
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
  );

  const closeDetails = () => setShowDetails(false);

  return (
    <>
      <article className={styles.card}>
        <div className={styles.headerRow}>
          <img src={avatarSrc} alt={profile.name} className={styles.avatar} loading="lazy" />
          <div className={styles.nameBlock}>
            <strong className={styles.name}>{profile.name}</strong>
            <p className={styles.headline}>{headlineCopy}</p>
          </div>
        </div>

        <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />

        {renderActions(styles.actions)}

        {contributionBlurb && <p className={styles.sessionBlurb}>{contributionBlurb}</p>}

        <button className={styles.tertiaryButton} type="button" onClick={() => setShowDetails(true)}>
          See full profile
        </button>
      </article>

      {showDetails && (
        <div className={styles.fullProfileOverlay} role="dialog" aria-modal="true" onClick={closeDetails}>
          <div className={styles.fullProfilePanel} onClick={(event) => event.stopPropagation()}>
            <button className={styles.closeDetailsButton} type="button" aria-label="Close profile" onClick={closeDetails}>
              ×
            </button>
            <div className={styles.fullProfileHeader}>
              <img src={avatarSrc} alt={profile.name} className={styles.fullProfileAvatar} />
              <div className={styles.fullProfileIdentity}>
                <strong className={styles.fullProfileName}>{profile.name}</strong>
                <p className={styles.fullProfileHeadline}>{headlineCopy}</p>
              </div>
            </div>

            <div className={styles.fullProfileBody}>
              <StatusBadge isOnline={isOnline} hasActiveSession={hasActiveSession} presenceState={presenceState} />
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

              {socialLinks.length > 0 && (
                <div className={styles.socialSection}>
                  <h4>Find them online</h4>
                  <div className={styles.socialLinksGrid}>
                    {socialLinks.map((link) => (
                      <a key={link.key} href={link.url} className={styles.socialLink} rel="noreferrer">
                        <span className={styles.socialLabel}>{link.label}</span>
                        <span className={styles.socialUrl}>{link.display}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {renderActions(styles.overlayActions)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
