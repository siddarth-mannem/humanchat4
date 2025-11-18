'use client';

import { useEffect, useMemo, useRef } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function SupabaseSessionBridge() {
  const lastSyncedToken = useRef<string | null>(null);
  const inflight = useRef(false);
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch (error) {
      console.warn('Supabase client unavailable', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    const syncSession = async (accessToken: string | null) => {
      if (!accessToken || inflight.current || lastSyncedToken.current === accessToken) {
        return;
      }
      inflight.current = true;
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/supabase`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken })
        });
        if (!response.ok) {
          console.error('Failed to bridge Supabase session');
          lastSyncedToken.current = null;
          return;
        }
        lastSyncedToken.current = accessToken;
      } catch (error) {
        console.error('Unable to sync Supabase session', error);
        lastSyncedToken.current = null;
      } finally {
        inflight.current = false;
      }
    };

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await syncSession(data.session?.access_token ?? null);
    };

    void bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.access_token) {
        void syncSession(session.access_token);
      } else {
        lastSyncedToken.current = null;
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  return null;
}
