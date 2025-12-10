'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithPopup } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebaseClient';

const personaOptions = [
  {
    id: 'host',
    title: 'Host / expert',
    body: 'Share your calendar and let Sam route qualified requests instantly.'
  },
  {
    id: 'team',
    title: 'Operator / team',
    body: 'Coordinate advisors, approvals, and billing from one workspace.'
  },
  {
    id: 'community',
    title: 'Community',
    body: 'Spin up drop-in rooms or office hours for members with one link.'
  }
];

export default function SignupActions() {
  const auth = firebaseAuth;
  const googleProvider = useMemo(() => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }, []);
  const router = useRouter();

  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'signing-in'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [contextNote, setContextNote] = useState('');
  const [contextSaved, setContextSaved] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === 'sent') {
      setTimeout(() => {
        noteRef.current?.focus();
      }, 120);
    }
  }, [status]);

  const handlePersonaSelect = (id: string) => {
    setSelectedPersona(id);
  };

  const handleGoogleSignIn = async () => {
    if (googleStatus === 'signing-in') return;
    setGoogleStatus('signing-in');
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
    } catch (authIssue) {
      setError(authIssue instanceof Error ? authIssue.message : 'Unable to start Google sign in.');
    } finally {
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
      const redirectTo = `${window.location.origin}/dashboard`;
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: redirectTo,
        handleCodeInApp: true
      });
      window.localStorage.setItem('hc_email_link', email.trim());
      if (selectedPersona) {
        window.localStorage.setItem('hc_signup_persona', selectedPersona);
      }
      setStatus('sent');
      setEmail('');
    } catch (otpIssue) {
      setStatus('idle');
      setError(otpIssue instanceof Error ? otpIssue.message : 'Unable to send magic link right now.');
    }
  };

  const handleSaveContext = () => {
    if (!contextNote.trim()) {
      setContextSaved(false);
      return;
    }
    const payload = {
      persona: selectedPersona,
      note: contextNote.trim(),
      savedAt: Date.now()
    };
    window.localStorage.setItem('hc_signup_context', JSON.stringify(payload));
    setContextSaved(true);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/60">Optional: tell Sam who you are</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {personaOptions.map((option) => {
            const isActive = selectedPersona === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handlePersonaSelect(option.id)}
                className={`rounded-3xl border p-4 text-left transition ${
                  isActive ? 'border-white/80 bg-white/10 text-white' : 'border-white/15 text-slate-200 hover:border-white/30'
                }`}
              >
                <div className="text-sm font-semibold uppercase tracking-[0.3em]">{option.title}</div>
                <p className="mt-2 text-sm text-slate-200">{option.body}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-300">Sam uses this to personalize intros. Skip it if you want — access is instant either way.</p>
      </div>

      <div className="space-y-4 rounded-3xl border border-white/15 bg-midnight/70 p-6 shadow-lg shadow-black/20">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">Get instant access</p>
          <p className="mt-2 text-sm text-slate-200">Pick Google or email — no approvals needed.</p>
        </div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-2.5 font-semibold text-midnight transition hover:scale-[1.01] sm:w-auto"
          disabled={googleStatus === 'signing-in'}
        >
          {googleStatus === 'signing-in' ? 'Signing in…' : 'Continue with Google'}
        </button>

        <form onSubmit={handleMagicLink} className="space-y-3">
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Work email
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              placeholder="you@company.com"
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-white/60 focus:outline-none"
              required
            />
          </label>
          {error && <p className="text-sm text-peach">{error}</p>}
          {status === 'sent' && <p className="text-sm text-aqua">Magic link sent! Check your inbox and keep this tab open.</p>}
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-6 py-2 text-sm font-semibold text-white transition hover:border-white"
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      </div>

      <div className="space-y-3 rounded-3xl border border-white/15 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm uppercase tracking-[0.35em] text-white/60">Optional context</p>
          {status === 'sent' && <span className="text-xs text-aqua">Magic link sent — jot a note for Sam</span>}
        </div>
        <p className="text-sm text-slate-200">Share who you hope to meet or what you are shipping. Sam reads this before reaching out.</p>
        <textarea
          ref={noteRef}
          value={contextNote}
          onChange={(event) => {
            setContextNote(event.target.value);
            setContextSaved(false);
          }}
          rows={3}
          className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white focus:border-white/60 focus:outline-none"
          placeholder="Example: Need founders to review our launch plan next week."
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white transition hover:border-white"
            onClick={handleSaveContext}
          >
            Save note for Sam
          </button>
          {contextSaved && <span className="text-xs text-aqua">Saved locally — Sam will ask for it during onboarding.</span>}
        </div>
      </div>

      <p className="text-sm text-slate-200">
        Prefer inbox? Email <a href="mailto:sam@humanchat.com" className="text-white underline">sam@humanchat.com</a> and we’ll reply within one business day.
      </p>
    </div>
  );
}
