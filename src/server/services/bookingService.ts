/**
 * Booking Service
 * Core business logic for availability calculation, booking creation, and management
 */

import { query, pool } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { getGoogleCalendarBusyTimes, createCalendarEvent, deleteCalendarEvent } from './googleCalendarService.js';
import {
  sendBookingConfirmationToChat,
  sendBookingUpdateNotification,
  sendBookingCancellationNotification
} from './bookingNotificationService.js';
import { createClient } from 'redis';
import { env } from '../config/env.js';

export interface AvailabilityRule {
  id: string;
  expertId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // HH:MM:SS
  endTime: string;
  slotDurationMinutes: number;
  timezone: string;
  active: boolean;
}

export interface AvailabilityOverride {
  id: string;
  expertId: string;
  overrideDate: string; // YYYY-MM-DD
  overrideType: 'available' | 'blocked';
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  reason: string | null;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  isAvailable: boolean;
}

export interface Booking {
  id: string;
  expertId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  timezone: string;
  status: string;
  meetingTitle: string | null;
  meetingNotes: string | null;
  meetingLink: string | null;
  calendarEventId: string | null;
  price: number | null;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingWithDetails extends Booking {
  expertName: string;
  expertAvatar: string | null;
  expertHeadline: string | null;
  userName: string;
  userAvatar: string | null;
  userEmail: string;
}

export interface CreateBookingInput {
  expertId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  timezone: string;
  meetingNotes?: string;
  idempotencyKey?: string;
}

/**
 * Get expert's availability rules
 */
export const getExpertAvailabilityRules = async (
  expertId: string
): Promise<AvailabilityRule[]> => {
  const result = await query(
    `SELECT * FROM expert_availability_rules
     WHERE expert_id = $1 AND active = TRUE
     ORDER BY day_of_week, start_time`,
    [expertId]
  );

  // Transform snake_case to camelCase
  return result.rows.map((row) => ({
    id: row.id,
    expertId: row.expert_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    slotDurationMinutes: row.slot_duration_minutes,
    timezone: row.timezone,
    active: row.active
  }));
};

/**
 * Get expert's availability overrides for a date range
 */
export const getExpertAvailabilityOverrides = async (
  expertId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityOverride[]> => {
  const result = await query(
    `SELECT * FROM expert_availability_overrides
     WHERE expert_id = $1
     AND override_date >= $2::date
     AND override_date <= $3::date
     ORDER BY override_date, start_time`,
    [expertId, startDate, endDate]
  );

  // Transform snake_case to camelCase
  // Transform snake_case to camelCase and normalize date/time fields to strings
  return result.rows.map((row) => ({
    id: row.id,
    expertId: row.expert_id,
    overrideDate:
      row.override_date instanceof Date
        ? row.override_date.toISOString().split('T')[0]
        : row.override_date,
    overrideType: row.override_type,
    startTime: row.start_time ? row.start_time.substring(0, 5) : null,
    endTime: row.end_time ? row.end_time.substring(0, 5) : null,
    timezone: row.timezone,
    reason: row.reason ?? null
  }));
};

/**
 * Get expert's existing bookings for a date range (private helper)
 */
const getExpertBookingsBusyTimes = async (
  expertId: string,
  startDate: Date,
  endDate: Date
): Promise<{ start: Date; end: Date }[]> => {
  const result = await query(
    `SELECT start_time, end_time
     FROM bookings
     WHERE expert_id = $1
     AND status IN ('scheduled', 'in_progress')
     AND start_time < $3
     AND end_time > $2
     ORDER BY start_time`,
    [expertId, startDate, endDate]
  );

  return result.rows.map((row) => ({
    start: row.start_time,
    end: row.end_time
  }));
};

/**
 * Generate time slots from availability rules for a specific date
 */
const generateSlotsFromRules = (
  rules: AvailabilityRule[],
  date: Date,
  expertTimezone: string
): TimeSlot[] => {
  const dayOfWeek = date.getDay();
  const applicableRules = rules.filter((rule) => rule.dayOfWeek === dayOfWeek);

  if (applicableRules.length === 0) {
    return [];
  }

  const slots: TimeSlot[] = [];

  for (const rule of applicableRules) {
    const [startHours, startMinutes] = rule.startTime.split(':').map(Number);
    const [endHours, endMinutes] = rule.endTime.split(':').map(Number);

    let current = new Date(date);
    current.setHours(startHours, startMinutes, 0, 0);

    const end = new Date(date);
    end.setHours(endHours, endMinutes, 0, 0);

    while (current < end) {
      const slotEnd = new Date(current.getTime() + rule.slotDurationMinutes * 60 * 1000);

      if (slotEnd <= end) {
        slots.push({
          start: new Date(current),
          end: slotEnd,
          isAvailable: true
        });
      }

      current = slotEnd;
    }
  }

  return slots;
};

/**
 * Apply overrides to slots (block times or add specific slots)
 */
const applyOverrides = (
  slots: TimeSlot[],
  overrides: AvailabilityOverride[],
  date: Date
): TimeSlot[] => {
  const dateStr = date.toISOString().split('T')[0];
  const dayOverrides = overrides.filter((o) => o.overrideDate === dateStr);

  if (dayOverrides.length === 0) {
    return slots;
  }

  // Check for all-day blocked
  const allDayBlock = dayOverrides.find(
    (o) => o.overrideType === 'blocked' && o.startTime === null
  );

  if (allDayBlock) {
    return []; // Entire day blocked
  }

  // Apply partial blocks and additions
  let updatedSlots = [...slots];

  for (const override of dayOverrides) {
    if (override.overrideType === 'blocked' && override.startTime && override.endTime) {
      const [blockStartHours, blockStartMinutes] = override.startTime.split(':').map(Number);
      const [blockEndHours, blockEndMinutes] = override.endTime.split(':').map(Number);

      const blockStart = new Date(date);
      blockStart.setHours(blockStartHours, blockStartMinutes, 0, 0);

      const blockEnd = new Date(date);
      blockEnd.setHours(blockEndHours, blockEndMinutes, 0, 0);

      // Remove slots that overlap with blocked time
      updatedSlots = updatedSlots.filter(
        (slot) => slot.end <= blockStart || slot.start >= blockEnd
      );
    } else if (override.overrideType === 'available' && override.startTime && override.endTime) {
      // Add special available slots (implement if needed)
    }
  }

  return updatedSlots;
};

/**
 * Remove busy times from available slots
 */
const removeBusySlots = (
  slots: TimeSlot[],
  busyTimes: { start: Date; end: Date }[]
): TimeSlot[] => {
  return slots.filter((slot) => {
    // Check if slot overlaps with any busy time
    return !busyTimes.some(
      (busy) => slot.start < busy.end && slot.end > busy.start
    );
  });
};

/**
 * Get available time slots for an expert on a specific date
 */
export const getAvailableSlots = async (
  expertId: string,
  date: Date,
  timezone: string
): Promise<TimeSlot[]> => {
  // 1. Get availability rules
  const rules = await getExpertAvailabilityRules(expertId);

  if (rules.length === 0) {
    return []; // No availability defined
  }

  // 2. Generate slots from rules
  let slots = generateSlotsFromRules(rules, date, timezone);

  if (slots.length === 0) {
    return [];
  }

  // 3. Get overrides for this date
  const dateStr = date.toISOString().split('T')[0];
  const overrides = await getExpertAvailabilityOverrides(expertId, dateStr, dateStr);

  // 4. Apply overrides
  slots = applyOverrides(slots, overrides, date);

  if (slots.length === 0) {
    return [];
  }

  // 5. Get existing bookings
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const bookings = await getExpertBookingsBusyTimes(expertId, dayStart, dayEnd);

  // 6. Get Google Calendar busy times
  const calendarBusyTimes = await getGoogleCalendarBusyTimes(expertId, dayStart, dayEnd);

  // 7. Combine all busy times
  const allBusyTimes = [...bookings, ...calendarBusyTimes];

  // 8. Remove busy slots
  slots = removeBusySlots(slots, allBusyTimes);

  // 9. Filter out past slots
  const now = new Date();
  slots = slots.filter((slot) => slot.start > now);

  return slots;
};

/**
 * Check if a specific time slot is available (atomic check)
 */
export const isSlotAvailable = async (
  expertId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  const result = await query(
    'SELECT is_slot_available($1, $2, $3) as available',
    [expertId, startTime, endTime]
  );

  return result.rows[0].available;
};

/**
 * Create a new booking (with transaction and idempotency)
 */
export const createBooking = async (input: CreateBookingInput): Promise<BookingWithDetails> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check idempotency
    if (input.idempotencyKey) {
      const existing = await client.query(
        'SELECT * FROM bookings WHERE idempotency_key = $1',
        [input.idempotencyKey]
      );

      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return await getBookingById(existing.rows[0].id);
      }
    }

