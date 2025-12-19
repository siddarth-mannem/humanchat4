'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Conversation, ProfileSummary } from '../../../src/lib/db';
import { sendSamMessage } from '../utils/samAPI';
import { getUserTimezone } from '../utils/timezone';
import {
  getExpertAvailability,
  getExpertBlockedDates,
  getExpertWeeklyAvailability,
  createBooking,
  type TimeSlot
} from '../services/bookingApi';
import { sessionStatusManager } from '../services/sessionStatusManager';
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

interface CalendarSlot {
  id: string;
  start: string;
  end: string;
  status: 'open' | 'blocked';
}

export default function BookingModal({ open, profile, conversation, onClose }: BookingModalProps) {
  const router = useRouter();
  const timezone = useMemo(() => getUserTimezone(), []);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDurations, setSelectedDurations] = useState<Map<string, number>>(new Map());
  const [selection, setSelection] = useState<{ slot: TimeSlot; duration: number; price: number } | null>(null);
  const [step, setStep] = useState<BookingStep>('select');
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [allowedWeekdays, setAllowedWeekdays] = useState<number[] | null>(null);

  const normalizeDate = useCallback((value: string) => {
    if (!value) {
      return '';
    }
    return new Date(`${value}T12:00:00Z`).toISOString().split('T')[0];
  }, []);

  const isWeekdayAllowed = useCallback(
    (dateStr: string) => {
      if (!dateStr) {
        return true;
      }
      if (allowedWeekdays === null) {
        return true;
      }
      const date = new Date(`${dateStr}T12:00:00Z`);
      const weekday = date.getUTCDay();
      return allowedWeekdays.includes(weekday);
    },
    [allowedWeekdays]
  );

  const findNextAllowedDate = useCallback(
    (dateStr: string, lookaheadDays = 120, includeCurrent = false) => {
      if (!dateStr) {
        return dateStr;
      }
      const base = new Date(`${dateStr}T12:00:00Z`);
      for (let offset = includeCurrent ? 0 : 1; offset <= lookaheadDays; offset += 1) {
        const candidate = new Date(base);
        candidate.setUTCDate(candidate.getUTCDate() + offset);
        const iso = candidate.toISOString().split('T')[0];
        if (blockedDates.has(iso)) {
          continue;
        }
        if (isWeekdayAllowed(iso)) {
          return iso;
        }
      }
      return dateStr;
    },
    [blockedDates, isWeekdayAllowed]
  );

  const resetState = useCallback(() => {
    setSelection(null);
    setSubmitError(null);
    setSlots([]);
    setSlotsError(null);
    setStep('select');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  // Initialize default date
  useEffect(() => {
    if (open && !selectedDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [open, selectedDate]);

  // Fetch blocked dates when modal opens
  useEffect(() => {
    if (!open || !profile?.userId) return;

    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    getExpertBlockedDates(profile.userId, today, futureDate)
      .then((dates) => {
        setBlockedDates(new Set(dates));
      })
      .catch((error) => {
        console.warn('Failed to fetch blocked dates:', error);
      });

    getExpertWeeklyAvailability(profile.userId)
      .then((rules) => {
        const weekdays = Array.from(new Set(rules.map((rule) => rule.dayOfWeek))).sort();
        setAllowedWeekdays(weekdays);
      })
      .catch((error) => {
        console.warn('Failed to fetch weekly availability:', error);
        setAllowedWeekdays(null);
      });
  }, [open, profile]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }
    if (blockedDates.has(selectedDate) || !isWeekdayAllowed(selectedDate)) {
      const nextDate = findNextAllowedDate(selectedDate, 120, true);
      if (nextDate !== selectedDate) {
        setSlotsError('Selected date is unavailable. Showing the next available day.');
        setSelectedDate(nextDate);
      }
    }
  }, [blockedDates, isWeekdayAllowed, findNextAllowedDate, selectedDate]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    if (!selectedDate || !profile?.userId) return;

    // Check if selected date is blocked
    if (blockedDates.has(selectedDate)) {
      setSlotsError('This date is not available. Please select another date.');
      setSlots([]);
      setLoadingSlots(false);
      return;
    }

    if (!isWeekdayAllowed(selectedDate)) {
      setSlotsError('This expert is unavailable on the selected day.');
      setSlots([]);
      setLoadingSlots(false);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);

    getExpertAvailability(profile.userId, selectedDate, timezone)
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
  }, [open, profile?.userId, selectedDate, timezone, resetState, blockedDates]);

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

  const handleSlotSelect = (slot: TimeSlot, duration: number, price: number) => {
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
      // Calculate end time based on start time and duration
      const startTime = new Date(selection.slot.start);
      const endTime = new Date(startTime.getTime() + selection.duration * 60 * 1000);

      // Create booking using the new booking API
      const booking = await createBooking(profile.userId, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: selection.duration,
        timezone,
        meetingNotes: `Session booked through chat with ${profile.name}`,
        idempotencyKey: `${guestUserId}-${profile.userId}-${startTime.getTime()}`
      });

      // Server will send properly formatted booking notifications to chat

      await scheduleCallReminder(new Date(selection.slot.start).getTime(), profile.name ?? 'your host');

      // Close modal so chat UI resets before redirecting
      onClose();
      router.push(`/bookings/${booking.bookingId}/confirmation`);
      return;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to confirm booking');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDurationMinutes = (start: string, end: string): number => {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  };

  const handleDateChange = (value: string) => {
    if (!value) {
      return;
    }
    const normalized = normalizeDate(value);
    if (blockedDates.has(normalized)) {
      const nextDate = findNextAllowedDate(normalized, 120, false);
      setSlotsError('That date is blocked. Showing the next available day.');
      setSelectedDate(nextDate);
      return;
    }
    if (!isWeekdayAllowed(normalized)) {
      const nextDate = findNextAllowedDate(normalized, 120, false);
      setSlotsError('This expert is unavailable on that day. Showing the next available option.');
      setSelectedDate(nextDate);
      return;
    }
    setSlotsError(null);
    setSelectedDate(normalized);
  };

  if (!open || !profile) {
    return null;
  }

  const openSlots = slots.filter((slot) => slot.start && slot.end);

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
            <div className={styles.selectStep}>
              {/* Date Selector */}
              <div className={styles.dateSelector}>
                <label htmlFor="booking-date" className={styles.dateLabel}>
                  Select Date
                </label>
                <input
                  id="booking-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={styles.dateInput}
                />
              </div>

              {/* Available Slots */}
              {loadingSlots && <div className={styles.loadingState}>Loading available times…</div>}
              
              {slotsError && <div className={styles.errorState}>{slotsError}</div>}
              
              {!loadingSlots && !slotsError && openSlots.length === 0 && (
                <div className={styles.emptyState}>No open slots for this date. Try another day.</div>
              )}

              {!loadingSlots && !slotsError && openSlots.length > 0 && (
                <div className={styles.slotGrid}>
                  {openSlots.map((slot) => {
                    const slotDuration = getDurationMinutes(slot.start, slot.end);
                    const availableDurations = [15, 30, 60].filter((d) => d <= slotDuration);
                    const selectedDuration = selectedDurations.get(slot.start) || availableDurations[0] || slotDuration;
                    const price = getPriceForDuration(selectedDuration);

                    return (
                      <div key={slot.start} className={styles.slotCard}>
                        <div className={styles.slotDate}>{formatDate(slot.start)}</div>
                        <div className={styles.slotTime}>
                          {formatTime(slot.start)} - {formatTime(slot.end)}
                        </div>
                        <div className={styles.durationRow}>
                          {availableDurations.map((duration) => (
                            <button
                              key={duration}
                              type="button"
                              className={`${styles.durationBadge} ${selectedDuration === duration ? styles.durationBadgeSelected : ''}`}
                              onClick={() => {
                                const newMap = new Map(selectedDurations);
                                newMap.set(slot.start, duration);
                                setSelectedDurations(newMap);
                              }}
                            >
                              {duration} min · ${getPriceForDuration(duration).toFixed(0)}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={styles.selectButton}
                          onClick={() => handleSlotSelect(slot, selectedDuration, price)}
                        >
                          Select {selectedDuration} min
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
