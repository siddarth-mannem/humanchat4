import type { Conversation, InstantInvite, ProfileSummary, Session as LocalSession } from '../../../src/lib/db';

export interface ConversationRecord {
  id: string;
  type: 'sam' | 'human';
  participants: string[];
  linked_session_id: string | null;
  last_activity: string;
}

export interface SessionRecord {
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

export interface InstantInviteRecord {
  id: string;
  conversation_id: string;
  requester_user_id: string;
  target_user_id: string;
  status: InstantInvite['status'];
  expires_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  cancelled_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export const toTimestamp = (value?: string | null): number => {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

export const mapConversationRecord = (
  record: ConversationRecord,
  participants: string[],
  linkedSessionId: string | null
): Conversation => ({
  conversationId: record.id,
  type: record.type,
  participants,
  linkedSessionId: linkedSessionId ?? undefined,
  lastActivity: toTimestamp(record.last_activity),
  unreadCount: 0
});

export const mapSessionRecord = (record: SessionRecord, profile?: ProfileSummary): LocalSession => ({
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
  instantRatePerMinute: profile?.instantRatePerMinute ?? undefined,
  paymentMode: record.payment_mode,
  donationAllowed: record.donation_allowed ?? profile?.donationPreference === 'on',
  donationPreference: profile?.donationPreference ?? record.donation_preference ?? undefined,
  donationTarget: record.donation_target ?? undefined,
  charityName: profile?.charityName ?? record.charity_name ?? undefined,
  charityId: profile?.charityId ?? record.charity_id ?? undefined,
  charityStripeAccountId: record.charity_stripe_account_id ?? undefined,
  confidentialRate: profile?.confidentialRate ?? record.confidential_rate ?? undefined,
  representativeName: record.representative_name ?? undefined,
  displayMode: record.display_mode ?? profile?.displayMode ?? undefined
});

export const mapInviteRecord = (record: InstantInviteRecord): InstantInvite => ({
  inviteId: record.id,
  conversationId: record.conversation_id,
  requesterUserId: record.requester_user_id,
  targetUserId: record.target_user_id,
  status: record.status,
  expiresAt: toTimestamp(record.expires_at),
  acceptedAt: record.accepted_at ? toTimestamp(record.accepted_at) : undefined,
  declinedAt: record.declined_at ? toTimestamp(record.declined_at) : undefined,
  cancelledAt: record.cancelled_at ? toTimestamp(record.cancelled_at) : undefined,
  metadata: record.metadata ?? null,
  createdAt: toTimestamp(record.created_at),
  updatedAt: toTimestamp(record.updated_at)
});
