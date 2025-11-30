const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ConversationCategory = 'free' | 'paid' | 'charity';

export interface ScheduledRateEntry {
  durationMinutes: number;
  price: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  conversationType: ConversationCategory;
  instantRatePerMinute: number | null;
  scheduledRates: ScheduledRateEntry[];
  donationPreference: 'on' | 'off' | null;
  charityId: string | null;
  charityName: string | null;
  isOnline: boolean;
  hasActiveSession: boolean;
  managed: boolean;
  managerId: string | null;
  managerDisplayName: string | null;
  displayMode: 'normal' | 'by_request' | 'confidential' | null;
  confidentialRate: boolean | null;
  updatedAt: string;
}

interface UserProfileApiResponse {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  conversation_type: ConversationCategory;
  instant_rate_per_minute: number | null;
  scheduled_rates: Record<string, number> | null;
  donation_preference: 'on' | 'off' | null;
  charity_id: string | null;
  charity_name: string | null;
  is_online: boolean;
  has_active_session: boolean;
  managed: boolean;
  manager_id: string | null;
  manager_display_name?: string | null;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  confidential_rate: boolean | null;
  updated_at: string;
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Request failed');
  }
  return response.json();
};

const withCredentials = (init: RequestInit = {}): RequestInit => ({
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    ...(init.headers ?? {})
  },
  ...init
});

const unwrap = <T>(payload: unknown, key?: string): T => {
  if (payload && typeof payload === 'object') {
    const bag = payload as Record<string, unknown> & { data?: Record<string, unknown> };
    if (key) {
      if (bag[key] !== undefined) return bag[key] as T;
      if (bag.data && bag.data[key] !== undefined) return bag.data[key] as T;
    }
    if (bag.data !== undefined) {
      return bag.data as T;
    }
  }
  return payload as T;
};

const toScheduledRateArray = (rates: Record<string, number> | null): ScheduledRateEntry[] => {
  if (!rates) return [];
  return Object.entries(rates)
    .map(([duration, price]) => ({ durationMinutes: Number(duration), price }))
    .filter((entry) => Number.isFinite(entry.durationMinutes) && Number.isFinite(entry.price))
    .sort((a, b) => a.durationMinutes - b.durationMinutes);
};

const toScheduledRateRecord = (rates?: ScheduledRateEntry[] | null): Record<string, number> | undefined => {
  if (!rates) return undefined;
  const record: Record<string, number> = {};
  for (const rate of rates) {
    if (!Number.isFinite(rate.durationMinutes) || !Number.isFinite(rate.price)) {
      continue;
    }
    if (rate.durationMinutes <= 0 || rate.price <= 0) {
      continue;
    }
    record[String(Math.round(rate.durationMinutes))] = Math.round(rate.price * 100) / 100;
  }
  return Object.keys(record).length > 0 ? record : undefined;
};

const mapApiProfile = (record: UserProfileApiResponse): UserProfile => ({
  id: record.id,
  name: record.name,
  email: record.email,
  avatarUrl: record.avatar_url,
  headline: record.headline,
  bio: record.bio,
  conversationType: record.conversation_type,
  instantRatePerMinute: record.instant_rate_per_minute,
  scheduledRates: toScheduledRateArray(record.scheduled_rates),
  donationPreference: record.donation_preference ?? null,
  charityId: record.charity_id,
  charityName: record.charity_name,
  isOnline: record.is_online,
  hasActiveSession: record.has_active_session,
  managed: record.managed,
  managerId: record.manager_id,
  managerDisplayName: record.manager_display_name ?? null,
  displayMode: record.display_mode ?? null,
  confidentialRate: record.confidential_rate,
  updatedAt: record.updated_at
});

export interface ProfileUpdateInput {
  headline?: string | null;
  bio?: string | null;
  conversationType?: ConversationCategory;
  instantRatePerMinute?: number | null;
  scheduledRates?: ScheduledRateEntry[] | null;
  isOnline?: boolean;
  hasActiveSession?: boolean;
}

export const fetchUserProfile = async (id: string): Promise<UserProfile> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/users/${id}`, withCredentials()));
  const user = unwrap<UserProfileApiResponse>(payload, 'user');
  return mapApiProfile(user);
};

export const updateUserProfile = async (id: string, updates: ProfileUpdateInput): Promise<UserProfile> => {
  const payload: Record<string, unknown> = {};
  if ('headline' in updates) {
    payload.headline = updates.headline ?? null;
  }
  if ('bio' in updates) {
    payload.bio = updates.bio ?? null;
  }
  if ('conversationType' in updates && updates.conversationType) {
    payload.conversation_type = updates.conversationType;
  }
  if ('instantRatePerMinute' in updates) {
    payload.instant_rate_per_minute = updates.instantRatePerMinute ?? null;
  }
  if ('scheduledRates' in updates) {
    payload.scheduled_rates = toScheduledRateRecord(updates.scheduledRates ?? null);
  }
  if ('isOnline' in updates) {
    payload.is_online = Boolean(updates.isOnline);
  }
  if ('hasActiveSession' in updates) {
    payload.has_active_session = Boolean(updates.hasActiveSession);
  }

  const response = await handleResponse(
    await fetch(`${API_BASE_URL}/api/users/${id}`, {
      ...withCredentials({ method: 'PATCH' }),
      body: JSON.stringify(payload)
    })
  );
  const user = unwrap<UserProfileApiResponse>(response, 'user');
  return mapApiProfile(user);
};