    // Ensure the expert is not blocked for this date
    const bookingDate = input.startTime.toISOString().split('T')[0];
    const overrides = await getExpertAvailabilityOverrides(input.expertId, bookingDate, bookingDate);
    const isDayBlocked = overrides.some(
      (override) =>
        override.overrideType === 'blocked' && !override.startTime && !override.endTime
    );

    if (isDayBlocked) {
      throw new ApiError(409, 'Expert is unavailable on this date');
    }

    // Check slot availability (with row lock)
    const available = await client.query(
      `SELECT is_slot_available($1, $2, $3) as available`,
      [input.expertId, input.startTime, input.endTime]
    );

    if (!available.rows[0].available) {
      throw new ApiError(409, 'Time slot is no longer available');
    }

    // Get expert and user details
    const expertResult = await client.query(
      'SELECT name, email, avatar_url, headline FROM users WHERE id = $1',
      [input.expertId]
    );

    const userResult = await client.query(
      'SELECT name, email FROM users WHERE id = $1',
      [input.userId]
    );

    if (!expertResult.rows[0] || !userResult.rows[0]) {
      throw new ApiError(404, 'Expert or user not found');
    }

    const expert = expertResult.rows[0];
    const user = userResult.rows[0];

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings 
       (expert_id, user_id, start_time, end_time, duration_minutes, timezone, 
        status, meeting_title, meeting_notes, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9)
       RETURNING *`,
      [
        input.expertId,
        input.userId,
        input.startTime,
        input.endTime,
        input.durationMinutes,
        input.timezone,
        `Call with ${user.name}`,
        input.meetingNotes,
        input.idempotencyKey
      ]
    );

    const booking = bookingResult.rows[0];

    // Create audit log
    await client.query(
      `INSERT INTO booking_audit_log (booking_id, action, performed_by, new_values)
       VALUES ($1, 'created', $2, $3)`,
      [booking.id, input.userId, JSON.stringify(booking)]
    );

    // Create reminders
    const reminders = [
      { type: '24h', minutes: 24 * 60 },
      { type: '1h', minutes: 60 },
      { type: '15min', minutes: 15 }
    ];

    for (const reminder of reminders) {
      const sendAt = new Date(input.startTime.getTime() - reminder.minutes * 60 * 1000);
      if (sendAt > new Date()) {
        await client.query(
          `INSERT INTO booking_reminders (booking_id, reminder_type, send_at)
           VALUES ($1, $2, $3)`,
          [booking.id, reminder.type, sendAt]
        );
      }
    }

    await client.query('COMMIT');

    // Send booking confirmation to chat (async)
    sendBookingConfirmationToChat(booking.id, input.expertId, input.userId, user.name, expert.name, input.startTime, input.durationMinutes)
      .catch((err) => console.error('Failed to send booking confirmation to chat:', err));

    // Create calendar event (async, don't block)
    createCalendarEvent(input.expertId, {
      id: booking.id,
      userId: input.userId,
      userName: user.name,
      userEmail: user.email,
      startTime: input.startTime,
      endTime: input.endTime,
      title: `Call with ${user.name}`,
      notes: input.meetingNotes,
      meetingLink: `${env.appUrl}/call/${booking.id}`
    })
      .then(async (eventId) => {
        if (eventId) {
          await query(
            'UPDATE bookings SET calendar_event_id = $1 WHERE id = $2',
            [eventId, booking.id]
          );
        }
      })
      .catch((err) => console.error('Failed to create calendar event:', err));

    return await getBookingById(booking.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get booking by ID with full details
 */
export const getBookingById = async (bookingId: string): Promise<BookingWithDetails> => {
  const result = await query(
    `SELECT 
      b.*,
      e.name as expert_name,
      e.avatar_url as expert_avatar,
      e.headline as expert_headline,
      u.name as user_name,
      u.avatar_url as user_avatar,
      u.email as user_email
     FROM bookings b
     JOIN users e ON b.expert_id = e.id
     JOIN users u ON b.user_id = u.id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Booking not found');
  }

  const row = result.rows[0];
  
  // Transform snake_case to camelCase and convert dates to timestamps
  return {
    id: row.id,
    bookingId: row.id, // Frontend expects bookingId
    expertId: row.expert_id,
    userId: row.user_id,
    startTime: new Date(row.start_time).getTime(),
    endTime: new Date(row.end_time).getTime(),
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    status: row.status,
    meetingTitle: row.meeting_title,
    meetingNotes: row.meeting_notes,
    meetingLink: row.meeting_link,
    calendarEventId: row.calendar_event_id,
    price: row.price,
    paymentStatus: row.payment_status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    expertName: row.expert_name,
    expertAvatar: row.expert_avatar,
    expertHeadline: row.expert_headline,
    userName: row.user_name,
    userAvatar: row.user_avatar,
    userEmail: row.user_email
  };
};

