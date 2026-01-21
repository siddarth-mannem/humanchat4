'use client';

import { useEffect, useState } from 'react';

import {
  blockDateRange,
  deleteAvailabilityOverride,
  disconnectCalendar,
  getAvailabilityOverrides,
  getAvailabilitySummary,
  getGoogleAuthUrl,
  getWeeklyAvailability,
  setWeeklyAvailability,
  type AvailabilityOverride,
  type AvailabilityRule,
  type AvailabilitySummary
} from '../services/expertAvailabilityApi';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AvailabilityManagerProps {
  embedded?: boolean;
}

export function AvailabilityManager({ embedded = false }: AvailabilityManagerProps) {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [summary, setSummary] = useState<AvailabilitySummary | null>(null);
  const [blockedOverrides, setBlockedOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone] = useState('America/New_York');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const [rulesData, summaryData, overridesData] = await Promise.all([
        getWeeklyAvailability(),
        getAvailabilitySummary(),
        getAvailabilityOverrides(today, futureDate)
      ]);
      
      // Set default weekday availability (Monday-Friday) if no rules exist
      if (rulesData.length === 0) {
        const defaultWeekdayRules: AvailabilityRule[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          slotDurationMinutes: 30,
          timezone
        }));
        setRules(defaultWeekdayRules);
      } else {
        setRules(rulesData);
      }
      
      setSummary(summaryData);
      const blocked = overridesData.filter((override) => override.overrideType === 'blocked' && !override.startTime && !override.endTime);
      setBlockedOverrides(blocked);
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (dayOfWeek: number) => {
    const existingRule = rules.find((rule) => rule.dayOfWeek === dayOfWeek);
    if (existingRule) {
      setRules(rules.filter((rule) => rule.dayOfWeek !== dayOfWeek));
    } else {
      setRules([
        ...rules,
        {
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          slotDurationMinutes: 30,
          timezone
        }
      ]);
    }
  };

  const handleUpdateTime = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setRules(rules.map((rule) => (rule.dayOfWeek === dayOfWeek ? { ...rule, [field]: value } : rule)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanRules = rules.map((rule) => ({
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        slotDurationMinutes: rule.slotDurationMinutes || 30,
        timezone: rule.timezone
      }));
      await setWeeklyAvailability(cleanRules);
      alert('Availability saved successfully!');
      void fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to save availability.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const authUrl = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to connect calendar.');
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!confirm('Disconnect Google Calendar?')) return;
    try {
      await disconnectCalendar();
      void fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to disconnect calendar.');
    }
  };

  const handleBlockDates = async () => {
    if (!blockStartDate || !blockEndDate) {
      alert('Please select start and end dates.');
      return;
    }
    try {
      await blockDateRange(blockStartDate, blockEndDate, timezone, blockReason);
      setShowBlockModal(false);
      setBlockStartDate('');
      setBlockEndDate('');
      setBlockReason('');
      void fetchData();
      alert('Dates blocked successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to block dates.');
    }
  };

  const handleDeleteBlockedDate = async (overrideId: string, date: string) => {
    if (!confirm(`Remove block on ${new Date(date).toLocaleDateString()}?`)) return;
    try {
      await deleteAvailabilityOverride(overrideId);
      void fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to remove block.');
    }
  };

  if (loading) {
    return (
      <div className={embedded ? 'py-6 text-white/70' : 'min-h-screen bg-[#0a0e27] flex items-center justify-center'}>
        <div className="text-white/70">Loading availability settings…</div>
      </div>
    );
  }

  const containerClass = embedded ? 'space-y-6 text-white' : 'min-h-screen bg-[#0a0e27] text-white p-6';
  const innerClass = embedded ? 'space-y-6' : 'max-w-4xl mx-auto';
  const cardClass = embedded ? 'rounded-3xl border border-white/10 bg-black/20 p-6' : 'bg-[#1a1f3a] rounded-lg p-6';

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        <div>
          <h2 className={embedded ? 'text-xl font-semibold' : 'text-3xl font-bold mb-2'}>
            {embedded ? 'Availability' : 'Availability Settings'}
          </h2>
          <p className="text-white/60">Manage when clients can book calls with you.</p>
        </div>

        {summary && (
          <div className={cardClass}>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <div className="text-2xl font-bold text-emerald-300">{summary.totalWeeklyHours.toFixed(1)}</div>
                <div className="text-sm text-white/60">Hours/Week</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-rose-300">{summary.upcomingBlockedDates.length}</div>
                <div className="text-sm text-white/60">Blocked Dates</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${summary.calendarConnected ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {summary.calendarConnected ? 'Connected' : 'Not linked'}
                </div>
                <div className="text-sm text-white/60">Calendar sync</div>
              </div>
            </div>
          </div>
        )}

        <div className={cardClass}>
          <h3 className="text-lg font-semibold">Google Calendar</h3>
          <p className="mt-2 text-sm text-white/60">Connect to keep busy times in sync and avoid double booking.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {summary?.calendarConnected ? (
              <>
                <span className="rounded-full border border-emerald-400/40 px-4 py-2 text-sm text-emerald-200">Connected</span>
                <button
                  type="button"
                  onClick={handleDisconnectCalendar}
                  className="rounded-full border border-rose-400/60 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnectCalendar}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40"
              >
                Connect Google Calendar
              </button>
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h3 className="text-lg font-semibold">Weekly schedule</h3>
          <p className="mt-2 text-sm text-white/60">Toggle the days you take calls and adjust hours inline.</p>
          <div className="mt-4 space-y-3">
            {DAYS.map((day, index) => {
              const rule = rules.find((entry) => entry.dayOfWeek === index);
              const isEnabled = Boolean(rule);
              return (
                <div key={day} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <button
                    type="button"
                    onClick={() => handleToggleDay(index)}
                    className={`w-32 rounded-full px-4 py-2 text-left text-sm font-semibold ${
                      isEnabled ? 'bg-white text-midnight' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {day}
                  </button>
                  {isEnabled && rule ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="time"
                        value={rule.startTime}
                        onChange={(event) => handleUpdateTime(index, 'startTime', event.target.value)}
                        className="rounded-xl border border-white/20 bg-transparent px-3 py-2 text-white focus:border-white/60 focus:outline-none"
                      />
                      <span className="text-white/50">to</span>
                      <input
                        type="time"
                        value={rule.endTime}
                        onChange={(event) => handleUpdateTime(index, 'endTime', event.target.value)}
                        className="rounded-xl border border-white/20 bg-transparent px-3 py-2 text-white focus:border-white/60 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-white/50">Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-midnight transition hover:bg-white/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save weekly schedule'}
          </button>
        </div>

        <div className={cardClass}>
          <h3 className="text-lg font-semibold">Block dates</h3>
          <p className="mt-2 text-sm text-white/60">Pause instant bookings for vacations or deep work.</p>
          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40"
          >
            Block date range
          </button>
          {blockedOverrides.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {blockedOverrides.map((override) => (
                <span key={override.id} className="rounded-full border border-rose-400/40 px-3 py-1 text-sm text-rose-200">
                  {new Date(override.overrideDate).toLocaleDateString()}
                  <button
                    type="button"
                    onClick={() => handleDeleteBlockedDate(override.id, override.overrideDate)}
                    className="ml-2 text-rose-200/80 hover:text-rose-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/80 p-6">
            <h3 className="text-xl font-semibold text-white">Block dates</h3>
            <div className="mt-4 space-y-4 text-sm text-white/80">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.3em] text-white/50">Start date</span>
                <input
                  type="date"
                  value={blockStartDate}
                  onChange={(event) => setBlockStartDate(event.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-2 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-white focus:border-white/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.3em] text-white/50">End date</span>
                <input
                  type="date"
                  value={blockEndDate}
                  onChange={(event) => setBlockEndDate(event.target.value)}
                  min={blockStartDate || new Date().toISOString().split('T')[0]}
                  className="mt-2 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-white focus:border-white/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.3em] text-white/50">Reason</span>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                  placeholder="Optional note"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-white placeholder-white/40 focus:border-white/60 focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3 text-sm">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-white/70 hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlockDates}
                className="rounded-full bg-white px-5 py-2 font-semibold text-midnight"
              >
                Block dates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvailabilityManager;
