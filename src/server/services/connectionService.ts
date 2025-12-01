import { ApiError } from '../errors/ApiError.js';
import { addConversationMessage, ensureHumanConversation } from './conversationService.js';
import { createSessionRecord, getSessionById } from './sessionService.js';
import { getUserById } from './userService.js';
import type { Conversation, PaymentMode, Session, User } from '../types/index.js';

const INSTANT_SESSION_MINUTES = 30;

const derivePaymentMode = (host: User): PaymentMode => {
  switch (host.conversation_type) {
    case 'charity':
      return 'charity';
    case 'free':
      return 'free';
    default:
      return 'paid';
  }
};

const ensureConversationIsAvailable = async (conversation: Conversation): Promise<void> => {
  if (!conversation.linked_session_id) {
    return;
  }
  try {
    const session = await getSessionById(conversation.linked_session_id);
    if (session.status !== 'complete') {
      throw new ApiError(409, 'SESSION_ACTIVE', 'This conversation already has an active session.');
    }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      return;
    }
    throw error;
  }
};

const assertConnectable = (requester: User, target: User): void => {
  if (!target.is_online) {
    throw new ApiError(409, 'TARGET_OFFLINE', `${target.name ?? 'That member'} is offline right now.`);
  }
  if (target.has_active_session) {
    throw new ApiError(409, 'TARGET_BUSY', `${target.name ?? 'That member'} is already in a session.`);
  }
  if (target.managed && target.confidential_rate) {
    throw new ApiError(422, 'REQUEST_REQUIRED', `${target.name ?? 'That member'} requires a managed request.`);
  }
  if (requester.has_active_session) {
    throw new ApiError(409, 'REQUESTER_BUSY', 'You are already in a session.');
  }
};

export const initiateInstantConnection = async (
  requesterId: string,
  targetUserId: string
): Promise<{ conversation: Conversation; session: Session }> => {
  if (requesterId === targetUserId) {
    throw new ApiError(400, 'INVALID_REQUEST', 'You cannot start a session with yourself.');
  }

  const [requester, target] = await Promise.all([getUserById(requesterId), getUserById(targetUserId)]);
  assertConnectable(requester, target);

  const conversation = await ensureHumanConversation(requesterId, targetUserId);
  await ensureConversationIsAvailable(conversation);

  const paymentMode = derivePaymentMode(target);
  const now = new Date();
  const startTime = now.toISOString();
  const ratePerMinute = target.instant_rate_per_minute ?? 0;
  const agreedPrice = paymentMode === 'free' ? 0 : Math.max(0, ratePerMinute * INSTANT_SESSION_MINUTES);

  const session = await createSessionRecord({
    host_user_id: targetUserId,
    guest_user_id: requesterId,
    conversation_id: conversation.id,
    type: 'instant',
    start_time: startTime,
    duration_minutes: INSTANT_SESSION_MINUTES,
    agreed_price: agreedPrice,
    payment_mode: paymentMode
  });

  const notice = `${requester.name ?? 'A member'} is connecting with ${target.name ?? 'their contact'} now.`;
  await addConversationMessage(conversation.id, null, notice, 'system_notice');

  const hydratedConversation: Conversation = {
    ...conversation,
    linked_session_id: session.id,
    last_activity: session.updated_at ?? now.toISOString()
  };

  return {
    conversation: hydratedConversation,
    session
  };
};
