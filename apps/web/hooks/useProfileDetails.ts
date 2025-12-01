'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '../services/authApi';
import { fetchCurrentUser } from '../services/authApi';
import type { ProfileUpdateInput, UserProfile } from '../services/profileApi';
import { fetchUserProfile, updateUserProfile } from '../services/profileApi';

export interface UseProfileDetailsResult {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  refresh: () => Promise<void>;
  save: (updates: ProfileUpdateInput) => Promise<UserProfile>;
}

export const useProfileDetails = (): UseProfileDetailsResult => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const identity = await fetchCurrentUser();
      if (!identity) {
        setUser(null);
        setProfile(null);
        setError('Please sign in to manage your profile.');
        return;
      }
      setUser(identity);
      const data = await fetchUserProfile(identity.id);
      setProfile(data);
      setError(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to load profile.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const save = useCallback(
    async (updates: ProfileUpdateInput) => {
      if (!user) {
        throw new Error('Sign in required before saving changes.');
      }
      setSaving(true);
      try {
        const next = await updateUserProfile(user.id, updates);
        setProfile(next);
        setError(null);
        return next;
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unable to save profile changes.';
        setError(detail);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  return {
    user,
    profile,
    loading,
    error,
    saving,
    refresh,
    save
  };
};
