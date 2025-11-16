"use client";

import clsx from 'clsx';

export type MobileNavRoute = 'home' | 'discover' | 'sam' | 'profile';

interface MobileBottomNavProps {
  active: MobileNavRoute;
  onChange: (route: MobileNavRoute) => void;
  hasUnread?: boolean;
}

const NAV_ITEMS: Array<{ key: MobileNavRoute; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'discover', label: 'Discover' },
  { key: 'sam', label: 'Sam' },
  { key: 'profile', label: 'Profile' }
];

export default function MobileBottomNav({ active, onChange, hasUnread }: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur-xl" aria-label="Primary navigation">
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={clsx(
              'flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold tracking-wide transition',
              active === item.key ? 'text-white' : 'text-white/60'
            )}
            aria-label={item.label}
            onClick={() => onChange(item.key)}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-xs uppercase">
              {item.label.charAt(0)}
            </span>
            <span>{item.label}</span>
            {hasUnread && item.key === 'home' && (
              <span className="mt-1 rounded-full bg-peach px-2 py-0.5 text-[10px] uppercase tracking-widest text-midnight">
                New
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
