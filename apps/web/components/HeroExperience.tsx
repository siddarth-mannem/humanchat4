'use client';

import { useRef } from 'react';

import HeroLoginPanel, { type HeroLoginPanelHandle } from './HeroLoginPanel';

export default function HeroExperience() {
  const loginPanelRef = useRef<HeroLoginPanelHandle>(null);

  return (
    <div className="grid w-full max-w-6xl gap-8 rounded-[48px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.25),transparent_55%)] p-8 shadow-[0_40px_120px_rgba(2,6,23,0.75)] lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.85fr)] lg:p-12">
      <div className="flex flex-col justify-center gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-white/60">HumanChat</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
            Talk to anyone, from anywhere, about anything.
          </h1>
        </div>

        <p className="mt-8 max-w-2xl text-base text-white/60 sm:text-lg">
          AI can do a lot of things, but can it ever be truly human? We don’t think so, and that’s why we are working to bring
          all the humans on Earth together to talk to each other instead of just AI bots.
        </p>
      </div>

      <HeroLoginPanel ref={loginPanelRef} />
    </div>
  );
}
