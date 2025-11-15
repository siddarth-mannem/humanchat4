import type { Action } from '../../../src/lib/db';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface SamApiResponse {
  text: string;
  actions?: Action[];
}

export const sendSamMessage = async (
  conversationId: string,
  text: string
): Promise<SamApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/sam/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ conversationId, text })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Failed to reach Sam concierge');
  }

  const payload = await response.json();
  if (payload?.text || payload?.actions) {
    return payload as SamApiResponse;
  }
  return payload?.message ?? payload;
};
