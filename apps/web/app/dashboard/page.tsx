'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { useConversationData } from '../../hooks/useConversationData';

// Lightweight inline icons used by dashboard tiles
const Icon = ({ name }: { name: string }) => {
  switch (name) {
    case 'sam':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="6" fill="url(#g)" />
          <path d="M8 12h8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="g" x1="0" x2="1">
              <stop offset="0" stopColor="#7c3aed" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
      );
    case 'browse':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="11" cy="11" r="6" stroke="#9CA3AF" strokeWidth="1.2" />
          <path d="M20 20l-3-3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'bookings':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="#93C5FD" strokeWidth="1.2" />
          <path d="M8 3v4" stroke="#93C5FD" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="#FDE68A" strokeWidth="1.2" />
          <path d="M8 3v4" stroke="#FDE68A" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M3 11h18" stroke="#FDE68A" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="#9CA3AF" strokeWidth="1.2" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09c.67 0 1.25-.42 1.51-1a1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 017.04 3.7l.06.06c.5.5 1.18.7 1.82.33.44-.25 1-.39 1.51-.39H12a1.65 1.65 0 001.51.33c.64.37 1.32.16 1.82-.33l.06-.06A2 2 0 0118.3 3.7l-.06.06a1.65 1.65 0 00-.33 1.82c.25.44.39 1 .39 1.51V9a1.65 1.65 0 00.33 1.51c.37.64.16 1.32-.33 1.82l-.06.06A2 2 0 0119.4 15z" stroke="#9CA3AF" strokeWidth="1.0" />
        </svg>
      );
    default:
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="#CBD5E1" strokeWidth="1.2" />
        </svg>
      );
  }
};

const quickActions = [
  { label: 'Open Sam Concierge', href: '/?focus=sam', description: 'Continue your AI-powered thread.', icon: 'sam' },
  { label: 'Browse Workspace', href: '/chat', description: 'Jump back into any human chat.', icon: 'browse' },
  { label: 'My Bookings', href: '/bookings', description: 'View and manage your scheduled calls.', icon: 'bookings' },
  { label: 'Manage Availability', href: '/expert/availability', description: 'Set your calendar and available time slots.', icon: 'calendar' },
  { label: 'Account Preferences', href: '/account', description: 'Set availability, pricing, and chat settings.', icon: 'settings' }
];

export default function DashboardPage() {
  const { conversations, unreadTotal } = useConversationData();

  const { samConversation, recentHumanConversations } = useMemo(() => {
    const samEntry = conversations.find((entry) => entry.conversation.type === 'sam');
    const humans = conversations.filter((entry) => entry.conversation.type !== 'sam').slice(0, 4);
    return { samConversation: samEntry, recentHumanConversations: humans };
  }, [conversations]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05021b] to-[#070417] text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.03] px-6 py-5">
        <Link href="/?focus=sam" className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70 hover:text-white transition-colors">
          Humanchat.com
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <section className="grid gap-6 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="relative flex items-center gap-4 rounded-3xl border border-white/[0.03] bg-gradient-to-br from-white/[0.02] to-black/10 p-5 backdrop-blur-sm shadow-[0_10px_30px_rgba(3,7,18,0.4)] transition-transform hover:scale-[1.02]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-700/30 to-cyan-500/25 ring-1 ring-white/6">
                <Icon name={action.icon ?? 'default'} />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-white/50">Quick action</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{action.label}</h2>
                <p className="mt-1 text-sm text-white/70">{action.description}</p>
              </div>
            </Link>
          ))}
        </section>

        {samConversation && (
          <section className="rounded-3xl border border-white/[0.03] bg-gradient-to-br from-indigo-900/20 to-black/20 p-6 backdrop-blur-sm shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Sam Concierge</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Pick up where you left off</h3>
                <p className="text-sm text-white/70" suppressHydrationWarning>
                  Last activity · {new Date(samConversation.conversation.lastActivity).toLocaleString()}
                </p>
              </div>
              <Link
                href="/?focus=sam"
                className="rounded-full bg-white/5 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/8"
              >
                Go to chat
              </Link>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/[0.03] bg-gradient-to-br from-black/30 to-black/25 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Recent humans</p>
              <h3 className="text-xl font-semibold text-white">Continue a conversation</h3>
            </div>
            <Link href="/chat" className="text-sm font-semibold text-white/70 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {recentHumanConversations.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-sm text-white/60">
                No human conversations yet. Start one from the workspace.
              </p>
            )}
            {recentHumanConversations.map((entry) => (
              <Link
                key={entry.conversation.conversationId}
                href={`/chat?conversationId=${entry.conversation.conversationId}`}
                className="group flex flex-col gap-3 rounded-2xl border border-white/[0.03] bg-gradient-to-br from-black/35 to-black/20 p-4 transition hover:translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <img 
                      src={entry.meta.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.meta.displayName)}&background=4f46e5&color=fff&size=128`}
                      alt={entry.meta.displayName}
                      className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <div>
                      <p className="text-base font-semibold text-white">{entry.meta.displayName}</p>
                      <p className="text-sm text-white/60">Last activity · {new Date(entry.conversation.lastActivity).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-white/40">›</div>
                </div>
                <div className="rounded-lg border border-white/[0.02] bg-black/25 p-3 text-sm text-white/70">{entry.meta.lastMessage}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
