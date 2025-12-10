/// <reference types="jest" />
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SamChatView from '../SamChatView';
import type { Conversation, Message, ProfileSummary } from '../../../../src/lib/db';

jest.mock('../../services/sessionStatusManager', () => {
  const getCurrentUserId = jest.fn(() => 'demo-user');
  const onCurrentUserChange = jest.fn((callback: (userId: string | null) => void) => {
    callback('demo-user');
    return jest.fn();
  });
  return {
    sessionStatusManager: {
      getCurrentUserId,
      onCurrentUserChange
    }
  };
});

const { sessionStatusManager: mockSessionStatusManager } = jest.requireMock('../../services/sessionStatusManager') as {
  sessionStatusManager: {
    getCurrentUserId: jest.Mock;
    onCurrentUserChange: jest.Mock;
  };
};

jest.mock('../../../../src/lib/db', () => ({
  addMessage: jest.fn(),
  db: {
    conversations: { put: jest.fn() },
    sessions: { put: jest.fn() }
  }
}));

const mockedDb = jest.requireMock('../../../../src/lib/db') as {
  addMessage: jest.Mock;
  db: {
    conversations: { put: jest.Mock };
    sessions: { put: jest.Mock };
  };
};

const addMessageMock = mockedDb.addMessage;
const conversationsPutMock = mockedDb.db.conversations.put;
const sessionsPutMock = mockedDb.db.sessions.put;

const notifyNewMessageMock = jest.fn();
jest.mock('../../utils/notifications', () => ({
  notifyNewMessage: (...args: unknown[]) => notifyNewMessageMock(...args)
}));

const mockFetchWithAuthRefresh = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: { users: [] } })
} as Response);

jest.mock('../../utils/fetchWithAuthRefresh', () => ({
  fetchWithAuthRefresh: (...args: unknown[]) => mockFetchWithAuthRefresh(...args)
}));

const sendSamMessageMock = jest.fn().mockResolvedValue({
  text: 'Here are a few matches for you.',
  actions: [
    {
      type: 'show_profiles',
      profiles: [
        {
          userId: 'mentor-301',
          name: 'River Product',
          conversationType: 'paid',
          instantRatePerMinute: 10,
          scheduledRates: [{ durationMinutes: 30, price: 200 }],
          isOnline: true,
          hasActiveSession: false
        } satisfies ProfileSummary
      ]
    }
  ]
});

jest.mock('../../utils/samAPI', () => ({
  sendSamMessage: (...args: unknown[]) => sendSamMessageMock(...args)
}));

describe('SamChatView', () => {
  beforeEach(() => {
    addMessageMock.mockReset().mockResolvedValue(1);
    conversationsPutMock.mockReset().mockResolvedValue(undefined);
    sessionsPutMock.mockReset().mockResolvedValue(undefined);
    notifyNewMessageMock.mockClear();
    sendSamMessageMock.mockClear();
    mockFetchWithAuthRefresh.mockClear();
    mockSessionStatusManager.getCurrentUserId.mockReturnValue('demo-user');
    mockSessionStatusManager.onCurrentUserChange.mockImplementation((callback: (userId: string | null) => void) => {
      callback('demo-user');
      return jest.fn();
    });
  });

  it('sends user draft to Sam concierge and renders returned actions', async () => {
    const conversation: Conversation = {
      conversationId: 'sam-concierge',
      type: 'sam',
      participants: ['demo-user', 'sam'],
      lastActivity: Date.now(),
      unreadCount: 0
    };
    const messages: Message[] = [
      {
        id: 1,
        conversationId: 'sam-concierge',
        senderId: 'sam',
        content: 'How can I help today?',
        timestamp: Date.now() - 1000,
        type: 'sam_response'
      }
    ];

    render(
      <SamChatView
        conversation={conversation}
        messages={messages}
        registerScrollContainer={() => undefined}
      />
    );

    await userEvent.type(screen.getByPlaceholderText('Message Sam...'), 'Find me a PM mentor');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(sendSamMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'sam-concierge',
          message: 'Find me a PM mentor'
        })
      );
    });

    expect(addMessageMock).toHaveBeenCalled();
    expect(notifyNewMessageMock).toHaveBeenCalled();
    const samMessage = addMessageMock.mock.calls.find(([, payload]) => payload.senderId === 'sam');
    expect(samMessage?.[1].actions?.[0]).toEqual(
      expect.objectContaining({
        profiles: expect.arrayContaining([expect.objectContaining({ name: 'River Product' })])
      })
    );
  });
});
