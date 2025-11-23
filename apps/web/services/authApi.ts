const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type UserRole = 'user' | 'admin' | 'manager';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Request failed');
  }
  return response.json();
};

export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
  const result = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include'
  });
  if (result.status === 401) {
    return null;
  }
  const payload = await handleResponse(result);
  return payload.user ?? null;
};

export const logout = async (): Promise<void> => {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
};
