'use client';

import clsx from 'clsx';
import styles from './ProfileCard.module.css';

interface StatusBadgeProps {
  isOnline?: boolean;
  hasActiveSession?: boolean;
  presenceState?: 'active' | 'idle' | 'offline';
}

const STATUS_CONFIG = {
  online: {
    label: 'Online',
    color: styles.statusOnline,
    icon: '🟢'
  },
  inCall: {
    label: 'Online • In Call',
    color: styles.statusInCall,
    icon: '🟡'
  },
  idle: {
    label: 'Idle',
    color: styles.statusIdle,
    icon: '🟠'
  },
  offline: {
    label: 'Offline',
    color: styles.statusOffline,
    icon: '⚪'
  }
};

export default function StatusBadge({ isOnline, hasActiveSession, presenceState }: StatusBadgeProps) {
  let variant: keyof typeof STATUS_CONFIG = 'offline';
  if (hasActiveSession) {
    variant = 'inCall';
  } else if (presenceState === 'idle') {
    variant = 'idle';
  } else if (isOnline) {
    variant = 'online';
  }
  const config = STATUS_CONFIG[variant];

  return (
    <span className={clsx(styles.statusBadge, config.color)}>
      <span aria-hidden>{config.icon}</span> {config.label}
    </span>
  );
}
