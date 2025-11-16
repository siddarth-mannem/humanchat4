"use client";

import { useMemo, useState } from 'react';
import ProfileCard from './ProfileCard';
import type { ProfileSummary } from '../../../src/lib/db';

const sampleProfiles: ProfileSummary[] = [
  {
    userId: 'discover-priya',
    name: 'Priya Desai',
    headline: 'Climate Policy Translator',
    bio: 'Turns dense policy into action steps for local teams.',
    conversationType: 'paid',
    instantRatePerMinute: 15,
    scheduledRates: [
      { durationMinutes: 30, price: 450 },
      { durationMinutes: 60, price: 850 }
    ],
    isOnline: true,
    hasActiveSession: false
  },
  {
    userId: 'discover-jamal',
    name: 'Jamal Ortiz',
    headline: 'Product Coach for AI Teams',
    bio: 'Guides founding teams through zero-to-one launches.',
    conversationType: 'paid',
    instantRatePerMinute: 18,
    isOnline: false,
    hasActiveSession: true
  }
];

interface DiscoverPanelProps {
  onBookProfile?: (profile: ProfileSummary) => void;
}

export default function DiscoverPanel({ onBookProfile }: DiscoverPanelProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return sampleProfiles;
    return sampleProfiles.filter((profile) => profile.name?.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <section className="flex min-h-[calc(100vh-64px)] flex-col gap-6 bg-gradient-to-b from-black/60 to-transparent px-4 pb-24 pt-6 text-white">
      <div>
        <h2 className="text-2xl font-semibold">Discover</h2>
        <p className="text-sm text-white/70">Search across trending experts.</p>
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80 focus-within:border-white/40">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
          <line x1="16" y1="16" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a person or topic"
          className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/40"
          aria-label="Search profiles"
        />
      </label>
      <div className="flex flex-col gap-4">
        {filtered.map((profile) => (
          <ProfileCard key={profile.userId} profile={profile} onBookTime={onBookProfile} />
        ))}
      </div>
    </section>
  );
}
