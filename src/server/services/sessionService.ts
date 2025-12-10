import { PoolClient } from 'pg';
import { query, transaction } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { redis } from '../db/redis.js';
import { Session } from '../types/index.js';

interface SessionPayload {
  host_user_id: string;
  guest_user_id: string;
  conversation_id: string;
  type: 'instant' | 'scheduled';
  start_time: string;
  duration_minutes: number;
  agreed_price: number;
  payment_mode: 'free' | 'paid' | 'charity';
}

const insertSession = async (client: PoolClient, payload: SessionPayload): Promise<Session> => {
  const insert = await client.query<Session>(
      `INSERT INTO sessions (host_user_id, guest_user_id, conversation_id, type, status, start_time, duration_minutes, agreed_price, payment_mode, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,NOW(),NOW()) RETURNING *`,
      [
        payload.host_user_id,
        payload.guest_user_id,
        payload.conversation_id,
        payload.type,
        payload.start_time,
        payload.duration_minutes,
        payload.agreed_price,
        payload.payment_mode
      ]
    );

  await client.query('UPDATE conversations SET linked_session_id = $1 WHERE id = $2', [
    insert.rows[0].id,
    payload.conversation_id
  ]);

  await redis.publish('status', JSON.stringify({ type: 'user_busy', userId: payload.host_user_id }));

  return insert.rows[0];
};

export const createSessionRecord = async (payload: SessionPayload, client?: PoolClient): Promise<Session> => {
  if (client) {
    return insertSession(client, payload);
  }
  return transaction((txClient) => insertSession(txClient, payload));
};

export const getSessionById = async (id: string): Promise<Session> => {
  const result = await query<Session>('SELECT * FROM sessions WHERE id = $1', [id]);
  const session = result.rows[0];
  if (!session) {
    throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  }
  return session;
};

export const updateSessionStatus = async (id: string, status: Session['status']): Promise<Session> => {
  const result = await query<Session>(
    'UPDATE sessions SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id, status]
  );
  const session = result.rows[0];
  if (!session) {
    throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  }
  await redis.publish('session', JSON.stringify({ sessionId: id, status }));
  return session;
};

export const markSessionStart = async (id: string): Promise<Session> => {
  const result = await query<Session>(
    'UPDATE sessions SET status = $2, start_time = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
    [id, 'in_progress']
  );
  if (!result.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  }
  await redis.publish('session', JSON.stringify({ sessionId: id, event: 'start' }));
  return result.rows[0];
};

export const markSessionEnd = async (id: string): Promise<Session> => {
  const result = await query<Session>(
    `UPDATE sessions
     SET status = 'complete', end_time = NOW(), duration_minutes = EXTRACT(EPOCH FROM (NOW() - start_time))/60,
         updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Session not found');
  }
  await redis.publish('session', JSON.stringify({ sessionId: id, event: 'end' }));
  return result.rows[0];
};
