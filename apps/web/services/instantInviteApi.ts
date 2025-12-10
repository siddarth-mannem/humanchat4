import { db, saveInstantInvite } from '../../../src/lib/db';
import {
  mapConversationRecord,
  mapInviteRecord,
  mapSessionRecord,
  type ConversationRecord,
  type InstantInviteRecord,
  type SessionRecord
} from './conversationMapper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type AcceptResponse = {
  invite: InstantInviteRecord;
  session: SessionRecord;
  conversation: ConversationRecord;
};

type InviteOnlyResponse = {
  invite: InstantInviteRecord;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const fallback = 'Unable to process that invite right now.';
  const rawBody = await response.text();
  let payload: { data?: T; error?: { message?: string } } | null = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as { data?: T; error?: { message?: string } };
    } catch {
      payload = null;
    }
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error?.message || rawBody || fallback);
  }

  return payload.data;
};

const upsertConversation = async (record: ConversationRecord): Promise<void> => {
  const participants = record.participants ?? [];
  const mapped = mapConversationRecord(record, participants, record.linked_session_id ?? null);
  await db.conversations.put(mapped);
};

const upsertSession = async (record: SessionRecord): Promise<void> => {
  const mapped = mapSessionRecord(record);
  await db.sessions.put(mapped);
};

const upsertInvite = async (record: InstantInviteRecord): Promise<void> => {
  const mapped = mapInviteRecord(record);
  await saveInstantInvite(mapped);
};

export const acceptInstantInvite = async (inviteId: string): Promise<{ conversationId: string; sessionId: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/conversations/invites/${inviteId}/accept`, {
    method: 'POST',
    credentials: 'include'
  });
  const payload = await parseResponse<AcceptResponse>(response);
  await upsertConversation(payload.conversation);
  await upsertSession(payload.session);
  await upsertInvite(payload.invite);
  return { conversationId: payload.conversation.id, sessionId: payload.session.id };
};

export const declineInstantInvite = async (inviteId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/conversations/invites/${inviteId}/decline`, {
    method: 'POST',
    credentials: 'include'
  });
  const payload = await parseResponse<InviteOnlyResponse>(response);
  await upsertInvite(payload.invite);
};

export const cancelInstantInvite = async (inviteId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/conversations/invites/${inviteId}/cancel`, {
    method: 'POST',
    credentials: 'include'
  });
  const payload = await parseResponse<InviteOnlyResponse>(response);
  await upsertInvite(payload.invite);
};
