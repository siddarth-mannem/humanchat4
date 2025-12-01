'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import UserSettingsMenu from '../../components/UserSettingsMenu';
import { useConversationData } from '../../hooks/useConversationData';

const quickActions = [
  { label: 'Open Sam Concierge', href: '/chat?focus=sam', description: 'Continue your AI-powered thread.' },
  { label: 'Browse Workspace', href: '/chat', description: 'Jump back into any human chat.' },
  { label: 'Account Preferences', href: '/profile', description: 'Set availability, pricing, and chat settings.' }
];

export default function DashboardPage() {
  const { conversations, unreadTotal } = useConversationData();

  const { samConversation, recentHumanConversations } = useMemo(() => {
    const samEntry = conversations.find((entry) => entry.conversation.type === 'sam');
    const humans = conversations.filter((entry) => entry.conversation.type !== 'sam').slice(0, 4);
    return { samConversation: samEntry, recentHumanConversations: humans };
  }, [conversations]);

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Dashboard</p>
          <h1 className="text-2xl font-semibold text-white">Welcome back to HumanChat</h1>
          <p className="text-sm text-white/60">{unreadTotal > 0 ? `${unreadTotal} unread conversation${unreadTotal === 1 ? '' : 's'}` : 'All caught up'}</p>
        </div>
        <div className="ml-auto">
          <UserSettingsMenu />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <section className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-3xl border border-white/15 bg-white/5 p-5 transition hover:border-white/40"
            >
              <p className="text-sm uppercase tracking-[0.25em] text-white/50">Quick action</p>
              <h2 className="mt-3 text-lg font-semibold text-white">{action.label}</h2>
              <p className="mt-1 text-sm text-white/70">{action.description}</p>
            </Link>
          ))}
        </section>

        {samConversation && (
          <section className="rounded-3xl border border-indigoGlow/30 bg-indigoGlow/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-indigoGlow">Sam Concierge</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Pick up where you left off</h3>
                <p className="text-sm text-white/70">
                  Last activity · {new Date(samConversation.conversation.lastActivity).toLocaleString()}
                </p>
              </div>
              <Link
                href="/chat?focus=sam"
                className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40"
              >
                Go to chat
              </Link>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Recent humans</p>
              <h3 className="text-xl font-semibold text-white">Continue a conversation</h3>
            </div>
            <Link href="/chat" className="text-sm font-semibold text-white/70 underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {recentHumanConversations.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-sm text-white/60">
                No human conversations yet. Start one from the workspace.
              </p>
            )}
            {recentHumanConversations.map((entry) => (
              <Link
                key={entry.conversation.conversationId}
                href="/chat"
                className="rounded-2xl border border-white/15 bg-black/30 p-4 transition hover:border-white/40"
              >
                <p className="text-base font-semibold text-white">{entry.meta.displayName}</p>
                <p className="text-sm text-white/70">
                  Last activity · {new Date(entry.conversation.lastActivity).toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-white/60">{entry.meta.lastMessage}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
