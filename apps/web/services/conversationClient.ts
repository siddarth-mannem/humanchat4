import { db, type Conversation, type Session as LocalSession, type ProfileSummary } from '../../../src/lib/db';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ConversationRecord {
  id: string;
  type: 'sam' | 'human';
  participants: string[];
  linked_session_id: string | null;
  last_activity: string;
}

interface SessionRecord {
  id: string;
  host_user_id: string;
  guest_user_id: string;
  conversation_id: string;
  type: LocalSession['type'];
  status: LocalSession['status'];
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  agreed_price: number;
  payment_mode: LocalSession['paymentMode'];
  donation_allowed?: boolean | null;
  donation_target?: string | null;
  donation_preference?: 'on' | 'off' | null;
  donation_amount?: number | null;
  charity_name?: string | null;
  charity_id?: string | null;
  charity_stripe_account_id?: string | null;
  confidential_rate?: boolean | null;
  representative_name?: string | null;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  created_at: string;
  updated_at: string;
}

interface ConnectResponse {
  conversation: ConversationRecord;
  session: SessionRecord;
}

const handleResponse = async (response: Response): Promise<ConnectResponse> => {
  const fallback = 'Unable to start a live session right now.';
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || fallback);
  }
  const payload = (await response.json().catch(() => ({}))) as { data?: ConnectResponse };
  if (!payload?.data?.conversation || !payload?.data?.session) {
    throw new Error(fallback);
  }
  return payload.data;
};

const toTimestamp = (value?: string | null): number => {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const mapConversation = (record: ConversationRecord, participants: string[], linkedSessionId: string): Conversation => ({
  conversationId: record.id,
  type: record.type,
  participants,
  linkedSessionId,
  lastActivity: toTimestamp(record.last_activity),
  unreadCount: 0
});

const mapSession = (record: SessionRecord, profile: ProfileSummary): LocalSession => ({
  sessionId: record.id,
  conversationId: record.conversation_id,
  hostUserId: record.host_user_id,
  guestUserId: record.guest_user_id,
  type: record.type,
  status: record.status,
  startTime: toTimestamp(record.start_time),
  endTime: record.end_time ? toTimestamp(record.end_time) : undefined,
  durationMinutes: record.duration_minutes,
  agreedPrice: record.agreed_price,
  instantRatePerMinute: profile.instantRatePerMinute ?? undefined,
  paymentMode: record.payment_mode,
  donationAllowed: record.donation_allowed ?? profile.donationPreference === 'on',
  donationPreference: profile.donationPreference ?? record.donation_preference ?? undefined,
  donationTarget: record.donation_target ?? undefined,
  charityName: profile.charityName ?? record.charity_name ?? undefined,
  charityId: profile.charityId ?? record.charity_id ?? undefined,
  charityStripeAccountId: record.charity_stripe_account_id ?? undefined,
  confidentialRate: profile.confidentialRate ?? record.confidential_rate ?? undefined,
  representativeName: record.representative_name ?? null,
  displayMode: record.display_mode ?? profile.displayMode ?? undefined
});

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

  const { conversation, session } = await handleResponse(response);
  const participants = Array.from(new Set([currentUserId, profile.userId]));
  const conversationRecord = mapConversation(conversation, participants, session.id);
  const sessionRecord = mapSession(session, profile);

  await db.conversations.put(conversationRecord);
  await db.sessions.put(sessionRecord);
  await db.messages.add({
    conversationId: conversationRecord.conversationId,
    senderId: 'sam',
    content: `${profile.name ?? 'Your host'} is getting ready to join you now.`,
    timestamp: Date.now(),
    type: 'system_notice'
  });

  return conversationRecord.conversationId;
};
