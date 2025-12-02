import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { Request, UserRole } from '../types/index.js';

export interface CreateRequestInput {
  requester_user_id: string;
  target_user_id: string;
  message: string;
  preferred_time?: string | null;
  budget_range?: string | null;
}

export const createRequest = async (input: CreateRequestInput): Promise<Request> => {
  const targetUser = await query<{ managed: boolean; confidential_rate: boolean | null; manager_user_id: string | null; representative_name: string | null }>(
    `SELECT u.managed, u.confidential_rate, u.manager_id AS manager_user_id, m.name AS representative_name
     FROM users u
     LEFT JOIN users m ON u.manager_id = m.id
     WHERE u.id = $1`,
    [input.target_user_id]
  );

  const target = targetUser.rows[0];
  if (!target) {
    throw new ApiError(404, 'NOT_FOUND', 'Target user not found');
  }
  if (!target.managed || !target.confidential_rate) {
    throw new ApiError(422, 'INVALID_REQUEST', 'This profile does not accept managed requests.');
  }

  const insert = await query<Request>(
    `INSERT INTO requests (requester_user_id, target_user_id, manager_user_id, representative_name, message, preferred_time, budget_range, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',NOW()) RETURNING *`,
    [
      input.requester_user_id,
      input.target_user_id,
      target.manager_user_id,
      target.representative_name,
      input.message,
      input.preferred_time ?? null,
      input.budget_range ?? null
    ]
  );
  return insert.rows[0];
};

export const listRequests = async (managerId: string): Promise<Request[]> => {
  const result = await query<Request>(
    `SELECT r.*
     FROM requests r
     JOIN users u ON r.target_user_id = u.id
     WHERE u.manager_id = $1
     ORDER BY r.created_at DESC`,
    [managerId]
  );
  return result.rows;
};

interface RequestActor {
  id: string;
  role: UserRole;
}

const assertActorCanUpdate = (request: Request, actor: RequestActor): void => {
  const isAdmin = actor.role === 'admin';
  const isManager = request.manager_user_id === actor.id;
  const isTarget = request.target_user_id === actor.id;

  if (isAdmin || isManager || isTarget) {
    return;
  }

  throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to update this request.');
};

export const updateRequestStatus = async (requestId: string, status: Request['status'], actor: RequestActor): Promise<Request> => {
  const existing = await query<Request>('SELECT * FROM requests WHERE id = $1', [requestId]);
  const request = existing.rows[0];
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Request not found');
  }

  assertActorCanUpdate(request, actor);

  const result = await query<Request>('UPDATE requests SET status = $2 WHERE id = $1 RETURNING *', [requestId, status]);
  return result.rows[0];
};
