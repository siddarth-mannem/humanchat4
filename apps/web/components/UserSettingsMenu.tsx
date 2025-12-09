"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import LogoutButton from './LogoutButton';
import type { AuthUser } from '../services/authApi';
import { fetchCurrentUser } from '../services/authApi';
import { AUTH_UPDATED_EVENT } from '../constants/events';

export default function UserSettingsMenu() {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<AuthUser | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  };

  const openWithHover = () => {
    clearHoverTimeout();
    setOpen(true);
  };

  const closeWithDelay = () => {
    clearHoverTimeout();
    hoverTimeout.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateIdentity = async () => {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          setIdentity(user);
        }
      } catch {
        if (!cancelled) {
          setIdentity(null);
        }
      }
    };

    void hydrateIdentity();

    const handleAuthChange = () => {
      void hydrateIdentity();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_UPDATED_EVENT, handleAuthChange);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_UPDATED_EVENT, handleAuthChange);
      }
      clearHoverTimeout();
    };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={openWithHover}
      onMouseLeave={closeWithDelay}
      onFocusCapture={() => {
        clearHoverTimeout();
        setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          clearHoverTimeout();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          clearHoverTimeout();
          setOpen((prev) => !prev);
        }}
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
        <div className="mb-1 rounded-xl bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
          {identity ? (
            <span>
              Logged in as <span className="text-white">{identity.name}</span>
            </span>
          ) : (
            'Not signed in'
          )}
        </div>
        {identity?.email && <p className="px-3 text-xs text-white/60">{identity.email}</p>}
        <Link
          href="/account"
          className="block rounded-xl px-3 py-2 text-white/90 transition hover:bg-white/10"
        >
          Account
        </Link>
        <LogoutButton className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2 text-left text-white/90 hover:bg-white/10" />
      </div>
    </div>
  );
}
