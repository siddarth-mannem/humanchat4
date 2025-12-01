import { query } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../types/index.js';
import type { PresenceState } from './presenceService.js';

const HUMAN_FALLBACK = 'Human';

const normalizeProfileCopy = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : HUMAN_FALLBACK;
};

const applyHumanDefaults = <T extends Pick<User, 'headline' | 'bio'>>(record: T): T => {
  return {
    ...record,
    headline: normalizeProfileCopy(record.headline),
    bio: normalizeProfileCopy(record.bio)
  };
};

export const getUserById = async (id: string): Promise<User> => {
  const result = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  return applyHumanDefaults(user);
};

export const updateUserProfile = async (id: string, updates: Partial<User>): Promise<User> => {
  const fields = Object.keys(updates);
  if (fields.length === 0) {
    return getUserById(id);
  }

  const setFragments = fields.map((field, index) => `${field} = $${index + 2}`);
  const values = Object.values(updates);

  await query<User>(`UPDATE users SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
  return getUserById(id);
};

export const searchUsers = async (q: string, online?: boolean): Promise<User[]> => {
  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(headline) LIKE $${params.length})`;
  }

  if (online !== undefined) {
    params.push(online);
    where += ` AND is_online = $${params.length}`;
  }

  const sql = `SELECT * FROM users ${where} ORDER BY is_online DESC, name ASC LIMIT 50`;
  const result = await query<User>(sql, params);
  return result.rows.map(applyHumanDefaults);
};

export const getUserAvailability = async (userId: string): Promise<{ slots: Array<{ start: string; end: string }> }> => {
  // Placeholder: would call calendar service, for now return cached data if exists.
  const cacheKey = `availability:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  const slots = [{ start: new Date().toISOString(), end: new Date(Date.now() + 30 * 60 * 1000).toISOString() }];
  await redis.set(cacheKey, JSON.stringify({ slots }), 'EX', 300);
  return { slots };
};

export const getUserStatus = async (
  userId: string
): Promise<{
  status: 'online' | 'online_in_call' | 'offline' | 'idle';
  presenceState: PresenceState;
  isOnline: boolean;
  hasActiveSession: boolean;
  lastSeenAt: string | null;
}> => {
  const result = await query<User>(
    'SELECT is_online, has_active_session, presence_state, last_seen_at FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  const presenceState = (user.presence_state as PresenceState) ?? (user.is_online ? 'active' : 'offline');
  let status: 'online' | 'online_in_call' | 'offline' | 'idle' = 'offline';
  if (!user.is_online) {
    status = 'offline';
  } else if (presenceState === 'idle') {
    status = 'idle';
  } else if (user.has_active_session) {
    status = 'online_in_call';
  } else {
    status = 'online';
  }
  return {
    status,
    presenceState,
    isOnline: user.is_online,
    hasActiveSession: user.has_active_session,
    lastSeenAt: user.last_seen_at ?? null
  };
};
