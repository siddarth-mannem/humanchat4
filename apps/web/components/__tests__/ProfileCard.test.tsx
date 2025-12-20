/// <reference types="jest" />
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileCard from '../ProfileCard';
import type { ProfileSummary } from '../../../../src/lib/db';

const baseProfile: ProfileSummary = {
  userId: 'member-101',
  name: 'Jordan Mentor',
  headline: 'Product leadership coach',
  conversationType: 'paid',
  instantRatePerMinute: 12,
  isOnline: true,
  hasActiveSession: false,
  linkedinUrl: 'https://www.linkedin.com/in/jordan',
  scheduledRates: [
    { durationMinutes: 30, price: 150 },
    { durationMinutes: 60, price: 280 }
  ]
};

describe('ProfileCard', () => {
  it('enables Connect Now when profile is online and idle', async () => {
    const connectSpy = jest.fn();
    render(<ProfileCard profile={baseProfile} onConnectNow={connectSpy} />);

    const connectButton = screen.getByRole('button', { name: /connect now/i });
    expect(connectButton).toBeEnabled();

    await userEvent.click(connectButton);
    expect(connectSpy).toHaveBeenCalledWith(baseProfile);
  });

  it('disables Connect Now while a connection is in progress', () => {
    const connectSpy = jest.fn();
    render(<ProfileCard profile={baseProfile} onConnectNow={connectSpy} isConnecting />);

    const connectButton = screen.getByRole('button', { name: /connecting/i });
    expect(connectButton).toBeDisabled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('shows request flow for managed confidential profiles', async () => {
    const profile: ProfileSummary = {
      ...baseProfile,
      managed: true,
      confidentialRate: true,
      hasActiveSession: true,
      isOnline: true
    };
    const connectSpy = jest.fn();
    const bookSpy = jest.fn();

    render(<ProfileCard profile={profile} onConnectNow={connectSpy} onBookTime={bookSpy} />);

    expect(screen.queryByRole('button', { name: /connect now/i })).toBeNull();
    const sendRequestButton = screen.getByRole('button', { name: /send request/i });
    await userEvent.click(sendRequestButton);
    expect(bookSpy).toHaveBeenCalledWith(profile);
    expect(connectSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/keeps these chats private/i)).toBeInTheDocument();
  });

  it('renders Human fallback copy when profile has no headline or bio', () => {
    const fallbackProfile: ProfileSummary = {
      ...baseProfile,
      headline: ''
    };

    render(<ProfileCard profile={fallbackProfile} />);

    expect(screen.getByText('Human')).toBeInTheDocument();
  });

  it('opens the expanded profile with social links', async () => {
    render(<ProfileCard profile={baseProfile} />);

    await userEvent.click(screen.getByRole('button', { name: /see full profile/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/find them online/i)).toBeInTheDocument();
    expect(screen.getByText('linkedin.com')).toBeInTheDocument();
  });
});
