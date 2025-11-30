"use client";

import Link from 'next/link';
import { useState } from 'react';
import clsx from 'clsx';

import LogoutButton from './LogoutButton';

export default function UserSettingsMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-sm text-white transition hover:border-white/40"
      >
        <span className="h-2 w-2 rounded-full bg-aqua" aria-hidden />
        User Settings
      </button>
      <div
        className={clsx(
          'absolute right-0 mt-2 w-48 rounded-2xl border border-white/15 bg-black/80 p-2 text-sm text-white shadow-xl backdrop-blur-xl transition duration-150',
          open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
        )}
      >
        <Link
          href="/profile"
          className="block rounded-xl px-3 py-2 text-white/90 transition hover:bg-white/10"
        >
          Profile
        </Link>
        <LogoutButton className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2 text-left text-white/90 hover:bg-white/10" />
      </div>
    </div>
  );
}
