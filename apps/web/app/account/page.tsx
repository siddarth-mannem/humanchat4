'use client';

import UserSettingsMenu from '../../components/UserSettingsMenu';
import ProfilePanel from '../../components/ProfilePanel';
import ProfileDetailsSummary from '../../components/ProfileDetailsSummary';
import AccountPreferencesForm from '../../components/AccountPreferencesForm';
import AccountIdentityForm from '../../components/AccountIdentityForm';
import { useProfileDetails } from '../../hooks/useProfileDetails';

export default function AccountPage() {
  const profileState = useProfileDetails();

  return (
    <main className="min-h-screen bg-midnight text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Account</p>
          <h1 className="text-2xl font-semibold text-white">Account & Preferences</h1>
        </div>
        <UserSettingsMenu />
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex flex-col gap-8">
          <ProfilePanel variant="card" />
          <AccountIdentityForm profileState={profileState} />
          <AccountPreferencesForm profileState={profileState} />
          <ProfileDetailsSummary profileState={profileState} />
        </div>
      </div>
    </main>
  );
}
