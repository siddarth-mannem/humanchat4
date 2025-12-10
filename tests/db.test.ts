import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addMessage,
  clearUnread,
  createSession,
  db,
  getAllConversations,
  getConversation,
  getMessages,
  getSession,
  getSetting,
  getRequestsByRequester,
  getInstantInviteById,
  getLatestInviteForConversation,
  saveManagedRequest,
  incrementUnread,
  saveSetting,
  saveInstantInvite,
  removeInstantInvite,
  updateConversationActivity,
  updateSessionStatus
} from '../src/lib/db';

const seedConversation = async (conversationId: string) => {
  await db.conversations.put({
    conversationId,
    type: 'sam',
    participants: ['user', 'sam'],
    lastActivity: Date.now(),
    unreadCount: 0
  });
};

describe('Dexie helper functions', () => {
  beforeEach(async () => {
    if (db.isOpen()) {
      db.close();
    }
    await db.delete();
    await db.open();
  });

  afterAll(() => {
    if (db.isOpen()) {
      db.close();
    }
  });

  it('adds and retrieves messages for a conversation', async () => {
    const conversationId = 'sam';
    await seedConversation(conversationId);

    const messageId = await addMessage(conversationId, {
      senderId: 'user',
      content: 'Hello Sam',
      type: 'user_text'
    });

    expect(messageId).toBeGreaterThan(0);
    const messages = await getMessages(conversationId);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      conversationId,
      content: 'Hello Sam'
    });
  });

  it('tracks unread counts correctly', async () => {
    const conversationId = 'sam';
    await seedConversation(conversationId);

    await incrementUnread(conversationId);
    await incrementUnread(conversationId);
    await clearUnread(conversationId);

    const conversation = await getConversation(conversationId);
    expect(conversation?.unreadCount).toBe(0);
  });

  it('creates and updates session status', async () => {
    const conversationId = 'human-1';
    await seedConversation(conversationId);

    const session = await createSession({
      sessionId: 'session-1',
      conversationId,
      hostUserId: 'host',
      guestUserId: 'guest',
      type: 'instant',
      status: 'pending',
      startTime: Date.now(),
      durationMinutes: 15,
      agreedPrice: 75,
      paymentMode: 'paid'
    });

    expect(session.sessionId).toBe('session-1');

    await updateSessionStatus(session.sessionId, 'in_progress');
    await updateSessionStatus(session.sessionId, 'complete');

    const stored = await getSession(session.sessionId);
    expect(stored?.status).toBe('complete');
    expect(stored?.endTime).toBeDefined();
  });

  it('updates conversation activity timestamps', async () => {
    const conversationId = 'sam';
    await seedConversation(conversationId);

    const nextTimestamp = Date.now() + 10_000;
    await updateConversationActivity(conversationId, nextTimestamp);

    const conversation = await getConversation(conversationId);
    expect(conversation?.lastActivity).toBe(nextTimestamp);
  });

  it('saves and retrieves settings', async () => {
    await saveSetting('calendarSyncInterval', 300_000);
    const value = await getSetting('calendarSyncInterval');
    expect(value).toBe(300_000);
  });

  it('lists conversations ordered by last activity', async () => {
    await db.conversations.bulkPut([
      {
        conversationId: 'c1',
        type: 'sam',
        participants: ['user', 'sam'],
        lastActivity: 1,
        unreadCount: 0
      },
      {
        conversationId: 'c2',
        type: 'human',
        participants: ['user', 'mentor'],
        linkedSessionId: 'session-2',
        lastActivity: 2,
        unreadCount: 1
      }
    ]);

    const conversations = await getAllConversations();
    expect(conversations[0].conversationId).toBe('c2');
    expect(conversations[1].conversationId).toBe('c1');
  });

  it('persists managed connection requests', async () => {
    const now = Date.now();
    await saveManagedRequest({
      requestId: 'req-1',
      requesterId: 'guest-1',
      targetUserId: 'talent-9',
      managerId: 'rep-3',
      representativeName: 'Jordan from VIP Desk',
      message: 'Looking to collaborate next week',
      preferredTime: 'Next Tuesday afternoon',
      budgetRange: '$5k - $7k',
      status: 'pending',
      createdAt: now
    });

    const requests = await getRequestsByRequester('guest-1');
    expect(requests).toHaveLength(1);
    expect(requests[0].representativeName).toBe('Jordan from VIP Desk');
    expect(requests[0].status).toBe('pending');
  });

  it('stores and updates instant invites', async () => {
    const now = Date.now();
    const invite = {
      inviteId: 'invite-1',
      conversationId: 'conv-1',
      requesterUserId: 'user-a',
      targetUserId: 'user-b',
      status: 'pending' as const,
      expiresAt: now + 300000,
      createdAt: now,
      updatedAt: now
    };

    await saveInstantInvite(invite);
    const stored = await getInstantInviteById(invite.inviteId);
    expect(stored?.status).toBe('pending');

    await saveInstantInvite({ ...invite, status: 'accepted', acceptedAt: now + 1000, updatedAt: now + 1000 });
    const latest = await getLatestInviteForConversation('conv-1');
    expect(latest?.status).toBe('accepted');

    await removeInstantInvite(invite.inviteId);
    const removed = await getInstantInviteById(invite.inviteId);
    expect(removed).toBeNull();
  });
});
