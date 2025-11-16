'use client';

import clsx from 'clsx';
import styles from './ConversationView.module.css';

interface SessionControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  disabled?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onShareInvite?: () => void;
  onTogglePiP?: () => void;
  canShare?: boolean;
}

const icon = (type: 'mic' | 'cam' | 'end' | 'share' | 'pip', active: boolean) => {
  switch (type) {
    case 'mic':
      return active ? '🎙️' : '🔇';
    case 'cam':
      return active ? '🎥' : '📷✖️';
    case 'end':
    default:
      return '📞✖️';
    case 'share':
      return '📤';
    case 'pip':
      return active ? '🪟' : '🗔';
  }
};

export default function SessionControls({ isMuted, isVideoOff, disabled, onToggleMute, onToggleVideo, onEndCall, onShareInvite, onTogglePiP, canShare }: SessionControlsProps) {
  return (
    <div className={styles.controlsRow}>
      <button type="button" className={clsx(styles.controlButton, isMuted && styles.controlButtonMuted)} onClick={onToggleMute} disabled={disabled}>
        {icon('mic', !isMuted)} {isMuted ? 'Unmute' : 'Mute'}
      </button>
      <button type="button" className={clsx(styles.controlButton, isVideoOff && styles.controlButtonMuted)} onClick={onToggleVideo} disabled={disabled}>
        {icon('cam', !isVideoOff)} {isVideoOff ? 'Camera On' : 'Camera Off'}
      </button>
      {onShareInvite && (
        <button type="button" className={styles.controlButton} onClick={onShareInvite} disabled={disabled || !canShare}>
          {icon('share', true)} Share
        </button>
      )}
      {onTogglePiP && (
        <button type="button" className={styles.controlButton} onClick={onTogglePiP} disabled={disabled}>
          {icon('pip', true)} PiP
        </button>
      )}
      <button type="button" className={clsx(styles.controlButton, styles.controlButtonDanger)} onClick={onEndCall} disabled={disabled}>
        {icon('end', false)} End Call
      </button>
    </div>
  );
}
