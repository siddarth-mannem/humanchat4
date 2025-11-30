'use client';

import UserSettingsMenu from '../../components/UserSettingsMenu';
import ProfilePanel from '../../components/ProfilePanel';

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Profile</p>
          <h1 className="text-2xl font-semibold text-white">Account & Preferences</h1>
        </div>
        <UserSettingsMenu />
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <ProfilePanel />
      </div>
    </main>
  );
}
