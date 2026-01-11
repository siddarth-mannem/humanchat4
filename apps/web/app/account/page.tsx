"use client";

import Link from 'next/link';
import { useState } from 'react';

import { BookingsManager } from '../../components/BookingsManager';
import SettingsConnectionsPanel from '../../components/settings/SettingsConnectionsPanel';
import SettingsProfilePanel from '../../components/settings/SettingsProfilePanel';
import { useAuthIdentity } from '../../hooks/useAuthIdentity';
import { useProfileDetails } from '../../hooks/useProfileDetails';
import { useSettings } from '../../hooks/useSettings';

export default function AccountPage() {
  const profileState = useProfileDetails();
  const { identity } = useAuthIdentity();
  const settingsState = useSettings();
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const panelSections = [
    {
      id: 'settings-profile',
      label: 'Profile',
      tagline: 'Update public details, narrative, and preferences.',
      content: <SettingsProfilePanel embedded profileState={profileState} />
    },
    {
      id: 'settings-connections',
      label: 'Preferences',
      tagline: 'Presence toggle, paid modes, and integrations.',
      content: <SettingsConnectionsPanel embedded settingsState={settingsState} />
    },
    {
      id: 'calendar',
      label: 'Full calendar',
      tagline: 'Review upcoming, past, and canceled sessions.',
      content: (
        <div className="space-y-4">
          <BookingsManager embedded />
        </div>
      )
    }
  ];

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10 px-6 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70 transition hover:text-white"
          >
            Humanchat.com
          </Link>
          <p className="flex-1 text-center text-xs uppercase tracking-[0.45em] text-white/50">Account</p>
          <span className="text-xs text-white/60">
            {identity?.name ? `Signed in as ${identity.name}` : 'Not signed in'}
          </span>
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-white">Your operating console</h1>
        <p className="mt-2 text-sm text-white/60">
          {identity?.name ? 'Update everything from one place.' : 'Sign in to manage your account.'}
        </p>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pb-12">
        <div className="flex flex-col gap-8 py-10">
          <div className="space-y-4">
            {panelSections.map((panel) => {
              const isOpen = openPanel === panel.id;
              return (
                <section key={panel.id} className="rounded-3xl border border-white/12 bg-white/5">
                  <button
                    type="button"
                    onClick={() => setOpenPanel((prev) => (prev === panel.id ? null : panel.id))}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">{panel.label}</p>
                      <p className="text-sm text-white/70">{panel.tagline}</p>
                    </div>
                    <span className="text-xl text-white/60">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <div className="border-t border-white/10 px-5 py-4">{panel.content}</div>}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
