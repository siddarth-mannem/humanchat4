const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const REFRESH_ENDPOINT = `${API_BASE_URL.replace(/\/$/, '')}/api/auth/refresh`;

const refreshSession = async (): Promise<boolean> => {
  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Session refresh failed', error);
    return false;
  }
};

export const fetchWithAuthRefresh = async (input: RequestInfo | URL, init?: RequestInit, attempt = 0): Promise<Response> => {
  const response = await fetch(input, init);
  if (response.status !== 401 || attempt > 0) {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return response;
  }

  return fetchWithAuthRefresh(input, init, attempt + 1);
};
