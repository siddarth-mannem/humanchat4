'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ConnectionType } from '../../services/settingsApi';
import { useSettings } from '../../hooks/useSettings';

const fallbackCharities = [
  { id: 'climate-action', name: 'Climate Action Network' },
  { id: 'youth-mentorship', name: 'Youth Mentorship Initiative' },
  { id: 'open-access', name: 'Open Access Education Fund' }
];

const formatSteps = (connectionType: ConnectionType) => {
  const steps = ['Connection type', 'Tips', 'Calendar'];
  if (connectionType !== 'free') {
    steps.push('Payments');
  }
  return steps;
};

const rateFromInput = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
};

export default function OnboardingPage() {
  const router = useRouter();
  const settingsState = useSettings();
  const {
    settings,
    charities,
    loading,
    error,
    saveConnection,
    markOnboardingDone,
    startCalendarConnect,
    startStripeConnect,
    refresh
  } = settingsState;
  const [stepIndex, setStepIndex] = useState(0);
  const [connectionType, setConnectionType] = useState<ConnectionType>('free');
  const [instantRate, setInstantRate] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<string | null>(null);
  const [acceptTips, setAcceptTips] = useState(true);
  const [calendarSkipped, setCalendarSkipped] = useState(false);
  const [stripeSkipped, setStripeSkipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setConnectionType(settings.conversationType ?? 'free');
    setInstantRate(settings.instantRatePerMinute ? String(settings.instantRatePerMinute) : '');
    setSelectedCharity(settings.charityId);
    setAcceptTips(settings.donationPreference ?? true);
  }, [settings]);

  const stepLabels = useMemo(() => formatSteps(connectionType), [connectionType]);
  const activeStepLabel = stepLabels[stepIndex] ?? 'Connection type';

  const availableCharities = charities.length > 0 ? charities : fallbackCharities;

  const canProceedFromConnection = useMemo(() => {
    if (connectionType === 'paid') {
      return rateFromInput(instantRate) !== null;
    }
    if (connectionType === 'charity') {
      return Boolean(selectedCharity);
    }
    return true;
  }, [connectionType, instantRate, selectedCharity]);

  const canAdvance = useMemo(() => {
    const stepName = stepLabels[stepIndex];
    if (stepName === 'Connection type') return canProceedFromConnection;
    if (stepName === 'Payments' && connectionType !== 'free') {
      if (!settings?.stripeConnected) {
        return false;
      }
      return true;
    }
    return true;
  }, [stepLabels, stepIndex, canProceedFromConnection, connectionType, settings?.stripeConnected]);

  const goNext = () => {
    if (stepIndex < stepLabels.length - 1) {
      setStepIndex((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleFinish = async () => {
    if (!settings) return;
    setSubmitting(true);
    setSubmissionError(null);
    try {
      const numericRate = connectionType === 'paid' ? rateFromInput(instantRate) : null;
      if (connectionType === 'paid' && !numericRate) {
        setSubmissionError('Please set a rate above $0 to continue.');
        setSubmitting(false);
        return;
      }
      if (connectionType !== 'free' && !settings.stripeConnected) {
        setSubmissionError('Connect Stripe first to accept paid or charity sessions.');
        setSubmitting(false);
        return;
      }
      await saveConnection({
        conversationType: connectionType,
        instantRatePerMinute: connectionType === 'paid' ? numericRate : null,
        charityId: connectionType === 'charity' ? selectedCharity : null,
        donationPreference: acceptTips
      });
      await markOnboardingDone();
      router.push('/app');
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : 'Unable to save onboarding choices.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderConnectionStep = () => (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-white/50">Step 1</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">How do you plan to connect?</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(['free', 'paid', 'charity'] as ConnectionType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setConnectionType(type);
              if (type === 'free') {
                setInstantRate('');
                setSelectedCharity(null);
              }
            }}
            className={`rounded-2xl border p-4 text-left text-sm transition ${
              connectionType === type ? 'border-aqua/60 bg-aqua/10 text-white' : 'border-white/10 text-white/70 hover:border-white/30'
            }`}
          >
            <p className="text-lg font-semibold capitalize text-white">{type}</p>
            <p className="mt-2 text-xs text-white/60">
              {type === 'free' && 'Offer open office hours and spontaneous chats for free.'}
              {type === 'paid' && 'Charge per minute for instant connects and focused calls.'}
              {type === 'charity' && 'Route proceeds to a verified nonprofit partner.'}
            </p>
          </button>
        ))}
      </div>
      {connectionType === 'paid' && (
        <label className="mt-6 block text-sm text-white/80">
          Instant rate ($/min)
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
          Select a charity partner
          <select
            value={selectedCharity ?? ''}
            onChange={(event) => setSelectedCharity(event.target.value || null)}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-white focus:border-aqua/60"
          >
            <option value="" disabled>
              Choose an organization
            </option>
            {availableCharities.map((charity) => (
              <option key={charity.id} value={charity.id}>
                {charity.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="mt-4 text-xs text-white/60">You can change this anytime from Settings → Connection.</p>
    </div>
  );

  const renderTipsStep = () => (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-white/50">Step 2</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Accept optional tips?</h2>
      <p className="text-sm text-white/70">Let members thank you after a great session. Tips deposit with the rest of your payouts.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        {[
          { label: 'Yes, enable tips', value: true },
          { label: 'No, skip tips', value: false }
        ].map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => setAcceptTips(option.value)}
            className={`rounded-full border px-6 py-3 text-sm font-semibold transition ${
              acceptTips === option.value ? 'border-aqua/60 bg-aqua/10 text-white' : 'border-white/10 text-white/70 hover:border-white/30'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderCalendarStep = () => (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-white/50">Step 3</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Connect your calendar</h2>
      <p className="text-sm text-white/70">Help Sam hold space on your calendar and avoid double-booking.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight"
          onClick={() => {
            setCalendarSkipped(false);
            void startCalendarConnect();
          }}
        >
          Connect Google Calendar
        </button>
        <button
          type="button"
          className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80"
          onClick={() => setCalendarSkipped(true)}
        >
          Skip for now
        </button>
      </div>
      <p className="mt-4 text-xs text-white/60">
        {settings?.calendarConnected
          ? 'Google Calendar is connected. We will sync availability automatically.'
          : calendarSkipped
            ? 'You can connect later from Settings → Calendar & Payments.'
            : 'Connecting now keeps Sam in sync with your day.'}
      </p>
    </div>
  );

  const renderPaymentsStep = () => (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-white/50">Step 4</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Connect Stripe to get paid</h2>
      <p className="text-sm text-white/70">Required for paid or charity sessions. Without Stripe you will be listed as Free.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-6 py-3 text-sm font-semibold text-midnight"
          onClick={() => {
            setStripeSkipped(false);
            void startStripeConnect();
          }}
        >
          Connect Stripe
        </button>
        <button
          type="button"
          className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80"
          onClick={() => {
            setStripeSkipped(true);
            setConnectionType('free');
          }}
        >
          Skip for now
        </button>
      </div>
      <p className="mt-4 text-xs text-white/60">
        {settings?.stripeConnected
          ? 'Stripe is connected. You can start taking paid or charity requests.'
          : stripeSkipped
            ? 'We switched you to Free mode for now. Re-run Stripe connect anytime from Settings.'
            : 'Connect Stripe to keep your paid or charity settings active.'}
      </p>
    </div>
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-midnight text-white">
        <p className="text-sm text-white/70">Loading onboarding…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-midnight text-white">
        <p className="text-sm text-white/70">{error}</p>
        <button
          type="button"
          className="rounded-full border border-white/20 px-5 py-2 text-sm"
          onClick={() => refresh()}
        >
          Try again
        </button>
      </main>
    );
  }

  const showPaymentsStep = connectionType !== 'free';

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Onboarding</p>
            <h1 className="text-3xl font-semibold">Let Sam know how to represent you</h1>
          </div>
          <Link href="/chat" className="text-sm text-white/60 underline-offset-4 hover:underline">
            Skip onboarding
          </Link>
        </div>
        <div className="mx-auto mt-6 flex max-w-4xl items-center gap-4">
          {stepLabels.map((label, index) => (
            <div key={label} className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                  index === stepIndex ? 'border-aqua text-white' : index < stepIndex ? 'border-white/40 text-white/70' : 'border-white/10 text-white/40'
                }`}
              >
                {index + 1}
              </span>
              <span className={index === stepIndex ? 'text-white' : 'text-white/50'}>{label}</span>
            </div>
          ))}
        </div>
      </header>

      <section className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
        {activeStepLabel === 'Connection type' && renderConnectionStep()}
        {activeStepLabel === 'Tips' && renderTipsStep()}
        {activeStepLabel === 'Calendar' && renderCalendarStep()}
        {activeStepLabel === 'Payments' && showPaymentsStep && renderPaymentsStep()}

        {submissionError && <p className="text-sm text-rose-300">{submissionError}</p>}

        <div className="flex flex-wrap items-center gap-4">
          {stepIndex > 0 && (
            <button type="button" className="rounded-full border border-white/20 px-6 py-3 text-sm" onClick={goBack}>
              Back
            </button>
          )}
          {stepIndex < stepLabels.length - 1 && (
            <button
              type="button"
              disabled={!canAdvance}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-8 py-3 text-sm font-semibold text-midnight disabled:opacity-40"
              onClick={goNext}
            >
              Next
            </button>
          )}
          {stepIndex === stepLabels.length - 1 && (
            <button
              type="button"
              disabled={!canAdvance || submitting}
              className="rounded-full bg-gradient-to-r from-indigoGlow to-aqua px-8 py-3 text-sm font-semibold text-midnight disabled:opacity-40"
              onClick={() => void handleFinish()}
            >
              {submitting ? 'Saving…' : 'Finish and open workspace'}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