/**
 * Get user's bookings with filters
 */
export const getUserBookings = async (
  userId: string,
  status?: 'upcoming' | 'past' | 'canceled'
): Promise<BookingWithDetails[]> => {
  let statusFilter = '';
  const params: any[] = [userId];

  if (status === 'upcoming') {
    statusFilter = `AND b.status IN ('scheduled', 'in_progress') AND b.start_time > NOW()`;
  } else if (status === 'past') {
    statusFilter = `AND b.status = 'completed' OR (b.start_time < NOW() AND b.status != 'scheduled')`;
  } else if (status === 'canceled') {
    statusFilter = `AND b.status IN ('cancelled_by_user', 'cancelled_by_expert')`;
  }

  const result = await query(
    `SELECT 
      b.*,
      e.name as expert_name,
      e.avatar_url as expert_avatar,
      e.headline as expert_headline,
      u.name as user_name,
      u.avatar_url as user_avatar,
      u.email as user_email
     FROM bookings b
     JOIN users e ON b.expert_id = e.id
     JOIN users u ON b.user_id = u.id
     WHERE b.user_id = $1 ${statusFilter}
     ORDER BY b.start_time DESC`,
    params
  );

  // Transform snake_case to camelCase and convert dates to timestamps
  return result.rows.map((row) => ({
    id: row.id,
    bookingId: row.id, // Frontend expects bookingId
    expertId: row.expert_id,
    userId: row.user_id,
    startTime: new Date(row.start_time).getTime(),
    endTime: new Date(row.end_time).getTime(),
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    status: row.status,
    meetingTitle: row.meeting_title,
    meetingNotes: row.meeting_notes,
    meetingLink: row.meeting_link,
    calendarEventId: row.calendar_event_id,
    price: row.price,
    paymentStatus: row.payment_status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    expertName: row.expert_name,
    expertAvatar: row.expert_avatar,
    expertHeadline: row.expert_headline,
    userName: row.user_name,
    userAvatar: row.user_avatar,
    userEmail: row.user_email
  }));
};

