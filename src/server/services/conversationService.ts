import crypto from 'node:crypto';
import { validate as uuidValidate } from 'uuid';

import { query } from '../db/postgres.js';
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

export const listConversations = async (userId: string): Promise<Conversation[]> => {
  const result = await query<Conversation>(
    `SELECT c.* 
     FROM conversations c
     JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
     WHERE cp.user_id = $1 
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
  const conversation = await query<Conversation>('SELECT * FROM conversations WHERE conversation_id = $1', [conversationId]);
  if (!conversation.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Conversation not found');
  }

  const serializedActions = actions ? JSON.stringify(actions) : null;

  const runInsert = async (actionsJson: string | null) => {
    const timestamp = Date.now();
    const inserted = await query<ConversationMessage>(
      `INSERT INTO messages (conversation_id, sender_id, content, timestamp, type, actions, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW()) RETURNING *`,
      [conversationId, senderId ?? null, content, timestamp, type, actionsJson]
    );
    await query('UPDATE conversations SET last_activity = $1 WHERE conversation_id = $2', [timestamp, conversationId]);
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
    `SELECT c.*
     FROM conversations c
     JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
     WHERE c.type = 'sam' AND cp.user_id = $1
     ORDER BY c.created_at DESC
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

  const conversationId = crypto.randomUUID();
  const timestamp = Date.now();
  
  // Insert conversation
  const insert = await query<Conversation>(
    `INSERT INTO conversations (conversation_id, type, last_activity)
     VALUES ($1, 'sam', $2)
     RETURNING *`,
    [conversationId, timestamp]
  );

  // Insert participant
  await query(
    `INSERT INTO conversation_participants (conversation_id, user_id)
     VALUES ($1, $2)`,
    [conversationId, userId]
  );

  return insert.rows[0];
};
