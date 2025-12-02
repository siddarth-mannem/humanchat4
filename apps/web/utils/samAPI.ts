import type { Action, SamShowcaseProfile } from '../../../src/lib/db';
import { fetchWithAuthRefresh } from './fetchWithAuthRefresh';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface SamApiResponse {
  text: string;
  actions?: Action[];
  conversationId: string;
}

export interface ConversationHistoryPayload {
  role: 'user' | 'sam';
  content: string;
  timestamp?: string;
}

export interface SamUserContextPayload {
  sidebarState?: Record<string, unknown>;
  timezone?: string;
  availableProfiles?: SamShowcaseProfile[];
  [key: string]: unknown;
}

interface SendSamMessageInput {
  conversationId: string;
  message: string;
  conversationHistory: ConversationHistoryPayload[];
  userContext?: SamUserContextPayload;
}

type SuccessEnvelope<T> = { success: true; data: T };
type ErrorEnvelope = { success: false; error: { code?: string; message: string } };

const unwrapApiPayload = (payload: unknown): SamApiResponse => {
  if (payload && typeof payload === 'object') {
    const envelope = payload as SuccessEnvelope<SamApiResponse> | ErrorEnvelope | SamApiResponse;
    if ('success' in envelope) {
      if (envelope.success) {
        return envelope.data;
      }
      throw new Error(envelope.error?.message ?? 'Sam concierge request failed');
    }
  }

  const candidate = payload as SamApiResponse & { message?: string };
  if (candidate?.text || candidate?.actions || candidate?.conversationId) {
    return candidate;
  }

  if (candidate?.message) {
    return {
      text: candidate.message,
      actions: candidate.actions,
      conversationId: candidate.conversationId
    } as SamApiResponse;
  }

  throw new Error('Unexpected response from Sam concierge');
};

export const sendSamMessage = async ({
  conversationId,
  message,
  conversationHistory,
  userContext
}: SendSamMessageInput): Promise<SamApiResponse> => {
  const response = await fetchWithAuthRefresh(`${API_BASE_URL}/api/sam/chat?conversationId=${encodeURIComponent(conversationId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      message,
      conversationHistory,
      userContext
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Failed to reach Sam concierge');
  }

  const payload = await response.json();
  return unwrapApiPayload(payload);
};
