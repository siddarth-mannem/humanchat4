import { validate as uuidValidate } from 'uuid';

import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { Conversation } from '../types/index.js';

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
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
    `SELECT * FROM conversations WHERE $1 = ANY(participants) ORDER BY last_activity DESC`,
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
  senderId: string,
  content: string,
  type: ConversationMessage['message_type'],
  actions?: ConversationMessage['actions']
): Promise<ConversationMessage> => {
  ensureConversationIdIsUuid(conversationId);
  const conversation = await query<Conversation>('SELECT * FROM conversations WHERE id = $1', [conversationId]);
  if (!conversation.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Conversation not found');
  }

  const insert = await query<ConversationMessage>(
    `INSERT INTO messages (conversation_id, sender_id, content, message_type, actions, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
    [conversationId, senderId, content, type, actions ?? null]
  );

  await query('UPDATE conversations SET last_activity = NOW() WHERE id = $1', [conversationId]);

  return insert.rows[0];
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