/**
 * Get expert's bookings
 */
export const getExpertBookings = async (
  expertId: string,
  status?: 'upcoming' | 'past' | 'canceled'
): Promise<BookingWithDetails[]> => {
  let statusFilter = '';

  if (status === 'upcoming') {
    statusFilter = `AND b.status IN ('scheduled', 'in_progress') AND b.start_time > NOW()`;
  } else if (status === 'past') {
    statusFilter = `AND b.status = 'completed' OR (b.start_time < NOW())`;
  } else if (status === 'canceled') {
    statusFilter = `AND b.status IN ('cancelled_by_user', 'cancelled_by_expert')`;
  }

  const result = await query(
    `SELECT 
      b.*,
      e.name as expert_name,
      e.avatar_url as expert_avatar,
      e.headline as expert_headline,
      u.name as user_name,
      u.avatar_url as user_avatar,
      u.email as user_email
     FROM bookings b
     JOIN users e ON b.expert_id = e.id
     JOIN users u ON b.user_id = u.id
     WHERE b.expert_id = $1 ${statusFilter}
     ORDER BY b.start_time DESC`,
    [expertId]
  );

  // Transform snake_case to camelCase and convert dates to timestamps
  return result.rows.map((row) => ({
    id: row.id,
    bookingId: row.id, // Frontend expects bookingId
    expertId: row.expert_id,
    userId: row.user_id,
    startTime: new Date(row.start_time).getTime(),
    endTime: new Date(row.end_time).getTime(),
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    status: row.status,
    meetingTitle: row.meeting_title,
    meetingNotes: row.meeting_notes,
    meetingLink: row.meeting_link,
    calendarEventId: row.calendar_event_id,
    price: row.price,
    paymentStatus: row.payment_status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    expertName: row.expert_name,
    expertAvatar: row.expert_avatar,
    expertHeadline: row.expert_headline,
    userName: row.user_name,
    userAvatar: row.user_avatar,
    userEmail: row.user_email
  }));
};

/**
 * Cancel booking
 */
