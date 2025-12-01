export type ConversationType = 'sam' | 'human';
export type ConversationCategory = 'free' | 'paid' | 'charity';
export type SessionType = 'instant' | 'scheduled';
export type SessionStatus = 'pending' | 'in_progress' | 'complete';
export type PaymentMode = 'free' | 'paid' | 'charity';

export type UserRole = 'user' | 'admin' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  conversation_type: ConversationCategory;
  donation_preference: string | null;
  charity_id: string | null;
  charity_name: string | null;
  instant_rate_per_minute: number | null;
  scheduled_rates: Record<string, number> | null;
  is_online: boolean;
  has_active_session: boolean;
  managed: boolean;
  manager_id: string | null;
  confidential_rate: boolean | null;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  manager_display_name?: string | null;
  presence_state?: 'active' | 'idle' | 'offline' | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  host_user_id: string;
  guest_user_id: string;
  conversation_id: string;
  type: SessionType;
  status: SessionStatus;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  agreed_price: number;
  payment_mode: PaymentMode;
  payment_intent_id: string | null;
  donation_allowed?: boolean | null;
  donation_target?: string | null;
  donation_preference?: string | null;
  donation_amount?: number | null;
  charity_id?: string | null;
  charity_name?: string | null;
  charity_stripe_account_id?: string | null;
  confidential_rate?: boolean | null;
  representative_name?: string | null;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  created_at: string;
  updated_at: string;
}

export type SessionPaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed';

export interface SessionPayment {
  sessionId: string;
  paymentIntentId: string | null;
  amount: number;
  currency: string;
  status: SessionPaymentStatus;
  platformFee: number;
  hostPayout: number;
  charityId?: string | null;
  donationAmount?: number | null;
  donationIntentId?: string | null;
  donationCheckoutId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: string[];
  linked_session_id: string | null;
  last_activity: string;
  created_at: string;
}

export interface CalendarConnection {
  user_id: string;
  provider: 'google' | 'microsoft' | 'apple';
  account_email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  last_synced_at: string | null;
}

export interface Request {
  id: string;
  requester_user_id: string;
  target_user_id: string;
  manager_user_id?: string | null;
  representative_name?: string | null;
  message: string;
  preferred_time?: string | null;
  budget_range?: string | null;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

export type RequestedPersonStatus = 'pending' | 'contacted' | 'declined' | 'onboarded';

export interface RequestedPerson {
  name: string;
  normalized_name: string;
  request_count: number;
  status: RequestedPersonStatus;
  last_requested_at: string;
  created_at: string;
}

export interface RequestLog {
  id: string;
  user_id: string;
  requested_name: string;
  search_query: string;
  created_at: string;
}

export interface SamProfileSummary {
  name: string;
  headline: string;
  expertise: string[];
  rate_per_minute: number;
  status: 'available' | 'away' | 'booked';
}

export type SamAction =
  | {
      type: 'show_profiles';
      profiles: SamProfileSummary[];
    }
  | {
      type: 'offer_call';
      participant: string;
      availability_window: string;
      purpose: string;
    }
  | {
      type: 'create_session';
      host: string;
      guest: string;
      suggested_start: string;
      duration_minutes: number;
      notes: string;
    }
  | {
      type: 'follow_up_prompt';
      prompt: string;
    }
  | {
      type: 'system_notice';
      notice: string;
    };

export interface SamResponse {
  text: string;
  actions: SamAction[];
}

export interface SamChatResult extends SamResponse {
  conversationId: string;
}
