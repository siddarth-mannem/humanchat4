'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { VideoCall, type VideoCallState } from '../services/videoCall';
import styles from './ConversationView.module.css';

interface VideoCallPanelProps {
  sessionId: string;
  userId: string;
  isInitiator: boolean;
  participantLabel?: string;
  autoStart?: boolean;
}

const STATUS_COPY: Record<VideoCallState, string> = {
  idle: 'Ready to connect',
  permission: 'Grant access to camera and mic…',
  connecting: 'Connecting…',
  connected: 'You are connected',
  failed: 'Connection failed. Retrying…',
  disconnected: 'Call disconnected',
  ended: 'Call ended'
};

const qualityLabel = (connectionState?: RTCPeerConnectionState) => {
  switch (connectionState) {
    case 'connected':
      return 'Stable';
    case 'connecting':
      return 'Negotiating';
    case 'disconnected':
      return 'Reconnecting';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
};

export default function VideoCallPanel({ sessionId, userId, isInitiator, participantLabel, autoStart = true }: VideoCallPanelProps) {
  const callRef = useRef<VideoCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callState, setCallState] = useState<VideoCallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | undefined>();
  const [isMuted, setMuted] = useState(false);
  const [isVideoOff, setVideoOff] = useState(false);

  const ensureCallInstance = useCallback(() => {
    if (!callRef.current) {
      callRef.current = new VideoCall({ sessionId, userId, isInitiator });
    }
    return callRef.current;
  }, [sessionId, userId, isInitiator]);

  const attachStream = useCallback((element: HTMLVideoElement | null, stream: MediaStream | null, mute = false) => {
    if (!element) return;
    if (!stream) {
      element.srcObject = null;
      return;
    }
    console.log('[VideoCallPanel] Attaching stream to element:', {
      sessionId,
      userId,
      muted: mute,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioEnabled: stream.getAudioTracks()[0]?.enabled,
      audioMuted: stream.getAudioTracks()[0]?.muted
    });
    element.srcObject = stream;
    element.muted = mute;
    // Ensure remote streams have volume enabled
    if (!mute) {
      element.volume = 1.0;
      console.log('[VideoCallPanel] Remote stream volume set to 1.0');
    }
    // Explicitly play the video element
    element.play().catch((error) => {
      console.error('[VideoCallPanel] Failed to play video element:', error);
      // Retry play after a short delay
      setTimeout(() => {
        element.play().catch((retryError) => {
          console.error('[VideoCallPanel] Retry play failed:', retryError);
        });
      }, 500);
    });
  }, [sessionId, userId]);

  const startCall = useCallback(async () => {
    try {
      const instance = ensureCallInstance();
      setError(null);
      await instance.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start call';
      setError(message);
    }
  }, [ensureCallInstance]);

  useEffect(() => {
    const instance = ensureCallInstance();
    const detachState = instance.on('state', (state) => {
      setCallState(state);
      if (state === 'failed') {
        setError('Connection failed. We will retry automatically.');
      }
    });
    const detachLocal = instance.on('localStream', (stream) => attachStream(localVideoRef.current, stream, true));
    const detachRemote = instance.on('remoteStream', (stream) => attachStream(remoteVideoRef.current, stream, false));
    const detachError = instance.on('error', (message) => setError(message));
    const detachMetric = instance.on('metric', (metric) => {
      setAudioLevel(metric.audioLevel);
      if (metric.connectionState) {
        setConnectionState(metric.connectionState);
      }
    });

    if (autoStart) {
      startCall().catch(() => undefined);
    }

    return () => {
      detachState();
      detachLocal();
      detachRemote();
      detachError();
      detachMetric();
      instance.endCall();
      callRef.current = null;
    };
  }, [ensureCallInstance, attachStream, autoStart, startCall]);

  const overlayCopy = STATUS_COPY[callState];

  const handleToggleMute = () => {
    const enabled = callRef.current?.toggleMute();
    if (typeof enabled === 'boolean') {
      setMuted(!enabled);
    }
  };

  const handleToggleVideo = () => {
    const enabled = callRef.current?.toggleVideo();
    if (typeof enabled === 'boolean') {
      setVideoOff(!enabled);
    }
  };

  const handleEnd = () => {
    callRef.current?.endCall();
    setCallState('ended');
  };

  const meterStyle = useMemo(() => ({ width: `${Math.min(100, Math.round(audioLevel * 100))}%` }), [audioLevel]);

  return (
    <div className={styles.videoPanel}>
      <div className={styles.videoStatusBar}>
        <div>
          <strong>{participantLabel ?? 'Session call'}</strong>
          <p className={styles.videoStatusCopy}>{overlayCopy}</p>
        </div>
        <span className={clsx(styles.statusBadge, callState === 'connected' && styles.statusBadgeSuccess)}>
          {qualityLabel(connectionState)}
        </span>
      </div>
      <div className={styles.videoStage}>
        <video ref={remoteVideoRef} playsInline autoPlay className={styles.remoteVideo} />
        <video ref={localVideoRef} playsInline autoPlay muted className={styles.localPreview} />
        {callState !== 'connected' && callState !== 'disconnected' && callState !== 'ended' && (
          <div className={styles.videoOverlay}>{overlayCopy}</div>
        )}
      </div>
      <div className={styles.audioMeter}>
        <div className={styles.audioMeterLevel} style={meterStyle} />
      </div>
      <div className={styles.controlsRow}>
        <button type="button" className={clsx(styles.controlButton, isMuted && styles.controlButtonMuted)} onClick={handleToggleMute}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button type="button" className={clsx(styles.controlButton, isVideoOff && styles.controlButtonMuted)} onClick={handleToggleVideo}>
          {isVideoOff ? 'Start Video' : 'Stop Video'}
        </button>
        <button type="button" className={clsx(styles.controlButton, styles.controlButtonDanger)} onClick={handleEnd}>
          End Call
        </button>
        {callState === 'idle' && (
          <button type="button" className={styles.controlButton} onClick={startCall}>
            Join Call
          </button>
        )}
      </div>
      {error && <div className={styles.errorState}>{error}</div>}
    </div>
  );
}
