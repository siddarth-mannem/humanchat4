'use client';

import clsx from 'clsx';
import type { UseProfileDetailsResult } from '../hooks/useProfileDetails';
import type { ConversationCategory } from '../services/profileApi';

const conversationCopy: Record<ConversationCategory, { label: string; helper: string }> = {
  free: { label: 'Free', helper: 'No charge · tips optional' },
  paid: { label: 'Paid', helper: 'Charge per minute for instant connects' },
  charity: { label: 'Charity', helper: 'Proceeds donated to your selected org' }
};

const presenceStyles: Record<'online' | 'busy' | 'offline', string> = {
  online: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40',
  busy: 'bg-amber-400/20 text-amber-100 border-amber-400/40',
  offline: 'bg-white/5 text-white/60 border-white/15'
};

const formatCurrency = (value?: number | null): string => {
  if (!value || value <= 0) return 'Not set';
  return `$${value.toFixed(value % 1 === 0 ? 0 : 2)}/min`;
};

interface ProfileDetailsSummaryProps {
  profileState: UseProfileDetailsResult;
}

export default function ProfileDetailsSummary({ profileState }: ProfileDetailsSummaryProps) {
  const { profile, loading, error, refresh } = profileState;

  const renderStatus = () => {
    if (!profile) return null;
    const mode = profile.hasActiveSession ? 'busy' : profile.isOnline ? 'online' : 'offline';
    const label = profile.hasActiveSession ? 'In a call' : profile.isOnline ? 'Online now' : 'Offline';
    return (
      <span className={clsx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]', presenceStyles[mode])}>
        <span className={clsx('h-2 w-2 rounded-full', mode === 'online' ? 'bg-emerald-300' : mode === 'busy' ? 'bg-amber-300' : 'bg-white/50')} />
        {label}
      </span>
    );
  };

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Public profile</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-white">How members see you</h2>
          {renderStatus()}
        </div>
        <p className="text-sm text-white/70">These details power Sam recommendations and every ProfileCard.</p>
      </header>

      {loading && <p className="text-sm text-white/70">Loading profile…</p>}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p>{error}</p>
          <button type="button" onClick={() => refresh()} className="mt-3 rounded-full border border-rose-200/40 px-3 py-1 text-xs font-semibold text-rose-50">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !profile && <p className="text-sm text-white/70">Sign in to view your profile.</p>}

      {!loading && profile && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-white/60">Your identity</p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-xl font-semibold text-white">{profile.name}</p>
              <p className="text-sm text-white/60">{profile.email}</p>
            </div>
            {profile.headline && <p className="mt-4 text-base text-white/80">{profile.headline}</p>}
            {profile.bio && <p className="mt-2 text-sm leading-relaxed text-white/70">{profile.bio}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm font-semibold text-white">Conversation type</p>
              <p className="text-xs text-white/60">Determines the badge Sam shows before your name.</p>
              <div className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                <p className="text-lg font-semibold text-white">{conversationCopy[profile.conversationType]?.label ?? profile.conversationType}</p>
                <p className="text-sm text-white/60">{conversationCopy[profile.conversationType]?.helper ?? 'Custom configuration'}</p>
              </div>
              {profile.charityName && profile.conversationType === 'charity' && (
                <p className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">Donations go to {profile.charityName}</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm font-semibold text-white">Instant availability</p>
              <p className="text-xs text-white/60">Shown on the Connect button Sam renders.</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatCurrency(profile.instantRatePerMinute)}</p>
              <p className="text-sm text-white/60">Confidential rate: {profile.confidentialRate ? 'Yes' : 'No'}</p>
              <p className="text-sm text-white/60">Display mode: {profile.displayMode ?? 'normal'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Scheduled rates</p>
                <p className="text-xs text-white/60">Members see these as bookable blocks.</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {profile.scheduledRates.length === 0 && <p className="text-sm text-white/60">No scheduled durations configured.</p>}
              {profile.scheduledRates.length > 0 && (
                <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
                  {profile.scheduledRates.map((rate) => (
                    <li key={`${rate.durationMinutes}-${rate.price}`} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-white/80">{rate.durationMinutes} min</span>
                      <span className="font-semibold text-white">${rate.price.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
