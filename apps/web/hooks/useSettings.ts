'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CharityOption, ConnectionType, UserSettingsRecord } from '../services/settingsApi';
import {
  connectCalendar,
  connectStripe,
  disconnectCalendar,
  disconnectStripe,
  fetchUserSettings,
  markOnboardingComplete,
  patchAvailability,
  patchConnectionSettings
} from '../services/settingsApi';

interface UseSettingsResult {
  settings: UserSettingsRecord | null;
  charities: CharityOption[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  savingAvailability: boolean;
  savingConnection: boolean;
  savingCalendar: boolean;
  savingStripe: boolean;
  updateAvailability: (isOnline: boolean) => Promise<void>;
  saveConnection: (payload: {
    conversationType: ConnectionType;
    instantRatePerMinute: number | null;
    charityId: string | null;
    donationPreference: boolean;
  }) => Promise<void>;
  startCalendarConnect: () => Promise<void>;
  disconnectCalendar: () => Promise<void>;
  startStripeConnect: () => Promise<void>;
  disconnectStripe: () => Promise<void>;
  refresh: () => Promise<void>;
  markOnboardingDone: () => Promise<void>;
}

export const AVAILABILITY_STORAGE_KEY = 'humanchat.availability.expireAt';
export const AVAILABILITY_PROMPT_KEY = 'humanchat.availability.prompt';

export const useSettings = (): UseSettingsResult => {
  const [settings, setSettings] = useState<UserSettingsRecord | null>(null);
  const [charities, setCharities] = useState<CharityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);

  const assignState = useCallback((next: UserSettingsRecord | null) => {
    setSettings(next);
    if (next?.isOnline) {
      const expireAt = Date.now() + 30 * 60 * 1000;
      window.localStorage.setItem(AVAILABILITY_STORAGE_KEY, String(expireAt));
      window.localStorage.removeItem(AVAILABILITY_PROMPT_KEY);
    } else {
      window.localStorage.removeItem(AVAILABILITY_STORAGE_KEY);
    }
  }, []);

  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      const { settings: result, charities } = await fetchUserSettings();
      assignState(result);
      setCharities(charities);
      setError(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to load settings.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [assignState]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { settings: result, charities } = await fetchUserSettings();
      assignState(result);
      setCharities(charities);
      setError(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to refresh settings.';
      setError(detail);
    } finally {
      setRefreshing(false);
    }
  }, [assignState]);

  const updateAvailability = useCallback(
    async (isOnline: boolean) => {
      setSavingAvailability(true);
      try {
        const next = await patchAvailability(isOnline);
        assignState(next);
        setError(null);
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unable to update availability.';
        setError(detail);
      } finally {
        setSavingAvailability(false);
      }
    },
    [assignState]
  );

  const saveConnection = useCallback(
    async (payload: {
      conversationType: ConnectionType;
      instantRatePerMinute: number | null;
      charityId: string | null;
      donationPreference: boolean;
    }) => {
      setSavingConnection(true);
      try {
        const next = await patchConnectionSettings(payload);
        assignState(next);
        setError(null);
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unable to update connection settings.';
        setError(detail);
        throw err;
      } finally {
        setSavingConnection(false);
      }
    },
    [assignState]
  );

  const startCalendarConnect = useCallback(async () => {
    setSavingCalendar(true);
    try {
      const { redirectUrl } = await connectCalendar();
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      await refresh();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to connect calendar.';
      setError(detail);
    } finally {
      setSavingCalendar(false);
    }
  }, [refresh]);

  const disconnectCalendarHandler = useCallback(async () => {
    setSavingCalendar(true);
    try {
      const next = await disconnectCalendar();
      assignState(next);
      setError(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to disconnect calendar.';
      setError(detail);
    } finally {
      setSavingCalendar(false);
    }
  }, [assignState]);

  const startStripeConnect = useCallback(async () => {
    setSavingStripe(true);
    try {
      const { redirectUrl } = await connectStripe();
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      await refresh();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to connect Stripe.';
      setError(detail);
    } finally {
      setSavingStripe(false);
    }
  }, [refresh]);

  const disconnectStripeHandler = useCallback(async () => {
    setSavingStripe(true);
    try {
      const next = await disconnectStripe();
      assignState(next);
      setError(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to disconnect Stripe.';
      setError(detail);
    } finally {
      setSavingStripe(false);
    }
  }, [assignState]);

  const markOnboardingDone = useCallback(async () => {
    try {
      const next = await markOnboardingComplete();
      assignState(next);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to complete onboarding.';
      setError(detail);
      throw err;
    }
  }, [assignState]);

  return {
    settings,
    charities,
    loading,
    error,
    refreshing,
    savingAvailability,
    savingConnection,
    savingCalendar,
    savingStripe,
    updateAvailability,
    saveConnection,
    startCalendarConnect,
    disconnectCalendar: disconnectCalendarHandler,
    startStripeConnect,
    disconnectStripe: disconnectStripeHandler,
    refresh,
    markOnboardingDone
  };
};
