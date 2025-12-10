import { db, saveInstantInvite, type ProfileSummary } from '../../../src/lib/db';
import {
  mapConversationRecord,
  mapSessionRecord,
  mapInviteRecord,
  type ConversationRecord,
  type SessionRecord,
  type InstantInviteRecord
} from './conversationMapper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ConnectResponse {
  flow: 'session' | 'invite';
  conversation: ConversationRecord;
  session?: SessionRecord;
  invite?: InstantInviteRecord;
}

interface ApiErrorPayload {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

const CONNECT_ERROR_COPY: Record<string, string> = {
  TARGET_OFFLINE: 'That member is offline right now. Try again soon.',
  TARGET_BUSY: 'That member is already in a session. Give them a minute and retry.',
  REQUESTER_BUSY: 'You already have a live session. Wrap it up before starting a new one.',
  REQUEST_REQUIRED: 'This profile needs a managed request so their team can coordinate the chat.'
};

const handleResponse = async (response: Response): Promise<ConnectResponse> => {
  const fallback = 'Unable to start a live session right now.';
  const rawBody = await response.text();
  let payload: { data?: ConnectResponse } & ApiErrorPayload | null = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as { data?: ConnectResponse } & ApiErrorPayload;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorCode = payload?.error?.code;
    const friendly = (errorCode && CONNECT_ERROR_COPY[errorCode]) || payload?.error?.message || rawBody || fallback;
    throw new Error(friendly);
  }

  const data = payload?.data;
  if (!data?.conversation) {
    throw new Error(fallback);
  }

  if (data.flow === 'session' && !data.session) {
    throw new Error(fallback);
  }

  if (data.flow === 'invite' && !data.invite) {
    throw new Error('Waiting for their team to accept before joining you.');
  }

  return data;
};

export const connectNow = async (profile: ProfileSummary, currentUserId: string): Promise<string> => {
  if (!profile.userId) {
    throw new Error('Missing target profile id.');
  }

  const response = await fetch(`${API_BASE_URL}/api/conversations/connect`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_user_id: profile.userId })
  });

  const { conversation, session, invite, flow } = await handleResponse(response);
  const participants = Array.from(new Set([currentUserId, profile.userId]));
  const linkedSessionId = flow === 'session' ? session?.id ?? conversation.linked_session_id : conversation.linked_session_id;
  const conversationRecord = mapConversationRecord(conversation, participants, linkedSessionId ?? null);

  await db.conversations.put(conversationRecord);

  if (flow === 'session') {
    if (!session) {
      throw new Error('Missing session payload for instant connection.');
    }
    const sessionRecord = mapSessionRecord(session, profile);
    await db.sessions.put(sessionRecord);
    await db.messages.add({
      conversationId: conversationRecord.conversationId,
      senderId: 'sam',
      content: `${profile.name ?? 'Your host'} is getting ready to join you now.`,
      timestamp: Date.now(),
      type: 'system_notice'
    });
  } else {
    if (!invite) {
      throw new Error('Missing invite payload for handshake flow.');
    }
    const inviteRecord = mapInviteRecord(invite);
    await saveInstantInvite(inviteRecord);
  }

  return conversationRecord.conversationId;
};
