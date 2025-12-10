import { PoolClient } from 'pg';
import { query, transaction } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { ApiError } from '../errors/ApiError.js';
import type { Conversation, InstantInvite, Session, User } from '../types/index.js';
import { createSessionRecord } from './sessionService.js';
import { addConversationMessage, attachParticipantLabels } from './conversationService.js';
import { logger } from '../utils/logger.js';

const INVITE_TTL_MINUTES = 5;

const cloneInvite = (invite: InstantInvite): InstantInvite => ({ ...invite });

const isExpired = (invite: InstantInvite): boolean => {
  if (!invite.expires_at) {
    return false;
  }
  return Date.parse(invite.expires_at) <= Date.now();
};

const notificationPayload = (
  invite: InstantInvite,
  event: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired',
  userId: string,
  extra?: Record<string, unknown>
) => ({
  type: 'instant_invite',
  event,
  userId,
  invite,
  conversationId: invite.conversation_id,
  requesterUserId: invite.requester_user_id,
  targetUserId: invite.target_user_id,
  ...extra
});

const publishInviteEvent = async (
  invite: InstantInvite,
  event: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired',
  recipients: Array<{ userId: string; extra?: Record<string, unknown> }>
): Promise<void> => {
  for (const recipient of recipients) {
    await redis.publish('notification', JSON.stringify(notificationPayload(invite, event, recipient.userId, recipient.extra)));
  }
};

const fetchInviteForUpdate = async (client: PoolClient, inviteId: string): Promise<InstantInvite> => {
  const result = await client.query<InstantInvite>('SELECT * FROM instant_invites WHERE id = $1 FOR UPDATE', [inviteId]);
  const invite = result.rows[0];
  if (!invite) {
    throw new ApiError(404, 'NOT_FOUND', 'Invite not found');
  }
  return invite;
};

const ensureNotExpired = async (client: PoolClient, invite: InstantInvite): Promise<void> => {
  if (!isExpired(invite)) {
    return;
  }
  await client.query(
    `UPDATE instant_invites
       SET status = 'expired', updated_at = NOW()
     WHERE id = $1`,
    [invite.id]
  );
  throw new ApiError(410, 'INVITE_EXPIRED', 'That invitation expired. Ask them to retry.');
};

const mapConversationForNotification = async (conversation: Conversation): Promise<Conversation> => {
  return attachParticipantLabels(conversation);
};

