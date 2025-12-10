import type { ManagedRequest } from '../../../src/lib/db';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ManagedRequestPayload {
  id: string;
  requester_user_id: string;
  target_user_id: string;
  manager_user_id?: string | null;
  representative_name?: string | null;
  message: string;
  preferred_time?: string | null;
  budget_range?: string | null;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

export interface CreateConnectionRequestInput {
  targetUserId: string;
  message: string;
  preferredTime?: string;
  budgetRange?: string;
}

const toCamelRequest = (request: ManagedRequestPayload): ManagedRequest => ({
  requestId: request.id,
  requesterId: request.requester_user_id,
  targetUserId: request.target_user_id,
  managerId: request.manager_user_id ?? null,
  representativeName: request.representative_name ?? null,
  message: request.message,
  preferredTime: request.preferred_time ?? null,
  budgetRange: request.budget_range ?? null,
  status: request.status,
  createdAt: Date.parse(request.created_at)
});

export const fetchManagedRequests = async (): Promise<ManagedRequest[]> => {
  const response = await fetch(`${API_BASE_URL}/api/requests`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Unable to load requests.');
  }

  const payload = await response.json();
  const rows = (payload?.requests ?? []) as ManagedRequestPayload[];
  return rows.map((row) => toCamelRequest(row));
};

export const submitConnectionRequest = async (input: CreateConnectionRequestInput) => {
  const response = await fetch(`${API_BASE_URL}/api/requests`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_user_id: input.targetUserId,
      message: input.message,
      preferred_time: input.preferredTime || undefined,
      budget_range: input.budgetRange || undefined
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Unable to send request.');
  }

  const payload = await response.json();
  if (!payload?.request) {
    throw new Error('Malformed request response.');
  }
  return {
    api: payload.request as ManagedRequestPayload,
    local: toCamelRequest(payload.request as ManagedRequestPayload)
  };
};

export const updateRequestStatus = async (
  requestId: string,
  status: ManagedRequestPayload['status']
): Promise<ManagedRequest> => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${requestId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Unable to update request.');
  }

  const payload = await response.json();
  const request = payload?.request as ManagedRequestPayload | undefined;
  if (!request) {
    throw new Error('Malformed request status response.');
  }
  return toCamelRequest(request);
};
