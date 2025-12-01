"use client";

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';

import { firebaseAuth } from '../lib/firebaseClient';
import { logout } from '../services/authApi';
import { sessionStatusManager } from '../services/sessionStatusManager';
import { AUTH_UPDATED_EVENT } from '../constants/events';

interface LogoutButtonProps {
  className?: string;
  children?: ReactNode;
}

const LogoutButton = ({ className, children }: LogoutButtonProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      try {
        await logout();
      } catch (apiError) {
        console.error('Failed to clear server session', apiError);
      }
      try {
        await signOut(firebaseAuth);
      } catch (firebaseError) {
        console.error('Failed to clear Firebase session', firebaseError);
      }
    } finally {
      sessionStatusManager.setCurrentUserId(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT));
      }
      setIsLoading(false);
      router.replace('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className={clsx(
        'rounded-full border border-white/20 px-4 py-1 text-sm text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {children ?? (isLoading ? 'Signing out…' : 'Logout')}
    </button>
  );
};

export default LogoutButton;
