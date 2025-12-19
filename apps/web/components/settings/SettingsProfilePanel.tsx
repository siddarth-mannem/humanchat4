'use client';

import ProfilePanel from '../ProfilePanel';
import AccountIdentityForm from '../AccountIdentityForm';
import AccountNarrativeForm from '../AccountNarrativeForm';
import AccountPreferencesForm from '../AccountPreferencesForm';
import ProfileDetailsSummary from '../ProfileDetailsSummary';
import { useProfileDetails } from '../../hooks/useProfileDetails';

type ProfileState = ReturnType<typeof useProfileDetails>;

interface SettingsProfilePanelProps {
  profileState?: ProfileState;
  embedded?: boolean;
}

export default function SettingsProfilePanel({ profileState, embedded = false }: SettingsProfilePanelProps) {
  const resolvedProfileState = profileState ?? useProfileDetails();
  const containerClass = embedded ? 'space-y-6 text-white' : 'flex flex-col gap-8 text-white';

  return (
    <div className={containerClass}>
      <ProfilePanel variant="card" />
      <AccountIdentityForm profileState={resolvedProfileState} />
      <AccountNarrativeForm profileState={resolvedProfileState} />
      <AccountPreferencesForm profileState={resolvedProfileState} />
      <ProfileDetailsSummary profileState={resolvedProfileState} />
    </div>
  );
}
