/// <reference types="jest" />
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  it('shows in-call state when online with active session', () => {
    render(<StatusBadge isOnline hasActiveSession />);
    expect(screen.getByText(/online • in call/i)).toBeInTheDocument();
  });

  it('shows offline state when user is offline', () => {
    render(<StatusBadge isOnline={false} />);
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('shows idle state when presence is idle', () => {
    render(<StatusBadge isOnline presenceState="idle" />);
    expect(screen.getByText(/idle/i)).toBeInTheDocument();
  });
});
