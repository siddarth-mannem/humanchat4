import crypto from 'node:crypto';
import { query } from '../db/postgres.js';
import { redis } from '../db/redis.js';
import { ApiError } from '../errors/ApiError.js';
import { RequestedPerson, Request, Session, User, UserRole } from '../types/index.js';

interface UserTotalsRow {
  total_users: number;
  managed_users: number;
  online_users: number;
  admin_users: number;
}

interface SessionStatsRow {
  active_sessions: number;
  pending_sessions: number;
  completed_today: number;
}

interface RequestStatsRow {
  pending_requests: number;
  managed_requests: number;
}

interface RevenueStatsRow {
  gross_today: number;
  gross_7d: number;
  gross_30d: number;
  donation_30d: number;
}

interface SparklineRow {
  day: string;
  active_sessions: number;
  revenue_amount: number;
}

export interface AdminOverviewMetrics {
  totals: {
    users: number;
    managed: number;
    online: number;
    admins: number;
  };
  sessions: {
    active: number;
    pending: number;
    completedToday: number;
  };
  requests: {
    pending: number;
    requestedPeoplePending: number;
  };
  revenue: {
    today: number;
    last7Days: number;
    last30Days: number;
    donations30d: number;
  };
  sparkline: Array<{ date: string; activeSessions: number; revenue: number }>;
}

interface AdminUserRow extends User {
  manager_name: string | null;
}

export interface AdminUserSummary extends User {
  manager_name: string | null;
}

export interface AdminUserFilters {
  search?: string;
  role?: UserRole;
  managed?: boolean;
  limit?: number;
}

export interface UpdateAdminUserInput {
  role?: UserRole;
  managed?: boolean;
  managerId?: string | null;
  displayMode?: User['display_mode'];
  isOnline?: boolean;
  hasActiveSession?: boolean;
  instantRatePerMinute?: number | null;
  headline?: string | null;
  bio?: string | null;
}

const COLUMN_MAP: Record<keyof UpdateAdminUserInput, string> = {
  role: 'role',
  managed: 'managed',
  managerId: 'manager_id',
  displayMode: 'display_mode',
  isOnline: 'is_online',
  hasActiveSession: 'has_active_session',
  instantRatePerMinute: 'instant_rate_per_minute',
  headline: 'headline',
  bio: 'bio'
};

const tableExists = async (name: string): Promise<boolean> => {
  const result = await query<{ exists: boolean }>('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${name}`]);
  return Boolean(result.rows[0]?.exists);
};

export const getAdminOverviewMetrics = async (): Promise<AdminOverviewMetrics> => {
  const [userTotalsResult, sessionStatsResult, requestStatsResult, requestedPeopleResult] = await Promise.all([
    query<UserTotalsRow>(
      `SELECT COUNT(*)::int AS total_users,
              COUNT(*) FILTER (WHERE managed)::int AS managed_users,
              COUNT(*) FILTER (WHERE is_online)::int AS online_users,
              COUNT(*) FILTER (WHERE role = 'admin')::int AS admin_users
       FROM users`
    ),
    query<SessionStatsRow>(
      `SELECT COUNT(*) FILTER (WHERE status = 'in_progress')::int AS active_sessions,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_sessions,
              COUNT(*) FILTER (WHERE status = 'complete' AND DATE(updated_at) = CURRENT_DATE)::int AS completed_today
       FROM sessions`
    ),
    query<RequestStatsRow>(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_requests,
              COUNT(*) FILTER (WHERE manager_id IS NOT NULL)::int AS managed_requests
       FROM requests`
    ),
    query<{ pending_people: number }>(`SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_people FROM requested_people`)
  ]);

  const overview: AdminOverviewMetrics = {
    totals: {
      users: userTotalsResult.rows[0]?.total_users ?? 0,
      managed: userTotalsResult.rows[0]?.managed_users ?? 0,
      online: userTotalsResult.rows[0]?.online_users ?? 0,
      admins: userTotalsResult.rows[0]?.admin_users ?? 0
    },
    sessions: {
      active: sessionStatsResult.rows[0]?.active_sessions ?? 0,
      pending: sessionStatsResult.rows[0]?.pending_sessions ?? 0,
      completedToday: sessionStatsResult.rows[0]?.completed_today ?? 0
    },
    requests: {
      pending: requestStatsResult.rows[0]?.pending_requests ?? 0,
      requestedPeoplePending: requestedPeopleResult.rows[0]?.pending_people ?? 0
    },
    revenue: {
      today: 0,
      last7Days: 0,
      last30Days: 0,
      donations30d: 0
    },
    sparkline: []
  };

  if (await tableExists('session_payments')) {
    const [revenueStatsResult, sparklineResult] = await Promise.all([
      query<RevenueStatsRow>(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) AS gross_today,
           COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) AS gross_7d,
           COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS gross_30d,
           COALESCE(SUM(donation_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS donation_30d
         FROM session_payments`
      ),
      query<SparklineRow>(
        `WITH day_series AS (
           SELECT generate_series(CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE, '1 day')::date AS day
         )
         SELECT ds.day,
                COALESCE(
                  (
                    SELECT COUNT(*)
                    FROM sessions s
                    WHERE DATE(s.updated_at) = ds.day AND s.status IN ('in_progress','complete')
                  ),
                  0
                ) AS active_sessions,
                COALESCE(
                  (
                    SELECT SUM(amount)
                    FROM session_payments sp
                    WHERE DATE(sp.created_at) = ds.day
                  ),
                  0
                ) AS revenue_amount
         FROM day_series ds
         ORDER BY ds.day`
      )
    ]);

    const revenueRow = revenueStatsResult.rows[0];
    if (revenueRow) {
      overview.revenue.today = Math.round((revenueRow.gross_today ?? 0) / 100);
      overview.revenue.last7Days = Math.round((revenueRow.gross_7d ?? 0) / 100);
      overview.revenue.last30Days = Math.round((revenueRow.gross_30d ?? 0) / 100);
      overview.revenue.donations30d = Math.round((revenueRow.donation_30d ?? 0) / 100);
    }

    overview.sparkline = sparklineResult.rows.map((row) => ({
      date: row.day,
      activeSessions: Number(row.active_sessions ?? 0),
      revenue: Math.round((row.revenue_amount ?? 0) / 100)
    }));
  }

  return overview;
};

