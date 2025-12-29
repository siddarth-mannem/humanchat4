import { validate as uuidValidate } from 'uuid';

import { query } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { Conversation } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  message_type: 'user_text' | 'sam_response' | 'system_notice';
  created_at: string;
  actions?: Array<Record<string, unknown>>;
}

const ensureConversationIdIsUuid = (conversationId: string): void => {
  if (!uuidValidate(conversationId)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Conversation id must be a UUID');
  }
};

const ensureUserIdIsUuid = (userId: string, label: string): void => {
  if (!uuidValidate(userId)) {
    throw new ApiError(400, 'INVALID_REQUEST', `${label} must be a UUID`);
  }
};

const sortParticipants = (first: string, second: string): [string, string] => {
  return first.localeCompare(second) <= 0 ? [first, second] : [second, first];
};

export const listConversations = async (userId: string): Promise<Conversation[]> => {
  const result = await query<Conversation>(
    `SELECT c.*,
            (
              SELECT json_object_agg(u.id::text, COALESCE(NULLIF(TRIM(u.name), ''), 'HumanChat member'))
              FROM users u
              WHERE u.id = ANY(c.participants)
            ) AS participant_display_map,
            (
              SELECT json_object_agg(u.id::text, u.avatar_url)
              FROM users u
              WHERE u.id = ANY(c.participants) AND u.avatar_url IS NOT NULL
            ) AS participant_avatars
       FROM conversations c
      WHERE $1 = ANY(c.participants)
      ORDER BY c.last_activity DESC`,
    [userId]
  );
  return result.rows;
};

export const getConversationMessages = async (conversationId: string): Promise<ConversationMessage[]> => {
  ensureConversationIdIsUuid(conversationId);
  const result = await query<ConversationMessage>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return result.rows;
};

export const addConversationMessage = async (
  conversationId: string,
  senderId: string | null,
  content: string,
  type: ConversationMessage['message_type'],
  actions?: ConversationMessage['actions']
): Promise<ConversationMessage> => {
  ensureConversationIdIsUuid(conversationId);
  const conversation = await query<Conversation>('SELECT * FROM conversations WHERE id = $1', [conversationId]);
  if (!conversation.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Conversation not found');
  }

  const serializedActions = actions ? JSON.stringify(actions) : null;

  const runInsert = async (actionsJson: string | null) => {
    const inserted = await query<ConversationMessage>(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, actions, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,NOW()) RETURNING *`,
      [conversationId, senderId ?? null, content, type, actionsJson]
    );
    await query('UPDATE conversations SET last_activity = NOW() WHERE id = $1', [conversationId]);
    
    // Notify all participants in the conversation about the new message
    const participants = conversation.rows[0].participants;
    console.log('[ConversationService] Broadcasting message to participants:', {
      conversationId,
      messageId: inserted.rows[0].id,
      participants,
      content: content.substring(0, 50)
    });
    
    for (const participantId of participants) {
      const payload = {
        type: 'new_message',
        userId: participantId,
        conversationId,
        message: inserted.rows[0]
      };
      
      const publishResult = await redis.publish('notification', JSON.stringify(payload));
      console.log(`[ConversationService] Published to Redis for user ${participantId}: ${publishResult} subscribers received`);
    }
    
    return inserted.rows[0];
  };

  try {
    return await runInsert(serializedActions);
  } catch (error) {
    const pgError = error as { code?: string };
    const isJsonSyntaxError = pgError?.code === '22P02';
    if (!isJsonSyntaxError || !serializedActions) {
      throw error;
    }

    logger.warn('Dropping invalid Sam actions payload before persistence', {
      conversationId,
      type,
      sample: serializedActions.slice(0, 200)
    });

    return runInsert(null);
  }
};

export const findSamConversationForUser = async (userId: string): Promise<Conversation | null> => {
  if (!uuidValidate(userId)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'User id must be a UUID');
  }

  const result = await query<Conversation>(
    `SELECT *
     FROM conversations
     WHERE type = 'sam' AND $1 = ANY(participants)
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] ?? null;
};

export const ensureSamConversation = async (userId: string): Promise<Conversation> => {
  const existing = await findSamConversationForUser(userId);
  if (existing) {
    return existing;
  }

  const insert = await query<Conversation>(
    `INSERT INTO conversations (type, participants, last_activity)
     VALUES ('sam', ARRAY[$1::uuid], NOW())
     RETURNING *`,
    [userId]
  );

  return insert.rows[0];
};

export const hasSamRespondedToUser = async (userId: string): Promise<boolean> => {
  ensureUserIdIsUuid(userId, 'User id');

  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
        SELECT 1
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.type = 'sam'
          AND $1 = ANY(c.participants)
          AND m.message_type = 'sam_response'
      ) AS exists`,
    [userId]
  );

  return result.rows[0]?.exists ?? false;
};

const findHumanConversationBetween = async (userA: string, userB: string): Promise<Conversation | null> => {
  const result = await query<Conversation>(
    `SELECT *
     FROM conversations
     WHERE type = 'human'
       AND array_length(participants, 1) = 2
       AND participants @> ARRAY[$1::uuid, $2::uuid]
     ORDER BY last_activity DESC
     LIMIT 1`,
    [userA, userB]
  );
  return result.rows[0] ?? null;
};

export const ensureHumanConversation = async (userA: string, userB: string): Promise<Conversation> => {
  ensureUserIdIsUuid(userA, 'User id');
  ensureUserIdIsUuid(userB, 'Target user id');
  if (userA === userB) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Cannot create a conversation with yourself');
  }

  const [first, second] = sortParticipants(userA, userB);
  const existing = await findHumanConversationBetween(first, second);
  if (existing) {
    return existing;
  }

  const insert = await query<Conversation>(
    `INSERT INTO conversations (type, participants, last_activity)
     VALUES ('human', ARRAY[$1::uuid, $2::uuid], NOW())
     RETURNING *`,
    [first, second]
  );

  return insert.rows[0];
};

const buildParticipantDisplayMap = async (participantIds: string[]): Promise<Record<string, string>> => {
  if (!participantIds || participantIds.length === 0) {
    return {};
  }
  const lookup = await query<{ id: string; name: string | null }>(
    `SELECT id::text AS id,
            COALESCE(NULLIF(TRIM(name), ''), 'HumanChat member') AS name
       FROM users
      WHERE id = ANY($1::uuid[])`,
    [participantIds]
  );

  return lookup.rows.reduce<Record<string, string>>((map, row) => {
    if (row.id) {
      map[row.id] = row.name ?? 'HumanChat member';
    }
    return map;
  }, {});
};

export const attachParticipantLabels = async (conversation: Conversation): Promise<Conversation> => {
  if (conversation.participant_display_map && Object.keys(conversation.participant_display_map).length > 0) {
    return conversation;
  }

  const map = await buildParticipantDisplayMap(conversation.participants ?? []);
  return {
    ...conversation,
    participant_display_map: map
  };
};
