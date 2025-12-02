import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ActionRenderer from '../ActionRenderer';
import type { Action, ProfileSummary } from '../../../../src/lib/db';

describe('ActionRenderer', () => {
  it('omits profiles that match the current user id', () => {
    const selfProfile: ProfileSummary = {
      userId: 'user-123',
      name: 'Self Person',
      conversationType: 'paid',
      instantRatePerMinute: 5,
      scheduledRates: [],
      isOnline: true,
      hasActiveSession: false
    };

    const otherProfile: ProfileSummary = {
      userId: 'mentor-456',
      name: 'River Product',
      conversationType: 'paid',
      instantRatePerMinute: 15,
      scheduledRates: [],
      isOnline: true,
      hasActiveSession: false
    };

    const action = {
      type: 'show_profiles',
      profiles: [selfProfile, otherProfile]
    } as Action;

    render(<ActionRenderer action={action} currentUserId="user-123" />);

    expect(screen.queryByText('Self Person')).not.toBeInTheDocument();
    expect(screen.getByText('River Product')).toBeInTheDocument();
  });
});