export const listUsersForAdmin = async (filters: AdminUserFilters = {}): Promise<AdminUserSummary[]> => {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    clauses.push(`(LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }

  if (filters.role) {
    params.push(filters.role);
    clauses.push(`u.role = $${params.length}`);
  }

  if (typeof filters.managed === 'boolean') {
    params.push(filters.managed);
    clauses.push(`u.managed = $${params.length}`);
  }

  const limit = filters.limit ?? 50;
  params.push(limit);

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query<AdminUserRow>(
    `SELECT u.*, m.name AS manager_name
     FROM users u
     LEFT JOIN users m ON u.manager_id = m.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
};

export const updateUserAdminFields = async (userId: string, updates: UpdateAdminUserInput): Promise<User> => {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    const result = await query<User>('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }
    return user;
  }

  const setFragments: string[] = [];
  const params: unknown[] = [userId];

  entries.forEach(([key, value], index) => {
    const column = COLUMN_MAP[key as keyof UpdateAdminUserInput];
    if (!column) {
      return;
    }
    setFragments.push(`${column} = $${index + 2}`);
    params.push(value);
  });

  if (setFragments.length === 0) {
    throw new ApiError(400, 'INVALID_REQUEST', 'No supported fields to update');
  }

  const result = await query<User>(
    `UPDATE users
     SET ${setFragments.join(', ')}, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    params
  );

  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  return user;
};

interface AdminSessionRow extends Session {
  host_name: string;
  guest_name: string;
}

export interface AdminSessionSummary extends Session {
  host_name: string;
  guest_name: string;
}

export const listRecentSessions = async (limit = 40): Promise<AdminSessionSummary[]> => {
  const result = await query<AdminSessionRow>(
    `SELECT s.*, host.name AS host_name, guest.name AS guest_name
     FROM sessions s
     JOIN users host ON host.id = s.host_user_id
     JOIN users guest ON guest.id = s.guest_user_id
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

interface AdminRequestRow extends Request {
  target_name: string;
  requester_name: string;
}

export interface AdminRequestSummary extends Request {
  target_name: string;
  requester_name: string;
}

export const listPendingManagedRequests = async (): Promise<AdminRequestSummary[]> => {
  const result = await query<AdminRequestRow>(
    `SELECT r.*, target.name AS target_name, requester.name AS requester_name
     FROM requests r
     JOIN users target ON target.id = r.target_user_id
     JOIN users requester ON requester.id = r.requester_user_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at DESC
     LIMIT 100`
  );
  return result.rows;
};

export const listRequestedPeopleForAdmin = async (): Promise<RequestedPerson[]> => {
  const result = await query<RequestedPerson>(
    `SELECT * FROM requested_people
     ORDER BY request_count DESC, last_requested_at DESC
     LIMIT 100`
  );
  return result.rows;
};

export interface AdminAnnouncement {
  id: string;
  message: string;
  createdAt: string;
  authorId: string;
}

const ADMIN_FEED_KEY = 'admin:announcements';

export const publishAdminAnnouncement = async (authorId: string, message: string): Promise<void> => {
  const payload: AdminAnnouncement = {
    id: crypto.randomUUID(),
    message,
    authorId,
    createdAt: new Date().toISOString()
  };
  await redis.lpush(ADMIN_FEED_KEY, JSON.stringify(payload));
  await redis.ltrim(ADMIN_FEED_KEY, 0, 49);
};

export const listAdminAnnouncements = async (): Promise<AdminAnnouncement[]> => {
  const raw = await redis.lrange(ADMIN_FEED_KEY, 0, 19);
  return raw
    .map((entry: string) => {
      try {
        return JSON.parse(entry) as AdminAnnouncement;
      } catch {
        return null;
      }
    })
    .filter((entry: AdminAnnouncement | null): entry is AdminAnnouncement => Boolean(entry));
};