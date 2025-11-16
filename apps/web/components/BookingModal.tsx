'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Conversation, ProfileSummary } from '../../../src/lib/db';
import { sendSamMessage } from '../utils/samAPI';
import { getUserTimezone } from '../utils/timezone';
import { createPendingSession, fetchAvailableSlots, type CalendarSlot } from '../services/bookingService';
import { sessionStatusManager } from '../services/sessionStatusManager';
import CalendarSlotPicker from './CalendarSlotPicker';
import BookingConfirmation from './BookingConfirmation';
import styles from './BookingModal.module.css';
import { scheduleCallReminder } from '../utils/notifications';

interface BookingModalProps {
  open: boolean;
  profile: ProfileSummary | null;
  conversation: Conversation | null;
  onClose: () => void;
}

type BookingStep = 'select' | 'confirm' | 'success';

const DEFAULT_RATES: Record<number, number> = {
  15: 45,
  30: 85,
  60: 150
};

const getAvatar = (profile?: ProfileSummary | null) => {
  if (profile?.avatarUrl) return profile.avatarUrl;
  if (profile?.name) {
    return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile.name)}`;
  }
  return 'https://api.dicebear.com/8.x/initials/svg?seed=Human';
};

export default function BookingModal({ open, profile, conversation, onClose }: BookingModalProps) {
  const timezone = useMemo(() => getUserTimezone(), []);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ slot: CalendarSlot; duration: number; price: number } | null>(null);
  const [step, setStep] = useState<BookingStep>('select');
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setSelection(null);
    setSubmitError(null);
    setSlots([]);
    setSlotsError(null);
    setStep('select');
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);

    fetchAvailableSlots()
      .then((loaded) => {
        if (!cancelled) {
          setSlots(loaded);
        }
      })
      .catch((error) => {
        console.warn('Booking slot fetch failed', error);
        if (!cancelled) {
          setSlotsError(error instanceof Error ? error.message : 'Unable to load slots');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, profile?.userId, resetState]);

  useEffect(() => {
    if (step !== 'success') return;
    const timer = setTimeout(() => {
      onClose();
    }, 2400);
    return () => clearTimeout(timer);
  }, [step, onClose]);

  const getPriceForDuration = useCallback(
    (duration: number) => {
      const scheduledRate = profile?.scheduledRates?.find((rate) => rate.durationMinutes === duration);
      if (scheduledRate) return scheduledRate.price;
      if (profile?.instantRatePerMinute) {
        return profile.instantRatePerMinute * duration;
      }
      return DEFAULT_RATES[duration] ?? duration * 3;
    },
    [profile]
  );

  const handleSlotSelect = (slot: CalendarSlot, duration: number, price: number) => {
    setSelection({ slot, duration, price });
    setStep('confirm');
    setSubmitError(null);
  };

  const handleBack = () => {
    setStep('select');
    setSubmitError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleConfirm = async () => {
    if (!selection || !profile || !conversation) {
      setSubmitError('Missing booking details. Please try again.');
      return;
    }

    const guestUserId = sessionStatusManager.getCurrentUserId();
    if (!guestUserId) {
      setSubmitError('We need your account info before booking. Please sign in again.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await createPendingSession({
        hostUserId: profile.userId,
        guestUserId,
        conversationId: conversation.conversationId,
        startTime: selection.slot.start,
        durationMinutes: selection.duration,
        price: selection.price
      });

      await sendSamMessage({
        conversationId: conversation.conversationId,
        message: `Book ${selection.duration}-minute session with ${profile.name} on ${selection.slot.start}.`,
        conversationHistory: [],
        userContext: {
          timezone,
          booking: {
            start: selection.slot.start,
            end: selection.slot.end,
            duration_minutes: selection.duration,
            price: selection.price,
            expert: profile.name
          }
        }
      }).catch((error) => {
        console.warn('Sam booking notification failed', error);
      });

      await scheduleCallReminder(new Date(selection.slot.start).getTime(), profile.name ?? 'your host');
      setStep('success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to confirm booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !profile) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalInner}>
          <div className={styles.header}>
            <img src={getAvatar(profile)} alt={profile.name} className={styles.avatar} />
            <div className={styles.titleStack}>
              <div className={styles.title}>{profile.name}</div>
              <div className={styles.subtitle}>Book a session</div>
            </div>
            <button type="button" className={styles.closeButton} onClick={handleClose}>
              ×
            </button>
          </div>

          {step === 'select' && (
            <CalendarSlotPicker
              slots={slots}
              timezone={timezone}
              getPriceForDuration={getPriceForDuration}
              onSelect={handleSlotSelect}
              loading={loadingSlots}
              error={slotsError}
            />
          )}

          {step === 'confirm' && selection && (
            <BookingConfirmation
              profile={profile}
              slot={selection.slot}
              durationMinutes={selection.duration}
              price={selection.price}
              timezone={timezone}
              isSubmitting={isSubmitting}
              error={submitError}
              onBack={handleBack}
              onConfirm={handleConfirm}
            />
          )}

          {step === 'success' && (
            <div className={styles.successState}>
              <div className={styles.successMessage}>Booked! You'll get a reminder 5 min before.</div>
              <p>Sam logged the session and will keep both sides updated.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
