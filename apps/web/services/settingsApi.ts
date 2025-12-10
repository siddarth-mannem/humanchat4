const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ConnectionType = 'free' | 'paid' | 'charity';

export interface CharityOption {
  id: string;
  name: string;
  description?: string;
}

export interface UserSettingsRecord {
  isOnline: boolean;
  conversationType: ConnectionType;
  instantRatePerMinute: number | null;
  charityId: string | null;
  donationPreference: boolean;
  calendarConnected: boolean;
  stripeConnected: boolean;
  onboardingComplete: boolean;
}

interface SettingsResponsePayload {
  settings: UserSettingsRecord;
  charities: CharityOption[];
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

const normalizeSettingsPayload = (payload: unknown): SettingsResponsePayload => {
  const root = (payload as Record<string, unknown>) ?? {};
  const data = (root.data as Record<string, unknown>) ?? root;
  const settingsSource = (data.settings as Record<string, unknown>) ?? data;

  const coerceNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const settings: UserSettingsRecord = {
    isOnline: Boolean(settingsSource.is_online ?? settingsSource.isOnline ?? false),
    conversationType: (settingsSource.conversation_type ?? settingsSource.conversationType ?? 'free') as ConnectionType,
    instantRatePerMinute: coerceNumber(settingsSource.instant_rate_per_minute ?? settingsSource.instantRatePerMinute ?? null),
    charityId: (settingsSource.charity_id ?? settingsSource.charityId ?? null) as string | null,
    donationPreference: Boolean(settingsSource.donation_preference ?? settingsSource.donationPreference ?? false),
    calendarConnected: Boolean(settingsSource.calendar_connected ?? settingsSource.calendarConnected ?? false),
    stripeConnected: Boolean(settingsSource.stripe_connected ?? settingsSource.stripeConnected ?? false),
    onboardingComplete: Boolean(settingsSource.onboarding_complete ?? settingsSource.onboardingComplete ?? false)
  };

  const charitiesArray = (data.charities as CharityOption[] | undefined) ?? [];

  return { settings, charities: charitiesArray };
};

export const fetchUserSettings = async (): Promise<SettingsResponsePayload> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/settings`, withCredentials()));
  return normalizeSettingsPayload(payload);
};

export const patchAvailability = async (isOnline: boolean): Promise<UserSettingsRecord> => {
  const payload = await handleResponse(
    await fetch(`${API_BASE_URL}/api/settings/availability`, {
      ...withCredentials({ method: 'PATCH' }),
      body: JSON.stringify({ is_online: isOnline })
    })
  );
  return normalizeSettingsPayload(payload).settings;
};

interface ConnectionPayload {
  conversationType: ConnectionType;
  instantRatePerMinute: number | null;
  charityId: string | null;
  donationPreference: boolean;
}

export const patchConnectionSettings = async (input: ConnectionPayload): Promise<UserSettingsRecord> => {
  const body: Record<string, unknown> = {
    conversation_type: input.conversationType,
    donation_preference: input.donationPreference
  };
  const normalizedInstantRate =
    typeof input.instantRatePerMinute === 'number' && Number.isFinite(input.instantRatePerMinute)
      ? input.instantRatePerMinute
      : undefined;
  if (input.conversationType === 'paid' && normalizedInstantRate !== undefined) {
    body.instant_rate_per_minute = normalizedInstantRate;
  }
  if (input.charityId !== undefined) {
    body.charity_id = input.charityId;
  }
  const payload = await handleResponse(
    await fetch(`${API_BASE_URL}/api/settings/connection`, {
      ...withCredentials({ method: 'PATCH' }),
      body: JSON.stringify(body)
    })
  );
  return normalizeSettingsPayload(payload).settings;
};

export const connectCalendar = async (): Promise<{ redirectUrl?: string }> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/calendar/connect`, withCredentials({ method: 'POST' })));
  const data = (payload.data ?? payload) as Record<string, unknown>;
  return { redirectUrl: (data.url ?? data.redirectUrl ?? null) as string | undefined };
};

export const disconnectCalendar = async (): Promise<UserSettingsRecord> => {
  const payload = await handleResponse(
    await fetch(`${API_BASE_URL}/api/calendar/disconnect`, withCredentials({ method: 'POST' }))
  );
  return normalizeSettingsPayload(payload).settings;
};

export const connectStripe = async (): Promise<{ redirectUrl?: string }> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/stripe/connect`, withCredentials({ method: 'POST' })));
  const data = (payload.data ?? payload) as Record<string, unknown>;
  return { redirectUrl: (data.url ?? data.redirectUrl ?? null) as string | undefined };
};

export const disconnectStripe = async (): Promise<UserSettingsRecord> => {
  const payload = await handleResponse(
    await fetch(`${API_BASE_URL}/api/stripe/disconnect`, withCredentials({ method: 'POST' }))
  );
  return normalizeSettingsPayload(payload).settings;
};

export const markOnboardingComplete = async (): Promise<UserSettingsRecord> => {
  const payload = await handleResponse(
    await fetch(`${API_BASE_URL}/api/settings`, {
      ...withCredentials({ method: 'PATCH' }),
      body: JSON.stringify({ onboarding_complete: true })
    })
  );
  return normalizeSettingsPayload(payload).settings;
};
