import type { Action, SamShowcaseProfile } from '../../../src/lib/db';
import { getAuthToken } from '../lib/firebaseClient';

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

export const sendSamMessage = async ({
  conversationId,
  message,
  conversationHistory,
  userContext
}: SendSamMessageInput): Promise<SamApiResponse> => {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/sam/chat?conversationId=${encodeURIComponent(conversationId)}`, {
    method: 'POST',
    headers,
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
  
  // Unwrap the { success: true, data: {...} } wrapper
  const actualData = payload?.success ? payload.data : payload;
  
  if (actualData?.text || actualData?.actions) {
    return actualData as SamApiResponse;
  }
  return actualData?.message ?? actualData;
};
