"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

import LogoutButton from './LogoutButton';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import { useBreakpoint } from '../hooks/useBreakpoint';

const getInitials = (name?: string | null, email?: string | null) => {
  if (name) {
    const parts = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '');
    const joined = parts.join('');
    if (joined) {
      return joined;
    }
  }
  return email?.[0]?.toUpperCase() ?? 'HC';
};

interface UserSettingsMenuProps {
  variant?: 'default' | 'header';
}

export default function UserSettingsMenu({ variant = 'default' }: UserSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { identity, loading } = useAuthIdentity();
  const pathname = usePathname();
  const { isMobile } = useBreakpoint();
  
  // Hide in layout when on mobile in chat view (it will be shown in header instead)
  const shouldHideInLayout = variant === 'default' && isMobile && pathname?.startsWith('/chat');

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

  const statusLabel = identity ? `Account menu for ${identity.name}` : 'Open account menu';
  const initials = getInitials(identity?.name ?? null, identity?.email ?? null);
  const statusDot = identity ? 'bg-aqua' : loading ? 'bg-white/40' : 'bg-peach/70';

  useEffect(() => {
    return () => {
      clearHoverTimeout();
    };
  }, []);

  if (shouldHideInLayout) {
    return null;
  }

  const isHeaderVariant = variant === 'header';
  const buttonClassName = isHeaderVariant
    ? 'relative flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-[10px] border border-white/15 bg-white/5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 touch-action: manipulation'
    : 'relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm font-semibold text-white transition hover:border-white/50';

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
        className={buttonClassName}
        aria-label={statusLabel}
      >
        <span className="sr-only">{statusLabel}</span>
        <span aria-hidden>{initials}</span>
        {!isHeaderVariant && (
          <span
            aria-hidden
            className={clsx(
              'pointer-events-none absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-midnight shadow-[0_0_4px_rgba(0,0,0,0.45)]',
              statusDot
            )}
          />
        )}
      </button>
      <div
        className={clsx(
          'absolute mt-2 w-56 rounded-2xl border border-white/15 bg-black/80 p-3 text-sm text-white shadow-xl backdrop-blur-xl transition duration-150',
          isHeaderVariant ? 'right-0' : 'right-0',
          open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
        )}
      >
        <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.35em] text-white/70">
          Account status
        </div>
        {identity ? (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-white">{identity.name}</p>
            {identity.email && <p className="text-xs text-white/60">{identity.email}</p>}
          </div>
        ) : (
          <p className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            Not signed in — open the login panel or continue from signup.
          </p>
        )}
        <div className="space-y-2">
          {identity ? (
            <>
              <Link
                href="/account"
                className="block rounded-xl px-3 py-2 text-white/90 transition hover:bg-white/10"
              >
                Account
              </Link>
              <LogoutButton className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-white/90 hover:bg-white/10" />
            </>
          ) : (
            <Link
              href="/"
              className="block rounded-xl border border-white/15 px-3 py-2 text-center text-white/90 transition hover:border-white"
            >
              Go to login panel
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
