'use client';

import { useRef } from 'react';
import Link from 'next/link';

import HeroLoginPanel, { type HeroLoginPanelHandle } from './HeroLoginPanel';

export default function HeroExperience() {
  const loginPanelRef = useRef<HeroLoginPanelHandle>(null);

  return (
    <div className="flex w-full flex-col gap-5 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.25),transparent_55%)] p-5 sm:gap-6 sm:p-5 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.85fr)] lg:gap-10 lg:p-12 lg:min-h-[600px]">
      <div className="flex flex-col justify-center gap-4 sm:gap-5 lg:gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-white/60">Humanchat.com</p>
          <h1 className="mt-3 font-display text-2xl sm:text-3xl leading-tight text-white lg:text-5xl">
            Talk to anyone, from anywhere, about anything.
          </h1>
        </div>

        <p className="mt-3 sm:mt-4 max-w-2xl text-sm text-white/70 lg:mt-6 lg:text-lg">
          AI can do a lot of things, but can it ever be truly human? We don't think so, and that's why we are working to bring all the humans on Earth together to talk to each other instead of just AI bots.
        </p>
      </div>

      <HeroLoginPanel ref={loginPanelRef} />
      <footer className="mt-8 pt-6 border-t border-white/10 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60">
          <Link href="/privacy" className="hover:text-white/80 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white/80 transition-colors">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
