'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';

interface AccountIdentityFormProps {
  profileState: UseProfileDetailsResult;
}

const MIN_NAME_LENGTH = 2;

export default function AccountIdentityForm({ profileState }: AccountIdentityFormProps) {
  const { profile, save, saving } = profileState;
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    } else {
      setName('');
    }
    setStatus('idle');
    setMessage(null);
  }, [profile?.name]);

  const trimmedName = name.trim();

  const disableSubmit = useMemo(() => {
    if (!profile) return true;
    if (saving) return true;
    if (trimmedName.length < MIN_NAME_LENGTH) return true;
    return trimmedName === profile.name.trim();
  }, [profile, saving, trimmedName]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || trimmedName.length < MIN_NAME_LENGTH) {
      setStatus('error');
      setMessage(`Name must be at least ${MIN_NAME_LENGTH} characters.`);
      return;
    }
    setStatus('idle');
    setMessage(null);
    try {
      await save({ name: trimmedName });
      setStatus('success');
      setMessage('Name updated successfully.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to update name right now.');
    }
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-[rgba(15,23,42,0.85)] p-6 text-white shadow-[0_25px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Identity</p>
        <h2 className="text-2xl font-semibold">Name & contact details</h2>
        <p className="text-sm text-white/70">Update the name that appears on ProfileCards and invoices.</p>
      </header>

      {!profile && <p className="mt-6 text-sm text-white/70">Sign in to edit your name.</p>}

      {profile && (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-white/80" htmlFor="account-name-input">
            Display name
            <input
              id="account-name-input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white focus:border-aqua/60"
              maxLength={80}
            />
          </label>
          <div className="flex flex-col gap-2 text-xs text-white/60">
            <span>This is shared with members across chat, bookings, and payout receipts.</span>
            {message && (
              <span
                className={
                  status === 'success'
                    ? 'text-emerald-300'
                    : status === 'error'
                      ? 'text-rose-300'
                      : 'text-white/70'
                }
              >
                {message}
              </span>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={disableSubmit}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
