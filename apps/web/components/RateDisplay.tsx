'use client';

import clsx from 'clsx';
import styles from './ProfileCard.module.css';
import type { ScheduledRate } from '../../../src/lib/db';

interface RateDisplayProps {
  conversationType?: 'free' | 'paid' | 'charity';
  confidentialRate?: boolean;
  instantRatePerMinute?: number;
  scheduledRates?: ScheduledRate[];
  isOnline?: boolean;
  charityName?: string;
}

const formatCurrency = (value?: number) => {
  if (value == null) return '';
  return `$${value.toFixed(2)}`;
};

export default function RateDisplay({
  conversationType,
  confidentialRate,
  instantRatePerMinute,
  scheduledRates,
  isOnline,
  charityName
}: RateDisplayProps) {
  return (
    <div className={styles.rateSection}>
      <div className={styles.rateBadges}>
        {conversationType === 'free' && <span className={clsx(styles.badge, styles.freeBadge)}>Free</span>}
        {conversationType === 'charity' && (
          <span className={clsx(styles.badge, styles.charityBadge)}>💚 Proceeds go to {charityName ?? 'charity'}</span>
        )}
        {confidentialRate && <span className={clsx(styles.badge, styles.confidentialBadge)}>By Request</span>}
        {conversationType === 'paid' && !confidentialRate && isOnline && instantRatePerMinute != null && (
          <span className={clsx(styles.badge, styles.paidBadge)}>{formatCurrency(instantRatePerMinute)}/min</span>
        )}
      </div>
      {scheduledRates && scheduledRates.length > 0 && (
        <div className={styles.scheduledPills}>
          {scheduledRates.map((rate) => (
            <span key={`${rate.durationMinutes}-${rate.price}`} className={styles.scheduledPill}>
              {rate.durationMinutes} min • {formatCurrency(rate.price)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
