import { query } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../types/index.js';
import { logger } from '../utils/logger.js';

export type PresenceState = 'active' | 'idle' | 'offline';

const STATE_VALUES: PresenceState[] = ['active', 'idle', 'offline'];
const DEFAULT_STALE_SECONDS = 120;
const DEFAULT_SWEEP_INTERVAL = 60000;

let sweepTimer: ReturnType<typeof setInterval> | null = null;

const normalizeState = (state: string): PresenceState => {
  const match = STATE_VALUES.find((value) => value === state);
  if (!match) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported presence state');
  }
  return match;
};

const publishPresence = (user: User): void => {
  void redis.publish(
    'status',
    JSON.stringify({
      type: 'presence',
      userId: user.id,
      isOnline: user.is_online,
      hasActiveSession: user.has_active_session,
      presenceState: user.presence_state,
      lastSeenAt: user.last_seen_at ? new Date(user.last_seen_at).getTime() : Date.now()
    })
  );
};

export const updateUserPresence = async (userId: string, state: PresenceState): Promise<User> => {
  const normalized = normalizeState(state);
  const result = await query<User>(
    `UPDATE users
     SET is_online = $2,
         presence_state = $3,
         last_seen_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, normalized !== 'offline', normalized]
  );

  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }

  publishPresence(user);
  return user;
};

export const recordHeartbeat = async (userId: string): Promise<User> => {
  const result = await query<User>(
    `UPDATE users
     SET last_seen_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  publishPresence(user);
  return user;
};

export const expireStalePresence = async (thresholdSeconds = DEFAULT_STALE_SECONDS): Promise<number> => {
  const interval = `${thresholdSeconds} seconds`;
  const result = await query<User>(
    `UPDATE users
     SET is_online = FALSE,
         presence_state = 'offline',
         updated_at = NOW()
     WHERE is_online = TRUE
       AND (last_seen_at IS NULL OR last_seen_at < NOW() - ($1::interval))
     RETURNING *`,
    [interval]
  );

  if (result.rowCount && result.rowCount > 0) {
    result.rows.forEach((user) => publishPresence(user));
    logger.info(`[presence] Reset ${result.rowCount} stale user(s) to offline`);
  }

  return result.rowCount ?? 0;
};

export const startPresenceSweep = (
  options: { intervalMs?: number; staleSeconds?: number } = {}
): (() => void) => {
  const { intervalMs = DEFAULT_SWEEP_INTERVAL, staleSeconds = DEFAULT_STALE_SECONDS } = options;
  if (sweepTimer) {
    return () => {
      /* no-op when already running */
    };
  }

  const runSweep = async () => {
    try {
      await expireStalePresence(staleSeconds);
    } catch (error) {
      logger.error('[presence] Failed to sweep stale users', error);
    }
  };

  void runSweep();
  sweepTimer = setInterval(runSweep, intervalMs);

  return () => {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  };
};

export const stopPresenceSweep = (): void => {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};
