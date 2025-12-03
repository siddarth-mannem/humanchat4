import { ApiError } from '../errors/ApiError.js';
import { addConversationMessage, ensureHumanConversation } from './conversationService.js';
import { createSessionRecord, getSessionById, updateSessionStatus } from './sessionService.js';
import { getUserById } from './userService.js';
import type { Conversation, PaymentMode, Session, User } from '../types/index.js';
import { logger } from '../utils/logger.js';

const INSTANT_SESSION_MINUTES = 30;
const STALE_PENDING_MINUTES = 10;
const STALE_ACTIVE_MINUTES = 120;

const minutesSince = (timestamp?: string | null): number | null => {
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return (Date.now() - parsed) / 60000;
};

const isSessionStale = (session: Session): boolean => {
  const recencyMinutes = minutesSince(session.updated_at ?? session.start_time ?? session.created_at);
  if (recencyMinutes == null) {
    return false;
  }
  if (session.status === 'pending') {
    return recencyMinutes > STALE_PENDING_MINUTES;
  }
  if (session.status === 'in_progress') {
    return recencyMinutes > STALE_ACTIVE_MINUTES;
  }
  return false;
};

const participantsMatch = (session: Session, requesterId: string, targetUserId: string): boolean => {
  return (
    (session.host_user_id === targetUserId && session.guest_user_id === requesterId) ||
    (session.host_user_id === requesterId && session.guest_user_id === targetUserId)
  );
};

const expireSessionIfNeeded = async (session: Session): Promise<boolean> => {
  if (!isSessionStale(session)) {
    return false;
  }
  await updateSessionStatus(session.id, 'complete');
  logger.warn('Expired stale session blocking instant connect', {
    sessionId: session.id,
    status: session.status,
    conversationId: session.conversation_id
  });
  return true;
};

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

const resolveExistingSession = async (
  conversation: Conversation,
  requesterId: string,
  targetUserId: string
): Promise<Session | null> => {
  if (!conversation.linked_session_id) {
    return null;
  }

  try {
    const session = await getSessionById(conversation.linked_session_id);

    if (session.status === 'complete') {
      return null;
    }

    const expired = await expireSessionIfNeeded(session);
    if (expired) {
      return null;
    }

    if (participantsMatch(session, requesterId, targetUserId)) {
      logger.info('Reusing existing instant session for participants', {
        conversationId: conversation.id,
        sessionId: session.id,
        requesterId,
        targetUserId
      });
      return session;
    }

    throw new ApiError(409, 'SESSION_ACTIVE', 'This conversation already has an active session.');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      return null;
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
  logger.info('Instant connection requested', { requesterId, targetUserId });

  try {
    if (requesterId === targetUserId) {
      throw new ApiError(400, 'INVALID_REQUEST', 'You cannot start a session with yourself.');
    }

    const [requester, target] = await Promise.all([getUserById(requesterId), getUserById(targetUserId)]);
    assertConnectable(requester, target);

    const conversation = await ensureHumanConversation(requesterId, targetUserId);
    const existingSession = await resolveExistingSession(conversation, requesterId, targetUserId);

    if (existingSession) {
      const hydratedConversation: Conversation = {
        ...conversation,
        linked_session_id: existingSession.id,
        last_activity: existingSession.updated_at ?? conversation.last_activity
      };

      return {
        conversation: hydratedConversation,
        session: existingSession
      };
    }

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

    logger.info('Instant connection created', {
      requesterId,
      targetUserId,
      conversationId: hydratedConversation.id,
      sessionId: session.id,
      paymentMode
    });

    return {
      conversation: hydratedConversation,
      session
    };
  } catch (error) {
    logger.error('Instant connection failed', {
      requesterId,
      targetUserId,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
