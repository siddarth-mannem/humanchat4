'use client';

import { useEffect, useRef } from 'react';
import { isSignInWithEmailLink, onIdTokenChanged, signInWithEmailLink } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebaseClient';
import { AUTH_UPDATED_EVENT } from '../constants/events';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const EMAIL_STORAGE_KEY = 'hc_email_link';

const notifyAuthUpdated = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT));
};

export default function FirebaseSessionBridge() {
  const inflight = useRef(false);
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    const auth = firebaseAuth;
    let mounted = true;

    const finishEmailLinkIfNeeded = async () => {
      if (typeof window === 'undefined') {
        return;
      }
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        return;
      }
      let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      if (!email) {
        email = window.prompt('Enter the email you used to request the sign-in link') ?? '';
      }
      if (!email) {
        return;
      }
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('oobCode');
        cleanUrl.searchParams.delete('mode');
        cleanUrl.searchParams.delete('lang');
        window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      } catch (error) {
        console.error('Unable to complete email link sign in', error);
      }
    };

    const syncSession = async (idToken: string | null) => {
      console.log('[FirebaseSessionBridge] syncSession called', {
        hasToken: !!idToken,
        inflight: inflight.current,
        tokenMatch: lastToken.current === idToken
      });
      
      if (!idToken || inflight.current || lastToken.current === idToken) {
        return;
      }
      inflight.current = true;
      try {
        console.log('[FirebaseSessionBridge] Sending token to backend');
        const response = await fetch(`${API_BASE_URL}/api/auth/firebase`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        console.log('[FirebaseSessionBridge] Backend response:', response.status);
        if (response.ok) {
          lastToken.current = idToken;
          notifyAuthUpdated();
        } else {
          lastToken.current = null;
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to bridge Firebase session', response.status, errorData);
        }
      } catch (error) {
        lastToken.current = null;
        console.error('Unable to sync Firebase session', error);
      } finally {
        inflight.current = false;
      }
    };

    void finishEmailLinkIfNeeded();

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!mounted) return;
      if (!user) {
        lastToken.current = null;
        notifyAuthUpdated();
        return;
      }
      try {
        const token = await user.getIdToken();
        await syncSession(token);
      } catch (error) {
        console.error('Unable to fetch Firebase ID token', error);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return null;
}