const findRecentPendingInvite = async (
  conversationId: string,
  requesterUserId: string,
  targetUserId: string
): Promise<InstantInvite | null> => {
  const result = await query<InstantInvite>(
    `SELECT *
       FROM instant_invites
      WHERE conversation_id = $1
        AND requester_user_id = $2
        AND target_user_id = $3
        AND status = 'pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [conversationId, requesterUserId, targetUserId]
  );
  return result.rows[0] ?? null;
};

export const createInstantInvite = async (
  conversation: Conversation,
  requester: User,
  target: User
): Promise<InstantInvite> => {
  const existing = await findRecentPendingInvite(conversation.id, requester.id, target.id);
  if (existing) {
    return cloneInvite(existing);
  }

  const insert = await query<InstantInvite>(
    `INSERT INTO instant_invites (conversation_id, requester_user_id, target_user_id, status, expires_at, metadata, created_at, updated_at)
     VALUES ($1,$2,$3,'pending', NOW() + INTERVAL '${INVITE_TTL_MINUTES} minutes', $4, NOW(), NOW())
     RETURNING *`,
    [conversation.id, requester.id, target.id, JSON.stringify({ requester_name: requester.name ?? 'A member' })]
  );
  const invite = insert.rows[0];

  try {
    const notice = `${requester.name ?? 'A member'} is requesting to connect now.`;
    await addConversationMessage(conversation.id, null, notice, 'system_notice');
  } catch (error) {
    logger.warn('Failed to append invite notice message', {
      conversationId: conversation.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const conversationPayload = await mapConversationForNotification(conversation);
  await publishInviteEvent(invite, 'pending', [
    {
      userId: target.id,
      extra: {
        conversation: conversationPayload
      }
    },
    {
      userId: requester.id,
      extra: {
        conversation: conversationPayload
      }
    }
  ]);

  return cloneInvite(invite);
};

export const acceptInstantInvite = async (
  inviteId: string,
  targetUserId: string
): Promise<{ invite: InstantInvite; session: Session; conversation: Conversation }> => {
  const result = await transaction(async (client) => {
    const invite = await fetchInviteForUpdate(client, inviteId);
    if (invite.target_user_id !== targetUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'You are not the target of this invite.');
    }
    if (invite.status !== 'pending') {
      throw new ApiError(409, 'INVITE_CONSUMED', 'This invite has already been processed.');
    }
    await ensureNotExpired(client, invite);

    const updatedInviteResult = await client.query<InstantInvite>(
      `UPDATE instant_invites
         SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [invite.id]
    );
    const updatedInvite = updatedInviteResult.rows[0];

    const session = await createSessionRecord(
      {
        host_user_id: invite.target_user_id,
        guest_user_id: invite.requester_user_id,
        conversation_id: invite.conversation_id,
        type: 'instant',
        start_time: new Date().toISOString(),
        duration_minutes: 30,
        agreed_price: 0,
        payment_mode: 'free'
      },
      client
    );

    const conversationResult = await client.query<Conversation>('SELECT * FROM conversations WHERE id = $1', [invite.conversation_id]);
    const conversation = conversationResult.rows[0];
    if (!conversation) {
      throw new ApiError(404, 'NOT_FOUND', 'Conversation missing for invite');
    }

    return { invite: updatedInvite, session, conversation };
  });

  try {
    await addConversationMessage(result.invite.conversation_id, null, 'Your host accepted. Connecting now…', 'system_notice');
  } catch (error) {
    logger.warn('Failed to append acceptance notice', {
      inviteId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const enrichedConversation = await mapConversationForNotification(result.conversation);

  await publishInviteEvent(result.invite, 'accepted', [
    {
      userId: result.invite.requester_user_id,
      extra: { conversation: enrichedConversation, session: result.session }
    },
    {
      userId: result.invite.target_user_id,
      extra: { conversation: enrichedConversation, session: result.session }
    }
  ]);

  return {
    ...result,
    conversation: enrichedConversation
  };
};

export const declineInstantInvite = async (inviteId: string, targetUserId: string): Promise<InstantInvite> => {
  const invite = await transaction(async (client) => {
    const invite = await fetchInviteForUpdate(client, inviteId);
    if (invite.target_user_id !== targetUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'You are not the target of this invite.');
    }
    if (invite.status !== 'pending') {
      throw new ApiError(409, 'INVITE_CONSUMED', 'This invite has already been processed.');
    }
    await ensureNotExpired(client, invite);

    const updated = await client.query<InstantInvite>(
      `UPDATE instant_invites
         SET status = 'declined', declined_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [invite.id]
    );
    return updated.rows[0];
  });

  await publishInviteEvent(invite, 'declined', [
    { userId: invite.requester_user_id },
    { userId: invite.target_user_id }
  ]);

  return invite;
};

export const cancelInstantInvite = async (inviteId: string, requesterUserId: string): Promise<InstantInvite> => {
  const invite = await transaction(async (client) => {
    const invite = await fetchInviteForUpdate(client, inviteId);
    if (invite.requester_user_id !== requesterUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the requester can cancel this invite.');
    }
    if (invite.status !== 'pending') {
      throw new ApiError(409, 'INVITE_CONSUMED', 'This invite has already been processed.');
    }

    const updated = await client.query<InstantInvite>(
      `UPDATE instant_invites
         SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [invite.id]
    );
    return updated.rows[0];
  });

  await publishInviteEvent(invite, 'cancelled', [
    { userId: invite.target_user_id },
    { userId: invite.requester_user_id }
  ]);

  return invite;
};