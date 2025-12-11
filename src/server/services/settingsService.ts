import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import type { PresenceState } from './presenceService.js';
import { updateUserPresence } from './presenceService.js';

export type ConnectionPreference = 'free' | 'paid' | 'charity';

export interface CharityOption {
  id: string;
  name: string;
  description?: string;
}

export interface SettingsRecord {
  isOnline: boolean;
  conversationType: ConnectionPreference;
  instantRatePerMinute: number | null;
  charityId: string | null;
  donationPreference: boolean;
  calendarConnected: boolean;
  stripeConnected: boolean;
  onboardingComplete: boolean;
}

const FALLBACK_CHARITIES: CharityOption[] = [
  { id: 'climate-action', name: 'Climate Action Network', description: 'Grassroots projects helping communities respond to climate events.' },
  { id: 'youth-mentorship', name: 'Youth Mentorship Initiative', description: 'Pairing first-generation students with career mentors.' },
  { id: 'open-access', name: 'Open Access Education Fund', description: 'Scholarships and materials for lifelong learners.' }
];

type RawSettingsRow = {
  id: string;
  is_online: boolean;
  conversation_type: ConnectionPreference | null;
  instant_rate_per_minute: number | null;
  charity_id: string | null;
  donation_preference: string | null;
  stripe_account_id: string | null;
  onboarding_complete: boolean | null;
};

const truthyDonation = new Set(['on', 'true', '1', 'yes']);

const toBooleanPreference = (value: string | boolean | null | undefined): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return truthyDonation.has(value.toLowerCase());
  }
  return false;
};

const toStoredPreference = (value: string | boolean | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    if (value === 'on' || value === 'off') {
      return value;
    }
    return toBooleanPreference(value) ? 'on' : 'off';
  }
  return value ? 'on' : 'off';
};

const hasCalendarConnection = async (userId: string): Promise<boolean> => {
  const result = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM calendar_connections WHERE user_id = $1) AS exists',
    [userId]
  );
  return Boolean(result.rows[0]?.exists);
};

const loadSettingsRow = async (userId: string): Promise<RawSettingsRow> => {
  const result = await query<RawSettingsRow>(
    `SELECT id, is_online, conversation_type, instant_rate_per_minute, charity_id,
            donation_preference, stripe_account_id, onboarding_complete
       FROM users
      WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  return row;
};

const mapSettings = (row: RawSettingsRow, calendarConnected: boolean): SettingsRecord => ({
  isOnline: Boolean(row.is_online),
  conversationType: (row.conversation_type ?? 'free') as ConnectionPreference,
  instantRatePerMinute: typeof row.instant_rate_per_minute === 'number' ? row.instant_rate_per_minute : null,
  charityId: row.charity_id ?? null,
  donationPreference: toBooleanPreference(row.donation_preference),
  calendarConnected,
  stripeConnected: Boolean(row.stripe_account_id),
  onboardingComplete: Boolean(row.onboarding_complete)
});

export const fetchUserSettings = async (userId: string): Promise<{ settings: SettingsRecord; charities: CharityOption[] }> => {
  const [row, calendarConnected] = await Promise.all([loadSettingsRow(userId), hasCalendarConnection(userId)]);
  return {
    settings: mapSettings(row, calendarConnected),
    charities: FALLBACK_CHARITIES
  };
};

export const updateAvailability = async (userId: string, isOnline: boolean): Promise<void> => {
  const nextState: PresenceState = isOnline ? 'active' : 'offline';
  await updateUserPresence(userId, nextState);
};

interface ConnectionUpdates {
  conversation_type?: ConnectionPreference;
  instant_rate_per_minute?: number | null;
  charity_id?: string | null;
  donation_preference?: string | boolean | null;
}

export const updateConnectionSettings = async (userId: string, updates: ConnectionUpdates): Promise<void> => {
  const normalized: Record<string, unknown> = {};

  if (updates.conversation_type) {
    normalized.conversation_type = updates.conversation_type;
    if (updates.conversation_type !== 'paid') {
      normalized.instant_rate_per_minute = null;
    }
    if (updates.conversation_type !== 'charity') {
      normalized.charity_id = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'instant_rate_per_minute')) {
    normalized.instant_rate_per_minute = updates.instant_rate_per_minute ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'charity_id')) {
    normalized.charity_id = updates.charity_id ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'donation_preference')) {
    normalized.donation_preference = toStoredPreference(updates.donation_preference);
  }

  if (Object.keys(normalized).length === 0) {
    return;
  }

  const setFragments = Object.keys(normalized).map((field, index) => `${field} = $${index + 2}`);
  const values = Object.values(normalized);
  await query(
    `UPDATE users SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $1`,
    [userId, ...values]
  );
};

export const completeOnboarding = async (userId: string): Promise<void> => {
  await query('UPDATE users SET onboarding_complete = TRUE, updated_at = NOW() WHERE id = $1', [userId]);
};
