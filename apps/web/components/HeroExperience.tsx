'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

import HeroLoginPanel, { type HeroLoginPanelHandle } from './HeroLoginPanel';
import { useAuthIdentity } from '../hooks/useAuthIdentity';

export default function HeroExperience() {
  const router = useRouter();
  const { identity } = useAuthIdentity();
  const loginPanelRef = useRef<HeroLoginPanelHandle>(null);

  const handlePrimaryAction = () => {
    if (identity) {
      router.push('/chat?focus=sam');
      return;
    }
    loginPanelRef.current?.focusEmailField();
  };

  return (
    <div className="grid w-full max-w-6xl gap-8 rounded-[48px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.25),transparent_55%)] p-8 shadow-[0_40px_120px_rgba(2,6,23,0.75)] lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.85fr)] lg:p-12">
      <div className="flex flex-col justify-center gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-white/60">HumanChat</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
            Talk to anyone, about anything.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/80 sm:text-lg">
            Sam is your concierge. Ask for a human, offer your own time, or keep the lights on for your team — all without
            leaving this screen.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-white/70">
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-aqua" aria-hidden />
            <span>Instant routing to vetted humans or back to Sam.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-aqua" aria-hidden />
            <span>One screen. No scroll. The login panel is always on the right.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-aqua" aria-hidden />
            <span>Account icon up top shows exactly who is signed in.</span>
          </li>
        </ul>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-midnight transition hover:scale-[1.02]"
          >
            Start chatting with Sam
          </button>
        </div>

        <p className="text-xs uppercase tracking-[0.3em] text-white/60">
          {identity ? `Signed in as ${identity.name}` : 'Not signed in — use the panel to log in instantly.'}
        </p>
      </div>

      <HeroLoginPanel ref={loginPanelRef} />
    </div>
  );
}
