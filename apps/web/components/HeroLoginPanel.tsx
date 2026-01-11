'use client';

import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle, type ForwardedRef } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithRedirect, getRedirectResult } from 'firebase/auth';

import { firebaseAuth } from '../lib/firebaseClient';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import LogoutButton from './LogoutButton';

export interface HeroLoginPanelHandle {
  focusEmailField: () => void;
}

interface HeroLoginPanelProps {}

const HeroLoginPanel = (_: HeroLoginPanelProps, ref: ForwardedRef<HeroLoginPanelHandle>) => {
  const router = useRouter();
  const { identity, refresh } = useAuthIdentity();
  const auth = firebaseAuth;

  const googleProvider = useMemo(() => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }, []);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'signing-in'>('idle');
  const [error, setError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      focusEmailField: () => {
        emailInputRef.current?.focus();
      }
    }),
    []
  );

  // Handle redirect result when user comes back from Google
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User successfully signed in via redirect
          // The FirebaseSessionBridge will handle syncing the session
          // and the auth state change will trigger the overlay to hide
        }
      } catch (error) {
        console.error('Error handling redirect result:', error);
        setError(error instanceof Error ? error.message : 'Unable to complete Google sign in.');
        setGoogleStatus('idle');
      }
    };
    void handleRedirectResult();
  }, [auth]);

  const handleGoogleSignIn = async () => {
    if (googleStatus === 'signing-in') return;
    setGoogleStatus('signing-in');
    setError(null);
    try {
      // This will redirect the entire page to Google for authentication
      await signInWithRedirect(auth, googleProvider);
      // Note: The code below won't execute because the page will redirect
      // After Google authentication, the user will be redirected back
      // and getRedirectResult will handle the result
    } catch (authIssue) {
      setError(authIssue instanceof Error ? authIssue.message : 'Unable to start Google sign in.');
      setGoogleStatus('idle');
    }
  };

  const handleMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError('Enter an email to receive a link.');
      return;
    }

    setStatus('sending');
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/?focus=sam`;
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: redirectTo,
        handleCodeInApp: true
      });
      window.localStorage.setItem('hc_email_link', email.trim());
      setStatus('sent');
      setEmail('');
    } catch (issue) {
      setStatus('idle');
      setError(issue instanceof Error ? issue.message : 'Unable to send magic link right now.');
    }
  };

  if (identity) {
    return (
      <section className="flex flex-col rounded-[28px] border border-white/10 bg-white/5 p-5 sm:p-6 lg:h-full">
        <p className="text-xs uppercase tracking-[0.35em] text-white/60">You are signed in</p>
        <h2 className="mt-3 font-display text-2xl text-white">Ready whenever you are</h2>
        <p className="mt-2 text-sm text-white/70">
          Sam already knows who you are. Jump back into chat when you need a warm introduction. Use the avatar menu to manage
          settings or log out.
        </p>

        <div className="mt-6 rounded-2xl border border-white/15 bg-black/30 p-4">
          <p className="text-sm font-semibold text-white">{identity.name}</p>
          {identity.email && <p className="text-xs text-white/60">{identity.email}</p>}
        </div>
      </section>
    );
  }

  return (
    <section id="login-panel" className="flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-5 sm:p-5 lg:p-6 lg:h-full">
      <h2 className="mt-2 font-display text-xl sm:text-xl lg:text-2xl leading-tight text-white">
        Log in to talk to Simple Sam (AI), who connects you with humans based on your specifics.
      </h2>

      <div className="mt-4 sm:mt-5 flex flex-col gap-4 sm:gap-4 lg:mt-6">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-2.5 sm:px-5 sm:py-2 text-sm font-semibold text-midnight transition hover:scale-[1.01]"
          disabled={googleStatus === 'signing-in'}
        >
          {googleStatus === 'signing-in' ? 'Signing in…' : 'Continue with Google'}
        </button>

        <form onSubmit={handleMagicLink} className="space-y-3" aria-label="Request email link">
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="hero-login-email">
            Work email
            <input
              id="hero-login-email"
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              placeholder="you@company.com"
              className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/60 focus:outline-none"
              required
            />
          </label>
          {error && <p className="text-sm text-peach">{error}</p>}
          {status === 'sent' && <p className="text-sm text-aqua">Magic link sent — check your inbox.</p>}
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-5 py-2.5 sm:px-5 sm:py-2 text-sm font-semibold text-white transition hover:border-white"
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      </div>
    </section>
  );
};

export default forwardRef<HeroLoginPanelHandle, HeroLoginPanelProps>(HeroLoginPanel);
