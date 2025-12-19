/**
 * Booking Notification Service
 * Handles sending booking confirmations to chat conversations
 */

import { ensureHumanConversation, addConversationMessage } from './conversationService.js';

type DateInput = Date | string | number;

const toDateParts = (value: DateInput) => {
  const date = value instanceof Date ? value : new Date(value);
  return {
    date,
    iso: date.toISOString(),
    formattedDate: date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    formattedTime: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  };
};

/**
 * Send booking confirmation message to chat
 * Creates conversation if it doesn't exist between user and expert
 */
export const sendBookingConfirmationToChat = async (
  bookingId: string,
  expertId: string,
  userId: string,
  userName: string,
  expertName: string,
  startTime: DateInput,
  durationMinutes: number
): Promise<void> => {
  try {
    console.log(`[Booking Notification] Starting for booking ${bookingId}, expert: ${expertId}, user: ${userId}`);

    const conversation = await ensureHumanConversation(userId, expertId);
    const conversationId = conversation.id;
    console.log(`[Booking Notification] Using conversation ${conversationId}`);

    const startParts = toDateParts(startTime);

    // Create booking confirmation message for the client
    const clientMessage = [
      `✅ **Booking Confirmed**`,
      ``,
      `**Session Details:**`,
      `📅 Date: ${startParts.formattedDate}`,
      `🕐 Time: ${startParts.formattedTime}`,
      `⏱️ Duration: ${durationMinutes} minutes`,
      `👤 Expert: ${expertName}`,
      ``,
      `Your session has been confirmed. You'll receive reminders before the call.`
    ].join('\n');

    // Create notification message for the expert
    const expertMessage = [
      `📅 **New Booking Request**`,
      ``,
      `**Session Details:**`,
      `📅 Date: ${startParts.formattedDate}`,
      `🕐 Time: ${startParts.formattedTime}`,
      `⏱️ Duration: ${durationMinutes} minutes`,
      `👤 Client: ${userName}`,
      ``,
      `A new session has been scheduled with you.`
    ].join('\n');

    const metadata = {
      bookingId,
      expertId,
      userId,
      startTime: startParts.iso,
      durationMinutes,
      expertName,
      userName
    };

    await addConversationMessage(conversationId, null, clientMessage, 'system_notice', [
      { type: 'booking_confirmation', role: 'client', ...metadata }
    ]);

    await addConversationMessage(conversationId, null, expertMessage, 'system_notice', [
      { type: 'booking_notification', role: 'expert', ...metadata }
    ]);

    console.log(`[Booking Notification] ✅ Successfully sent notifications to conversation ${conversationId} for booking ${bookingId}`);
  } catch (error) {
    console.error('[Booking Notification] ❌ Error sending booking confirmation to chat:', error);
    throw error;
  }
};

interface BookingUpdatePayload {
  bookingId: string;
  expertId: string;
  userId: string;
  updatedBy: string;
  userName: string;
  expertName: string;
  oldStartTime: DateInput;
  newStartTime: DateInput;
  durationMinutes: number;
}

