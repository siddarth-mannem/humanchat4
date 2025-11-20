'use client';

import { useMemo, useState } from 'react';
import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithPopup } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebaseClient';

export default function SignupActions() {
  const auth = firebaseAuth;
  const googleProvider = useMemo(() => new GoogleAuthProvider(), []);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (authIssue) {
      setError(authIssue instanceof Error ? authIssue.message : 'Unable to start Google sign in.');
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
      const redirectTo = `${window.location.origin}/chat`;
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: redirectTo,
        handleCodeInApp: true
      });
      window.localStorage.setItem('hc_email_link', email.trim());

      setStatus('sent');
      setEmail('');
    } catch (otpIssue) {
      setStatus('idle');
      setError(otpIssue instanceof Error ? otpIssue.message : 'Unable to send magic link right now.');
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-3 font-semibold text-midnight transition hover:scale-105 sm:w-auto"
      >
        Continue with Google
      </button>

      <form onSubmit={handleMagicLink} className="rounded-3xl border border-white/15 bg-midnight/60 p-6 shadow-lg shadow-black/20">
        <p className="text-sm uppercase tracking-[0.35em] text-white/60">Magic link</p>
        <label className="mt-4 flex flex-col gap-2 text-sm text-slate-200">
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-white/60 focus:outline-none"
            required
          />
        </label>
        {error && <p className="mt-3 text-sm text-peach">{error}</p>}
        {status === 'sent' && <p className="mt-3 text-sm text-aqua">Magic link sent! Check your inbox.</p>}
        <button
          type="submit"
          className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/30 px-6 py-2 text-sm font-semibold text-white transition hover:border-white"
          disabled={status === 'sending'}
        >
          {status === 'sending' ? 'Sending…' : 'Send me a link'}
        </button>
      </form>

      <p className="text-sm text-slate-200">
        Want help from a human? Email <a href="mailto:sam@humanchat.com" className="text-white underline">sam@humanchat.com</a> and we’ll set up access manually.
      </p>
    </div>
  );
}
