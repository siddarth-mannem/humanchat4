"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'firebase/auth';

import { firebaseAuth } from '../lib/firebaseClient';
import { logout } from '../services/authApi';

const LogoutButton = () => {
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
      setIsLoading(false);
      router.replace('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-full border border-white/20 px-4 py-1 text-sm text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? 'Signing out…' : 'Logout'}
    </button>
  );
};

export default LogoutButton;
