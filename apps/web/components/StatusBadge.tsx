'use client';

import clsx from 'clsx';
import styles from './ProfileCard.module.css';

interface StatusBadgeProps {
  isOnline?: boolean;
  hasActiveSession?: boolean;
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
  offline: {
    label: 'Offline',
    color: styles.statusOffline,
    icon: '⚪'
  }
};

export default function StatusBadge({ isOnline, hasActiveSession }: StatusBadgeProps) {
  const variant = isOnline ? (hasActiveSession ? 'inCall' : 'online') : 'offline';
  const config = STATUS_CONFIG[variant];

  return (
    <span className={clsx(styles.statusBadge, config.color)}>
      <span aria-hidden>{config.icon}</span> {config.label}
    </span>
  );
}
