'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '../../components/LogoutButton';
import type { ConnectionType } from '../../services/settingsApi';
import { useSettings, AVAILABILITY_PROMPT_KEY, AVAILABILITY_STORAGE_KEY } from '../../hooks/useSettings';

const fallbackCharities = [
  { id: 'climate-action', name: 'Climate Action Network' },
  { id: 'youth-mentorship', name: 'Youth Mentorship Initiative' },
  { id: 'open-access', name: 'Open Access Education Fund' }
];

const formatCurrency = (value: string): string => {
  if (!value) return '$0.00';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '$0.00';
  return `$${parsed.toFixed(parsed % 1 === 0 ? 0 : 2)}`;
};

export default function SettingsPage() {
  const router = useRouter();
  const settingsState = useSettings();
  const {
    settings,
    charities,
    loading,
    error,
    updateAvailability,
    saveConnection,
    savingAvailability,
    savingConnection,
    savingCalendar,
    savingStripe,
    startCalendarConnect,
    disconnectCalendar,
    startStripeConnect,
    disconnectStripe,
    refresh
  } = settingsState;

  const [connectionType, setConnectionType] = useState<ConnectionType>('free');
  const [instantRate, setInstantRate] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<string | null>(null);
  const [acceptTips, setAcceptTips] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const [promptToReenable, setPromptToReenable] = useState(false);
  const [integrationsMessage, setIntegrationsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setConnectionType(settings.conversationType ?? 'free');
    setInstantRate(settings.instantRatePerMinute ? String(settings.instantRatePerMinute) : '');
    setSelectedCharity(settings.charityId);
    setAcceptTips(settings.donationPreference ?? true);
    setConnectionMessage(null);
  }, [settings]);

  useEffect(() => {
    if (!settings?.isOnline) {
      setAvailabilityNotice(null);
    }
  }, [settings?.isOnline]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkExpiry = () => {
      if (!settings?.isOnline) return;
      const expireAtRaw = window.localStorage.getItem(AVAILABILITY_STORAGE_KEY);
      const expireAt = expireAtRaw ? Number(expireAtRaw) : null;
      if (expireAt && Date.now() > expireAt) {
        void updateAvailability(false);
        window.localStorage.setItem(AVAILABILITY_PROMPT_KEY, 'true');
        setAvailabilityNotice('We turned off your availability after 30 minutes of inactivity.');
      }
    };
    const interval = window.setInterval(checkExpiry, 60 * 1000);
    checkExpiry();
    return () => window.clearInterval(interval);
  }, [settings?.isOnline, updateAvailability]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFocus = () => {
      if (!settings?.isOnline && window.localStorage.getItem(AVAILABILITY_PROMPT_KEY) === 'true') {
        setPromptToReenable(true);
      } else {
        setPromptToReenable(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    handleFocus();
    return () => window.removeEventListener('focus', handleFocus);
  }, [settings?.isOnline]);

  const availableCharities = charities.length > 0 ? charities : fallbackCharities;

  const trimmedRate = instantRate.trim();
  const numericRate = trimmedRate ? Number(trimmedRate) : null;

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    const rateValue = settings.instantRatePerMinute ? String(settings.instantRatePerMinute) : '';
    return (
      settings.conversationType !== connectionType ||
      rateValue !== trimmedRate ||
      (settings.charityId ?? '') !== (selectedCharity ?? '') ||
      settings.donationPreference !== acceptTips
    );
  }, [settings, connectionType, trimmedRate, selectedCharity, acceptTips]);

  const connectionErrors: string[] = [];
  if (connectionType === 'paid') {
    if (numericRate === null || !Number.isFinite(numericRate) || numericRate <= 0) {
      connectionErrors.push('Rate must be greater than $0 to accept paid requests.');
    }
  }
  if (connectionType === 'charity' && !selectedCharity) {
    connectionErrors.push('Select a charity partner before continuing.');
  }
  if ((connectionType === 'paid' || connectionType === 'charity') && !settings?.stripeConnected) {
    connectionErrors.push('Connect Stripe first to accept paid or charity conversations.');
  }

  const handleAvailabilityToggle = () => {
    if (!settings) return;
    void updateAvailability(!settings.isOnline);
  };

  const handleSaveConnection = async () => {
    if (!settings) return;
    setConnectionMessage(null);
    if (connectionErrors.length > 0) {
      setConnectionMessage(connectionErrors[0]);
      return;
    }
    try {
      await saveConnection({
        conversationType: connectionType,
        instantRatePerMinute: connectionType === 'paid' ? Number(trimmedRate) : null,
        charityId: connectionType === 'charity' ? selectedCharity : null,
        donationPreference: acceptTips
      });
      setConnectionMessage('Settings updated');
    } catch (err) {
      setConnectionMessage(err instanceof Error ? err.message : 'Unable to save changes.');
    }
  };

  const handleCalendarDisconnect = async () => {
    if (!settings?.calendarConnected) return;
    const confirmDisconnect = window.confirm('Disconnect calendar? Scheduled bookings will be disabled.');
    if (!confirmDisconnect) return;
    setIntegrationsMessage(null);
    await disconnectCalendar();
    setIntegrationsMessage('Calendar disconnected. Scheduled bookings are disabled.');
  };

  const handleStripeDisconnect = async () => {
    if (!settings) return;
    if (settings.conversationType !== 'free') {
      setIntegrationsMessage('Switch to free mode before disconnecting Stripe.');
      return;
    }
    const confirmDisconnect = window.confirm('Disconnect Stripe? You will need to offer free conversations.');
    if (!confirmDisconnect) return;
    setIntegrationsMessage(null);
    await disconnectStripe();
    setIntegrationsMessage('Stripe disconnected. You are now listed as Free.');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-midnight text-white">
        <p className="text-sm text-white/70">Loading settings…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-midnight text-white">
        <p className="text-sm text-white/70">{error}</p>
        <button type="button" className="rounded-full border border-white/20 px-5 py-2 text-sm" onClick={() => refresh()}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Settings</p>
            <h1 className="text-3xl font-semibold">Control how members reach you</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Availability</h2>
              <p className="text-sm text-white/60">Toggle whether Sam can surface you in discovery.</p>
            </div>
            <button
              type="button"
              disabled={savingAvailability}
              onClick={handleAvailabilityToggle}
              className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${
                settings?.isOnline ? 'border-aqua/60 text-aqua' : 'border-white/20 text-white/60'
              }`}
            >
              {savingAvailability ? 'Saving…' : settings?.isOnline ? 'on' : 'off'}
            </button>
          </header>
          <p className="text-sm text-white/60">
            {settings?.isOnline ? 'You appear in search and Sam can route instant connects.' : 'You are hidden until you toggle availability back on.'}
          </p>
          {availabilityNotice && <p className="mt-3 text-xs text-amber-300">{availabilityNotice}</p>}
          {promptToReenable && (
            <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm text-white/80">
              <p>You were set to offline after inactivity. Turn availability back on?</p>
              <button
                type="button"
                className="mt-3 rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-5 py-2 text-xs font-semibold text-midnight"
                onClick={() => {
                  setPromptToReenable(false);
                  window.localStorage.removeItem(AVAILABILITY_PROMPT_KEY);
                  void updateAvailability(true);
                }}
              >
                Re-enable availability
              </button>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Connection settings</h2>
          <p className="text-sm text-white/60">Choose how you connect and whether you accept tips.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {(['free', 'paid', 'charity'] as ConnectionType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded-2xl border p-4 text-left text-sm ${
                  connectionType === type ? 'border-aqua/60 bg-aqua/10 text-white' : 'border-white/10 text-white/70 hover:border-white/30'
                }`}
                onClick={() => setConnectionType(type)}
              >
                <p className="text-base font-semibold capitalize text-white">{type}</p>
                <p className="mt-2 text-xs text-white/60">
                  {type === 'free' && 'Members can join instantly with no payment.'}
                  {type === 'paid' && 'Set a live rate for instant connects.'}
                  {type === 'charity' && 'Donate the proceeds to a partner organization.'}
                </p>
              </button>
            ))}
          </div>

          {connectionType === 'paid' && (
            <label className="mt-6 block text-sm text-white/80">
              Rate per minute (USD)
              <input
                type="number"
                min="0"
                step="0.5"
                value={instantRate}
                onChange={(event) => setInstantRate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-white focus:border-aqua/60"
                placeholder="3.00"
              />
            </label>
          )}

          {connectionType === 'charity' && (
            <label className="mt-6 block text-sm text-white/80">
              Charity partner
              <select
                value={selectedCharity ?? ''}
                onChange={(event) => setSelectedCharity(event.target.value || null)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-white focus:border-aqua/60"
              >
                <option value="" disabled>
                  Choose a charity
                </option>
                {availableCharities.map((charity) => (
                  <option key={charity.id} value={charity.id}>
                    {charity.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-6 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={acceptTips}
                onChange={(event) => setAcceptTips(event.target.checked)}
              />
              Accept optional tips ({acceptTips ? 'enabled' : 'disabled'})
            </label>
          </div>

          {connectionErrors.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-rose-300">
              {connectionErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {connectionMessage && <p className="mt-4 text-xs text-white/70">{connectionMessage}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!hasChanges || savingConnection}
              onClick={() => void handleSaveConnection()}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight disabled:opacity-40"
            >
              {savingConnection ? 'Saving…' : 'Save changes'}
            </button>
            <p className="text-xs text-white/60">
              Current mode: <span className="font-semibold text-white">{connectionType}</span>{' '}
              {connectionType === 'paid' && numericRate ? `· ${formatCurrency(trimmedRate)}/min` : null}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Calendar & payments</h2>
          <p className="text-sm text-white/60">Keep Sam aligned with your availability and payouts.</p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm font-semibold">Google Calendar</p>
              <p className="text-xs text-white/60">{settings?.calendarConnected ? 'Connected ✓' : 'Not connected'}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {settings?.calendarConnected ? (
                  <button
                    type="button"
                    disabled={savingCalendar}
                    onClick={() => void handleCalendarDisconnect()}
                    className="rounded-full border border-white/20 px-5 py-2 text-xs"
                  >
                    {savingCalendar ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={savingCalendar}
                    onClick={() => void startCalendarConnect()}
                    className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-5 py-2 text-xs font-semibold text-midnight"
                  >
                    {savingCalendar ? 'Connecting…' : 'Connect Google Calendar'}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm font-semibold">Stripe</p>
              <p className="text-xs text-white/60">{settings?.stripeConnected ? 'Connected ✓' : 'Not connected'}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {settings?.stripeConnected ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-5 py-2 text-xs"
                      onClick={() => router.push('/settings/payments')}
                    >
                      Manage account
                    </button>
                    <button
                      type="button"
                      disabled={savingStripe}
                      onClick={() => void handleStripeDisconnect()}
                      className="rounded-full border border-white/20 px-5 py-2 text-xs"
                    >
                      {savingStripe ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={savingStripe}
                    onClick={() => void startStripeConnect()}
                    className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-5 py-2 text-xs font-semibold text-midnight"
                  >
                    {savingStripe ? 'Connecting…' : 'Connect Stripe'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {integrationsMessage && <p className="mt-4 text-xs text-white/70">{integrationsMessage}</p>}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Account</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <button
              type="button"
              className="rounded-2xl border border-white/15 px-4 py-3 text-left hover:border-white/40"
              onClick={() => router.push('/auth/change-password')}
            >
              Change password
            </button>
            <LogoutButton className="rounded-2xl border border-white/15 px-4 py-3 text-left text-white/80 hover:border-white/40" />
            <button
              type="button"
              className="rounded-2xl border border-rose-400/40 px-4 py-3 text-left text-rose-200 hover:border-rose-300"
              onClick={() => {
                const confirmed = window.confirm('Delete your account? This action cannot be undone.');
                if (confirmed) {
                  router.push('/support/delete-account');
                }
              }}
            >
              Delete account
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