export const cancelBooking = async (
  bookingId: string,
  cancelledBy: string,
  reason?: string
): Promise<BookingWithDetails> => {
  const booking = await getBookingById(bookingId);

  if (!['scheduled', 'in_progress'].includes(booking.status)) {
    throw new ApiError(400, 'Booking cannot be cancelled');
  }

  // Check cancellation policy (e.g., no cancel within 1 hour)
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;
  if (booking.startTime < oneHourFromNow) {
    throw new ApiError(
      400,
      'Cannot cancel booking less than 1 hour before start time'
    );
  }

  const isExpert = booking.expertId === cancelledBy;
  const newStatus = isExpert ? 'cancelled_by_expert' : 'cancelled_by_user';

  await query(
    `UPDATE bookings
     SET status = $1, cancellation_reason = $2, cancelled_at = NOW(), cancelled_by = $3
     WHERE id = $4`,
    [newStatus, reason, cancelledBy, bookingId]
  );

  // Audit log
  await query(
    `INSERT INTO booking_audit_log (booking_id, action, performed_by, old_values, new_values)
     VALUES ($1, 'cancelled', $2, $3, $4)`,
    [
      bookingId,
      cancelledBy,
      JSON.stringify({ status: booking.status }),
      JSON.stringify({ status: newStatus, reason })
    ]
  );

  // Delete calendar event
  if (booking.calendarEventId) {
    deleteCalendarEvent(booking.expertId, booking.calendarEventId).catch((err) =>
      console.error('Failed to delete calendar event:', err)
    );
  }

  const updatedBooking = await getBookingById(bookingId);

  try {
    await sendBookingCancellationNotification({
      bookingId,
      expertId: updatedBooking.expertId,
      userId: updatedBooking.userId,
      cancelledBy,
      userName: updatedBooking.userName,
      expertName: updatedBooking.expertName,
      startTime: updatedBooking.startTime,
      durationMinutes: updatedBooking.durationMinutes,
      reason
    });
  } catch (err) {
    console.error('Failed to send booking cancellation notification:', err);
  }

  return updatedBooking;
};

/**
 * Reschedule booking (atomic: cancel old + create new)
 */
export const rescheduleBooking = async (
  bookingId: string,
  newStartTime: Date,
  newEndTime: Date,
  userId: string
): Promise<BookingWithDetails> => {
  const oldBooking = await getBookingById(bookingId);

  if (!['scheduled'].includes(oldBooking.status)) {
    throw new ApiError(400, 'Booking cannot be rescheduled');
  }

  // Check if the new time is in the future
  if (newStartTime.getTime() <= Date.now()) {
    throw new ApiError(400, 'New booking time must be in the future');
  }

  // Validate availability for the new slot
  const isAvailable = await isSlotAvailable(
    oldBooking.expertId,
    newStartTime,
    newEndTime
  );

  if (!isAvailable) {
    throw new ApiError(409, 'The selected time slot is no longer available');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Cancel old booking
    await client.query(
      `UPDATE bookings
       SET status = 'cancelled_by_user', cancellation_reason = 'Rescheduled'
       WHERE id = $1`,
      [bookingId]
    );

    // Create new booking
    const newBooking = await client.query(
      `INSERT INTO bookings 
       (expert_id, user_id, start_time, end_time, duration_minutes, timezone, 
        status, meeting_title, meeting_notes, price)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9)
       RETURNING *`,
      [
        oldBooking.expertId,
        oldBooking.userId,
        newStartTime,
        newEndTime,
        oldBooking.durationMinutes,
        oldBooking.timezone,
        oldBooking.meetingTitle,
        oldBooking.meetingNotes,
        oldBooking.price
      ]
    );

    // Audit log - convert timestamp to ISO string for JSON
    const oldStartTimeISO = new Date(oldBooking.startTime).toISOString();
    
    await client.query(
      `INSERT INTO booking_audit_log (booking_id, action, performed_by, old_values, new_values)
       VALUES ($1, 'rescheduled', $2, $3, $4)`,
      [
        newBooking.rows[0].id,
        userId,
        JSON.stringify({ bookingId, startTime: oldStartTimeISO }),
        JSON.stringify({ startTime: newStartTime.toISOString() })
      ]
    );

    await client.query('COMMIT');

    const newBookingDetails = await getBookingById(newBooking.rows[0].id);

    // Notify both parties about the schedule change
    sendBookingUpdateNotification({
      bookingId: newBooking.rows[0].id,
      expertId: oldBooking.expertId,
      userId: oldBooking.userId,
      updatedBy: userId,
      userName: newBookingDetails.userName,
      expertName: newBookingDetails.expertName,
      oldStartTime: oldBooking.startTime,
      newStartTime: newBookingDetails.startTime,
      durationMinutes: oldBooking.durationMinutes
    }).catch((err) => console.error('Failed to send booking update notification:', err));

    return newBookingDetails;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
