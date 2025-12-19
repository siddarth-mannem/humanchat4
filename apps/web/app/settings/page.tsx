'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import SettingsConnectionsPanel from '../../components/settings/SettingsConnectionsPanel';
import SettingsProfilePanel from '../../components/settings/SettingsProfilePanel';
import { useSettings } from '../../hooks/useSettings';
import { useProfileDetails } from '../../hooks/useProfileDetails';

type SettingsTab = 'connections' | 'profile';

const tabs: Array<{ id: SettingsTab; label: string; blurb: string }> = [
  { id: 'connections', label: 'Availability & Connections', blurb: 'Control how members reach you.' },
  { id: 'profile', label: 'Profile & Identity', blurb: 'Update who you are and what you share.' }
];

const SettingsContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settingsState = useSettings();
  const profileState = useProfileDetails();

  const deriveTab = (value: string | null): SettingsTab => (value === 'profile' ? 'profile' : 'connections');
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => deriveTab(searchParams.get('tab')));

  useEffect(() => {
    setActiveTab(deriveTab(searchParams.get('tab')));
  }, [searchParams]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'profile') {
      params.set('tab', 'profile');
    } else {
      params.delete('tab');
    }
    const query = params.toString();
    router.replace(query ? `/settings?${query}` : '/settings');
  };

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="border-b border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Settings</p>
            <h1 className="text-3xl font-semibold">Control how members reach you</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${
                  activeTab === tab.id ? 'border-white text-white' : 'border-white/20 text-white/60 hover:border-white/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-white/60">{tabs.find((tab) => tab.id === activeTab)?.blurb}</p>
        </div>
      </header>

      {activeTab === 'profile' ? (
        <section className="mx-auto w-full max-w-4xl px-4 py-10">
          <SettingsProfilePanel profileState={profileState} />
        </section>
      ) : (
        <section className="mx-auto w-full max-w-5xl px-4 py-10">
          <SettingsConnectionsPanel settingsState={settingsState} />
        </section>
      )}
    </main>
  );
};

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-midnight text-white">
          <p className="text-sm text-white/70">Loading settings…</p>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
