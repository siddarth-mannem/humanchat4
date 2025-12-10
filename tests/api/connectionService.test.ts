import { initiateInstantConnection } from '../../src/server/services/connectionService';
import type { Conversation, Session, User } from '../../src/server/types';
import { ApiError } from '../../src/server/errors/ApiError';
import { getUserById } from '../../src/server/services/userService';
import { ensureHumanConversation, addConversationMessage } from '../../src/server/services/conversationService';
import { createSessionRecord, getSessionById, updateSessionStatus } from '../../src/server/services/sessionService';

jest.mock('../../src/server/services/userService', () => ({
  getUserById: jest.fn()
}));

jest.mock('../../src/server/services/conversationService', () => ({
  ensureHumanConversation: jest.fn(),
  addConversationMessage: jest.fn()
}));

jest.mock('../../src/server/services/sessionService', () => ({
  createSessionRecord: jest.fn(),
  getSessionById: jest.fn(),
  updateSessionStatus: jest.fn()
}));

const buildUser = (overrides: Partial<User>): User => {
  const now = new Date().toISOString();
  return {
    id: 'user-id',
    name: 'User',
    email: 'user@example.com',
    role: 'user',
    avatar_url: null,
    headline: null,
    bio: null,
    conversation_type: 'paid',
    donation_preference: null,
    charity_id: null,
    charity_name: null,
    instant_rate_per_minute: 5,
    scheduled_rates: null,
    is_online: true,
    has_active_session: false,
    managed: false,
    manager_id: null,
    confidential_rate: null,
    display_mode: 'normal',
    manager_display_name: null,
    presence_state: 'active',
    last_seen_at: now,
    created_at: now,
    updated_at: now,
    ...overrides
  };
};

const buildSession = (overrides: Partial<Session>): Session => {
  const now = new Date().toISOString();
  return {
    id: 'session-id',
    host_user_id: 'host-1',
    guest_user_id: 'guest-1',
    conversation_id: 'conversation-id',
    type: 'instant',
    status: 'pending',
    start_time: now,
    end_time: null,
    duration_minutes: 30,
    agreed_price: 0,
    payment_mode: 'free',
    payment_intent_id: null,
    donation_allowed: null,
    donation_target: null,
    donation_preference: null,
    donation_amount: null,
    charity_id: null,
    charity_name: null,
    charity_stripe_account_id: null,
    confidential_rate: null,
    representative_name: null,
    display_mode: null,
    created_at: now,
    updated_at: now,
    ...overrides
  };
};

const buildConversation = (overrides: Partial<Conversation>): Conversation => {
  const now = new Date().toISOString();
  return {
    id: 'conversation-id',
    type: 'human',
    participants: ['host-1', 'guest-1'],
    linked_session_id: null,
    last_activity: now,
    created_at: now,
    ...overrides
  };
};

const mockedGetUserById = getUserById as jest.MockedFunction<typeof getUserById>;
const mockedEnsureConversation = ensureHumanConversation as jest.MockedFunction<typeof ensureHumanConversation>;
const mockedAddConversationMessage = addConversationMessage as jest.MockedFunction<typeof addConversationMessage>;
const mockedCreateSessionRecord = createSessionRecord as jest.MockedFunction<typeof createSessionRecord>;
const mockedGetSessionById = getSessionById as jest.MockedFunction<typeof getSessionById>;
const mockedUpdateSessionStatus = updateSessionStatus as jest.MockedFunction<typeof updateSessionStatus>;

describe('initiateInstantConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses an existing session for the same participants instead of creating a new one', async () => {
    const requester = buildUser({ id: 'guest-1' });
    const target = buildUser({ id: 'host-1' });
    mockedGetUserById.mockResolvedValueOnce(requester).mockResolvedValueOnce(target);

    const conversation = buildConversation({ linked_session_id: 'session-id' });
    mockedEnsureConversation.mockResolvedValue(conversation);

    const existingSession = buildSession({
      id: 'session-id',
      host_user_id: 'host-1',
      guest_user_id: 'guest-1',
      status: 'pending'
    });
    mockedGetSessionById.mockResolvedValue(existingSession);

    const result = await initiateInstantConnection('guest-1', 'host-1');

    expect(result.flow).toBe('session');
    if (result.flow !== 'session') {
      throw new Error('Expected session flow when reusing existing session');
    }
    expect(result.session).toEqual(existingSession);
    expect(result.conversation.linked_session_id).toBe('session-id');
    expect(mockedCreateSessionRecord).not.toHaveBeenCalled();
    expect(mockedAddConversationMessage).not.toHaveBeenCalled();
  });

  it('expires a stale pending session and creates a new one', async () => {
    const requester = buildUser({ id: 'guest-1' });
    const target = buildUser({ id: 'host-1' });
    mockedGetUserById.mockResolvedValueOnce(requester).mockResolvedValueOnce(target);

    const conversation = buildConversation({ linked_session_id: 'stale-session' });
    mockedEnsureConversation.mockResolvedValue(conversation);

    const staleSession = buildSession({
      id: 'stale-session',
      host_user_id: 'host-1',
      guest_user_id: 'guest-1',
      status: 'pending',
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    });
    mockedGetSessionById.mockResolvedValue(staleSession);
    mockedUpdateSessionStatus.mockResolvedValue({ ...staleSession, status: 'complete' });

    const freshSession = buildSession({ id: 'fresh-session', host_user_id: 'host-1', guest_user_id: 'guest-1' });
    mockedCreateSessionRecord.mockResolvedValue(freshSession);

    const result = await initiateInstantConnection('guest-1', 'host-1');

    expect(mockedUpdateSessionStatus).toHaveBeenCalledWith('stale-session', 'complete');
    expect(mockedCreateSessionRecord).toHaveBeenCalled();
    expect(result.flow).toBe('session');
    if (result.flow !== 'session') {
      throw new Error('Expected session flow after creating new session');
    }
    expect(result.session.id).toBe('fresh-session');
  });

  it('throws when another user already has an active session with the target', async () => {
    const requester = buildUser({ id: 'guest-2' });
    const target = buildUser({ id: 'host-1' });
    mockedGetUserById.mockResolvedValueOnce(requester).mockResolvedValueOnce(target);

    const conversation = buildConversation({ linked_session_id: 'busy-session', participants: ['host-1', 'guest-2'] });
    mockedEnsureConversation.mockResolvedValue(conversation);

    const busySession = buildSession({
      id: 'busy-session',
      host_user_id: 'host-1',
      guest_user_id: 'someone-else',
      status: 'in_progress'
    });
    mockedGetSessionById.mockResolvedValue(busySession);

    await expect(initiateInstantConnection('guest-2', 'host-1')).rejects.toThrow(ApiError);
    expect(mockedCreateSessionRecord).not.toHaveBeenCalled();
  });
});
