/**
 * Call API service
 * REST API client for call endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface StartCallRequest {
  conversationId: string;
  callType: 'video' | 'audio';
  idempotencyKey?: string;
}

interface StartCallResponse {
  callId: string;
  status: string;
  liveKitToken: string;
  roomName: string;
  participants: {
    caller: {
      userId: string;
      name: string;
      avatar?: string;
    };
    callee: {
      userId: string;
      name: string;
      avatar?: string;
    };
  };
  initiatedAt: string;
}

interface AcceptCallResponse {
  callId: string;
  status: string;
  liveKitToken: string;
  roomName: string;
  acceptedAt: string;
}

/**
 * Fetch with credentials (cookies)
 */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  console.log('[fetchWithAuth] Request:', {
    url,
    method: options.method || 'GET',
    hasCookies: document.cookie.length > 0,
    cookies: document.cookie.substring(0, 100) + '...',
  });

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  console.log('[fetchWithAuth] Response:', {
    url,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers as any),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    console.error('[fetchWithAuth] Error response:', {
      status: response.status,
      error,
    });
    throw {
      status: response.status,
      message: error.message || `HTTP ${response.status}`,
      ...error,
    };
  }

  return response.json();
}

/**
 * Start a new call
 */
export async function startCall(request: StartCallRequest): Promise<StartCallResponse> {
  console.log('[callApi] startCall request:', request);
  return fetchWithAuth(`${API_BASE_URL}/api/calls/start`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Accept an incoming call
 */
export async function acceptCall(callId: string): Promise<AcceptCallResponse> {
  console.log('[callApi] acceptCall:', { callId, apiUrl: API_BASE_URL });
  try {
    const result = await fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/accept`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    console.log('[callApi] acceptCall success:', result);
    return result;
  } catch (error) {
    console.error('[callApi] acceptCall error:', error);
    throw error;
  }
}

/**
 * Decline an incoming call
 */
export async function declineCall(
  callId: string,
  reason: 'busy' | 'declined' | 'other' = 'declined'
): Promise<void> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * End an active call
 */
export async function endCall(
  callId: string,
  endReason: 'normal' | 'timeout' | 'error' = 'normal'
): Promise<void> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/end`, {
    method: 'POST',
    body: JSON.stringify({ endReason }),
  });
}

/**
 * Mark call as connected (when both parties join)
 */
export async function markCallConnected(callId: string): Promise<void> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/connected`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Get call details
 */
export async function getCall(callId: string): Promise<any> {
  console.log('[callApi] getCall:', { callId, apiUrl: API_BASE_URL });
  try {
    const result = await fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}`);
    console.log('[callApi] getCall success:', result);
    return result;
  } catch (error) {
    console.error('[callApi] getCall error:', error);
    throw error;
  }
}
