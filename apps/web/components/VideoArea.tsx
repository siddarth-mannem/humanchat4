'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaymentMode, Session } from '../../../src/lib/db';
import { db } from '../../../src/lib/db';
import { VideoCall, type VideoCallState } from '../services/videoCall';
import { sessionStatusManager } from '../services/sessionStatusManager';
import { processSessionPayment } from '../services/sessionApi';
import SessionControls from './SessionControls';
import SessionTimer from './SessionTimer';
import BillingDisplay, { computeInstantTotal } from './BillingDisplay';
import styles from './ConversationView.module.css';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { notifyPaymentComplete } from '../utils/notifications';

export interface CallEndSummary {
  durationSeconds: number;
  totalAmount: number;
  currency: string;
  paymentIntentId?: string;
  paymentMode: PaymentMode;
  donationAllowed?: boolean;
  charityName?: string;
  sessionId: string;
  confidentialRate?: boolean;
  representativeName?: string | null;
}

interface VideoAreaProps {
  session: Session;
  currentUserId: string;
  onCallEnd: (summary: CallEndSummary) => void;
}

export default function VideoArea({ session, currentUserId, onCallEnd }: VideoAreaProps) {
  const callRef = useRef<VideoCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callState, setCallState] = useState<VideoCallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setMuted] = useState(false);
  const [isVideoOff, setVideoOff] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - (session.startTime ?? Date.now())) / 1000)));
  const startTimestamp = useRef<number>(session.startTime ?? Date.now());
  const markedStartRef = useRef(false);
  const endingRef = useRef(false);
  const isConfidential = Boolean(session.confidentialRate);
  const { isMobile } = useBreakpoint();
  const [isPiP, setPiP] = useState(false);

  const isInitiator = useMemo(() => session.hostUserId === currentUserId, [session.hostUserId, currentUserId]);

  const ensureCall = useCallback(() => {
    if (!callRef.current) {
      callRef.current = new VideoCall({
        sessionId: session.sessionId,
        userId: currentUserId,
        isInitiator
      });
    }
    return callRef.current;
  }, [session.sessionId, currentUserId, isInitiator]);

  const attachStream = useCallback((element: HTMLVideoElement | null, stream: MediaStream | null, mute = false) => {
    if (!element) return;
    element.srcObject = stream;
    element.muted = mute;
    if (stream) {
      void element.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const instance = ensureCall();
    const detachState = instance.on('state', (state) => {
      setCallState(state);
      if (state === 'connected' && !markedStartRef.current) {
        markedStartRef.current = true;
        startTimestamp.current = Date.now();
        sessionStatusManager
          .startSession(session.sessionId, currentUserId)
          .then(async () => {
            await db.sessions.put({ ...session, status: 'in_progress', startTime: startTimestamp.current });
          })
          .catch((err) => setError(err instanceof Error ? err.message : 'Unable to update session status'));
      }
    });
    const detachLocal = instance.on('localStream', (stream) => attachStream(localVideoRef.current, stream, true));
    const detachRemote = instance.on('remoteStream', (stream) => attachStream(remoteVideoRef.current, stream, false));
    const detachError = instance.on('error', (message) => setError(message));

    instance
      .start()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to start call');
      });

    return () => {
      detachState();
      detachLocal();
      detachRemote();
      detachError();
      instance.endCall();
      callRef.current = null;
    };
  }, [ensureCall, attachStream, session.sessionId, currentUserId, session]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (callState === 'connected') {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimestamp.current) / 1000)));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callState]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    if (!video) return;
    const handleEnter = () => setPiP(true);
    const handleLeave = () => setPiP(false);
    video.addEventListener('enterpictureinpicture', handleEnter);
    video.addEventListener('leavepictureinpicture', handleLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnter);
      video.removeEventListener('leavepictureinpicture', handleLeave);
    };
  }, []);

  useEffect(() => {
    if (!isMobile || callState !== 'connected') return;
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
      unlock?: () => void;
    };
    if (!orientation?.lock) return;
    orientation.lock('landscape').catch(() => undefined);
    return () => {
      orientation.unlock?.();
    };
  }, [callState, isMobile]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && callState === 'connected' && !isPiP) {
        void handleTogglePiP();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [callState, isPiP]);

  const handleToggleMute = () => {
    const enabled = callRef.current?.toggleMute();
    if (typeof enabled === 'boolean') {
      setMuted(!enabled);
    }
  };

  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const handleShareInvite = async () => {
    const peerId = session.hostUserId === currentUserId ? session.guestUserId : session.hostUserId;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/chat?session=${session.sessionId}` : '';
    const shareData = {
      title: 'Join my HumanChat session',
      text: `Join me${peerId ? ` and ${peerId}` : ''} on HumanChat right now`,
      url
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url ?? url);
      }
    } catch (err) {
      console.warn('Share failed', err);
    }
  };

  const handleTogglePiP = async () => {
    if (!document.pictureInPictureEnabled || !remoteVideoRef.current) return;
    try {
      if (isPiP) {
        await document.exitPictureInPicture();
      } else {
        await remoteVideoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP toggle failed', err);
    }
  };

  const handleToggleVideo = () => {
    const enabled = callRef.current?.toggleVideo();
    if (typeof enabled === 'boolean') {
      setVideoOff(!enabled);
    }
  };

  const calculateTotal = () => {
    if (isConfidential) {
      return 0;
    }
    if (session.paymentMode === 'free') {
      return 0;
    }
    if (session.type === 'scheduled') {
      return session.agreedPrice;
    }
    return computeInstantTotal(session, elapsedSeconds);
  };

  const handleEndCall = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    callRef.current?.endCall();
    setCallState('ended');
    try {
      await sessionStatusManager.endSession(session.sessionId, currentUserId);
      await db.sessions.put({
        ...session,
        status: 'complete',
        endTime: Date.now(),
        durationMinutes: Math.max(1, Math.ceil(elapsedSeconds / 60))
      });
    } catch (err) {
      console.warn('Failed to update session end locally', err);
    }

    const total = calculateTotal();
    const donationAllowed = !isConfidential && Boolean(session.donationAllowed ?? (session.donationPreference === 'on'));
    const sessionMode: PaymentMode = session.paymentMode ?? 'paid';
    const stripeMode: 'instant' | 'scheduled' | 'charity' = sessionMode === 'charity' ? 'charity' : session.type === 'scheduled' ? 'scheduled' : 'instant';
    const requiresPayment = !isConfidential && (sessionMode === 'paid' || sessionMode === 'charity');

    if (!requiresPayment) {
      onCallEnd({
        durationSeconds: elapsedSeconds,
        totalAmount: total,
        currency: 'usd',
        paymentMode: sessionMode,
        donationAllowed,
        charityName: session.charityName,
        sessionId: session.sessionId,
        confidentialRate: isConfidential,
        representativeName: session.representativeName ?? null
      });
      return;
    }

    try {
      const payment = await processSessionPayment(total, session.sessionId, {
        mode: stripeMode,
        captureMethod: session.type === 'scheduled' ? 'automatic' : 'manual',
        finalAmount: total
      });
      const summary = {
        durationSeconds: elapsedSeconds,
        totalAmount: payment.amount,
        currency: payment.currency,
        paymentIntentId: payment.paymentIntentId,
        paymentMode: sessionMode,
        donationAllowed,
        charityName: session.charityName,
        sessionId: session.sessionId,
        confidentialRate: isConfidential,
        representativeName: session.representativeName ?? null
      } as const;
      await notifyPaymentComplete(payment.amount, payment.currency);
      onCallEnd(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      onCallEnd({
        durationSeconds: elapsedSeconds,
        totalAmount: total,
        currency: 'usd',
        paymentMode: sessionMode,
        donationAllowed,
        charityName: session.charityName,
        sessionId: session.sessionId,
        confidentialRate: isConfidential,
        representativeName: session.representativeName ?? null
      });
    }
  };

  return (
    <div className={styles.videoAreaWrapper}>
      <div className={styles.videoStatsRow}>
        <BillingDisplay session={session} elapsedSeconds={elapsedSeconds} />
        <SessionTimer elapsedSeconds={elapsedSeconds} />
      </div>
      <div className={styles.videoStage}>
        <video ref={remoteVideoRef} playsInline autoPlay className={styles.remoteVideo} />
        <video ref={localVideoRef} playsInline autoPlay muted className={styles.localPreview} />
        {(callState !== 'connected' || error) && <div className={styles.videoOverlay}>{error ?? 'Connecting…'}</div>}
        <div className={styles.controlsOverlay}>
          <SessionControls
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onToggleMute={handleToggleMute}
            onToggleVideo={handleToggleVideo}
            onEndCall={handleEndCall}
            onShareInvite={handleShareInvite}
            onTogglePiP={handleTogglePiP}
            canShare={canShare}
            disabled={callState === 'connecting' || callState === 'failed'}
          />
        </div>
      </div>
    </div>
  );
}