export const sendBookingUpdateNotification = async (
  payload: BookingUpdatePayload
): Promise<void> => {
  const {
    bookingId,
    expertId,
    userId,
    updatedBy,
    userName,
    expertName,
    oldStartTime,
    newStartTime,
    durationMinutes
  } = payload;

  try {
    const conversation = await ensureHumanConversation(userId, expertId);
    const conversationId = conversation.id;

    const oldParts = toDateParts(oldStartTime);
    const newParts = toDateParts(newStartTime);

    const updatedByExpert = updatedBy === expertId;
    const actorName = updatedByExpert ? expertName : userName;
    const otherName = updatedByExpert ? userName : expertName;

    const baseDetails =
      `📅 New Date: ${newParts.formattedDate}\n` +
      `🕐 New Time: ${newParts.formattedTime}\n` +
      `⏱️ Duration: ${durationMinutes} minutes\n` +
      `↩️ Previously: ${oldParts.formattedDate} at ${oldParts.formattedTime}`;

    const clientMessage = updatedByExpert
      ? `🔄 **Session Rescheduled by ${actorName}**\n\n${baseDetails}`
      : `🔄 **You Rescheduled Your Session**\n\n${baseDetails}`;

    const expertMessage = updatedByExpert
      ? `🔄 **You Rescheduled the Session**\n\n${baseDetails}`
      : `🔄 **${otherName} Rescheduled Their Session**\n\n${baseDetails}`;

    const metadata = {
      bookingId,
      oldStartTime: oldParts.iso,
      newStartTime: newParts.iso,
      durationMinutes,
      expertName,
      userName,
      updatedByRole: updatedByExpert ? 'expert' : 'client'
    };

    await addConversationMessage(conversationId, null, clientMessage, 'system_notice', [
      { type: 'booking_rescheduled_client', role: 'client', ...metadata }
    ]);

    await addConversationMessage(conversationId, null, expertMessage, 'system_notice', [
      { type: 'booking_rescheduled_expert', role: 'expert', ...metadata }
    ]);
  } catch (error) {
    console.error('[Booking Notification] ❌ Error sending booking update notification:', error);
    throw error;
  }
};

interface BookingCancellationPayload {
  bookingId: string;
  expertId: string;
  userId: string;
  cancelledBy: string;
  userName: string;
  expertName: string;
  startTime: DateInput;
  durationMinutes: number;
  reason?: string | null;
}

export const sendBookingCancellationNotification = async (
  payload: BookingCancellationPayload
): Promise<void> => {
  const {
    bookingId,
    expertId,
    userId,
    cancelledBy,
    userName,
    expertName,
    startTime,
    durationMinutes,
    reason
  } = payload;

  try {
    const conversation = await ensureHumanConversation(userId, expertId);
    const conversationId = conversation.id;

    const startParts = toDateParts(startTime);
    const cancelledByExpert = cancelledBy === expertId;
    const actorName = cancelledByExpert ? expertName : userName;
    const otherName = cancelledByExpert ? userName : expertName;
    const reasonLine = reason ? `\n📝 Reason: ${reason}` : '';

    const clientMessage = cancelledByExpert
      ? `❌ **Session Cancelled by ${actorName}**\n\n` +
        `📅 Date: ${startParts.formattedDate}\n` +
        `🕐 Time: ${startParts.formattedTime}\n` +
        `⏱️ Duration: ${durationMinutes} minutes${reasonLine}`
      : `❌ **You Cancelled Your Session**\n\n` +
        `📅 Date: ${startParts.formattedDate}\n` +
        `🕐 Time: ${startParts.formattedTime}\n` +
        `⏱️ Duration: ${durationMinutes} minutes${reasonLine}`;

    const expertMessage = cancelledByExpert
      ? `❌ **You Cancelled the Session**\n\n` +
        `📅 Date: ${startParts.formattedDate}\n` +
        `🕐 Time: ${startParts.formattedTime}\n` +
        `⏱️ Duration: ${durationMinutes} minutes${reasonLine}`
      : `❌ **${otherName} Cancelled Their Session**\n\n` +
        `📅 Date: ${startParts.formattedDate}\n` +
        `🕐 Time: ${startParts.formattedTime}\n` +
        `⏱️ Duration: ${durationMinutes} minutes${reasonLine}`;

    const systemMessage = `Booking for ${startParts.formattedDate} at ${startParts.formattedTime} has been cancelled.`;

    const metadata = {
      bookingId,
      startTime: startParts.iso,
      durationMinutes,
      expertName,
      userName,
      cancelledByRole: cancelledByExpert ? 'expert' : 'client',
      reason: reason ?? null
    };

    await addConversationMessage(conversationId, null, systemMessage, 'system_notice', [
      {
        type: 'booking_cancelled',
        visibility: 'client',
        title: `Booking Cancelled`,
        content: clientMessage,
        ...metadata
      },
      {
        type: 'booking_cancelled',
        visibility: 'expert',
        title: `Booking Cancelled`,
        content: expertMessage,
        ...metadata
      }
    ]);
  } catch (error) {
    console.error('[Booking Notification] ❌ Error sending booking cancellation notification:', error);
    throw error;
  }
};
