import Dexie, { Table, Transaction } from 'dexie';

const DATABASE_NAME = 'humanchat_db';

export type ConversationType = 'sam' | 'human';
export type MessageType = 'user_text' | 'sam_response' | 'system_notice';
export type SessionType = 'instant' | 'scheduled';
export type SessionStatus = 'pending' | 'in_progress' | 'complete';
export type PaymentMode = 'free' | 'paid' | 'charity';
export type InstantInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type BookingStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_user'
  | 'cancelled_by_expert'
  | 'no_show';

export type SamActionType =
  | 'show_profiles'
  | 'offer_connection'
  | 'show_slots'
  | 'confirm_booking'
  | 'system_notice'
  | 'create_session'
  | 'open_conversation'
  | 'offer_call'
  | 'follow_up_prompt';

export interface ActionBase {
  id?: string;
  label?: string;
  type?: SamActionType | string;
  actionType?: string; // legacy support
  payload?: Record<string, unknown>;
}

export interface ScheduledRate {
  durationMinutes: number;
  price: number;
}

export interface ProfileSummary {
  userId: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
  bio?: string;
  conversationType?: 'free' | 'paid' | 'charity';
  confidentialRate?: boolean;
  managed?: boolean;
  managerId?: string | null;
  managerName?: string | null;
  displayMode?: 'normal' | 'by_request' | 'confidential';
  instantRatePerMinute?: number;
  scheduledRates?: ScheduledRate[];
  availability?: string;
  isOnline?: boolean;
  hasActiveSession?: boolean;
  presenceState?: 'active' | 'idle' | 'offline';
  lastSeenAt?: number;
  charityName?: string;
  charityId?: string;
  charityStripeAccountId?: string;
  donationPreference?: 'on' | 'off';
}

export interface SamShowcaseProfile {
  name: string;
  headline?: string;
  expertise?: string[];
  rate_per_minute?: number;
  status?: 'available' | 'away' | 'booked';
}

export interface ConnectionOption {
  mode: string;
  ratePerMinute?: number;
  etaMinutes?: number;
}

export type Action =
  | (ActionBase & { type: 'show_profiles'; profiles: Array<ProfileSummary | SamShowcaseProfile> })
  | (ActionBase & {
      type: 'offer_connection';
      targetUserId: string;
      connectionOptions?: ConnectionOption[];
    })
  | (ActionBase & {
      type: 'show_slots';
      slots: Array<{ id: string; label: string; startTime: number }>;
    })
  | (ActionBase & { type: 'confirm_booking'; bookingId: string; summary: string })
  | (ActionBase & { type: 'system_notice'; notice: string })
  | (ActionBase &
      (
        | {
            type: 'create_session';
            conversation: Conversation;
            session: Session;
          }
        | {
            type: 'create_session';
            host: string;
            guest: string;
            suggested_start: string;
            duration_minutes: number;
            notes: string;
          }
      ))
  | (ActionBase & {
      type: 'open_conversation';
      conversationId: string;
    })
  | (ActionBase & {
      type: 'offer_call';
      participant: string;
      availability_window: string;
      purpose: string;
    })
  | (ActionBase & {
      type: 'follow_up_prompt';
      prompt: string;
    })
  | ActionBase;

export interface Conversation {
  conversationId: string;
  type: ConversationType;
  participants: string[];
  participantLabels?: Record<string, string>;
  participantAvatars?: Record<string, string>;
  linkedSessionId?: string;
  lastActivity: number;
  unreadCount: number;
}

export interface Message {
  id?: number;
  messageId?: string; // Backend message UUID
  conversationId: string;
  senderId: string;
  senderType?: string | null;
  content: string;
  timestamp: number;
  type: MessageType;
  actions?: Action[];
}

export interface Session {
  sessionId: string;
  conversationId: string;
  hostUserId: string;
  guestUserId: string;
  type: SessionType;
  status: SessionStatus;
  startTime: number;
  endTime?: number;
  durationMinutes: number;
  agreedPrice: number;
  instantRatePerMinute?: number;
  paymentMode: PaymentMode;
  donationAllowed?: boolean;
  donationTarget?: string;
  donationPreference?: 'on' | 'off';
  donationAmount?: number;
  charityName?: string;
  charityId?: string;
  charityStripeAccountId?: string;
  confidentialRate?: boolean;
  representativeName?: string | null;
  displayMode?: 'normal' | 'by_request' | 'confidential';
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface ChatRequest {
  requestId: string;
  requesterId: string;
  targetUserId: string;
  managerId?: string | null;
  representativeName?: string | null;
  message: string;
  preferredTime?: string | null;
  budgetRange?: string | null;
  status: 'pending' | 'approved' | 'declined';
  createdAt: number;
}

export interface InstantInvite {
  inviteId: string;
  conversationId: string;
  requesterUserId: string;
  targetUserId: string;
  status: InstantInviteStatus;
  expiresAt: number;
  acceptedAt?: number;
  declinedAt?: number;
  cancelledAt?: number;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface Booking {
  bookingId: string;
  expertId: string;
  expertName: string;
  expertAvatar: string | null;
  expertHeadline: string | null;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userEmail: string;
  startTime: number; // timestamp
  endTime: number; // timestamp
  durationMinutes: number;
  timezone: string;
  status: BookingStatus;
  meetingTitle: string | null;
  meetingNotes: string | null;
  meetingLink: string | null;
  calendarEventId: string | null;
  price: number | null;
  paymentStatus: string;
  cancellationReason: string | null;
  cancelledAt: number | null;
  cancelledBy: string | null;
  createdAt: number;
  updatedAt: number;
}

type MessageInput = Omit<Message, 'id' | 'conversationId' | 'timestamp'> & {
  timestamp?: number;
};

export type BootstrapPayload = {
  conversations?: Conversation[];
  messages?: Message[];
  sessions?: Session[];
  requests?: ChatRequest[];
  invites?: InstantInvite[];
};

declare global {
  interface Window {
    __HUMANCHAT_BOOTSTRAP__?: BootstrapPayload;
  }
}

type SchemaDefinition = Record<string, string>;

interface SchemaMigration {
  version: number;
  stores: SchemaDefinition;
  upgrade?: (transaction: Transaction) => Promise<void> | void;
}

/**
 * Schema migration plan:
 * - Append a new entry with an incremented version number whenever the schema changes.
 * - Describe store/index changes via the `stores` map.
 * - Provide an `upgrade` callback to backfill or transform existing data when needed.
 */
const schemaMigrations: SchemaMigration[] = [
  {
    version: 1,
    stores: {
      conversations: '&conversationId,type,linkedSessionId,lastActivity,unreadCount',
      messages: '++id,conversationId,senderId,timestamp,type',
      sessions: '&sessionId,conversationId,status,startTime,endTime',
      settings: '&key'
    }
  },
  {
    version: 2,
    stores: {
      conversations: '&conversationId,type,linkedSessionId,lastActivity,unreadCount',
      messages: '++id,conversationId,senderId,timestamp,type',
      sessions: '&sessionId,conversationId,status,startTime,endTime',
      settings: '&key',
      requests: '&requestId,targetUserId,managerId,requesterId,status,createdAt'
    }
  },
  {
    version: 3,
    stores: {
      conversations: '&conversationId,type,linkedSessionId,lastActivity,unreadCount',
      messages: '++id,conversationId,senderId,timestamp,type',
      sessions: '&sessionId,conversationId,status,startTime,endTime',
      settings: '&key',
      requests: '&requestId,targetUserId,managerId,requesterId,status,createdAt',
      instantInvites: '&inviteId,targetUserId,status,conversationId,expiresAt'
    }
  },
  {
    version: 4,
    stores: {
      conversations: '&conversationId,type,linkedSessionId,lastActivity,unreadCount',
      messages: '++id,messageId,conversationId,senderId,timestamp,type',
      sessions: '&sessionId,conversationId,status,startTime,endTime',
      settings: '&key',
      requests: '&requestId,targetUserId,managerId,requesterId,status,createdAt',
      instantInvites: '&inviteId,targetUserId,status,conversationId,expiresAt'
    }
  },
  {
    version: 5,
    stores: {
      conversations: '&conversationId,type,linkedSessionId,lastActivity,unreadCount',
      messages: '&messageId,conversationId,senderId,timestamp,type',
      sessions: '&sessionId,conversationId,status,startTime,endTime',
      settings: '&key',
      requests: '&requestId,targetUserId,managerId,requesterId,status,createdAt',
      instantInvites: '&inviteId,targetUserId,status,conversationId,expiresAt'
    }
  },
  {
    version: 6,
    stores: {
      conversations: '&conversationId,type,linkedSessionId,lastActivity,unreadCount',
      messages: '&messageId,conversationId,senderId,timestamp,type',
      sessions: '&sessionId,conversationId,status,startTime,endTime',
      settings: '&key',
      requests: '&requestId,targetUserId,managerId,requesterId,status,createdAt',
      instantInvites: '&inviteId,targetUserId,status,conversationId,expiresAt',
      bookings: '&bookingId,expertId,userId,status,startTime,endTime'
    }
  }
];

const registerMigrations = (db: Dexie): void => {
  for (const migration of schemaMigrations) {
    const dexieVersion = db.version(migration.version).stores(migration.stores);

    if (migration.upgrade) {
      dexieVersion.upgrade(migration.upgrade);
    }
  }
};

class HumanChatDB extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  sessions!: Table<Session, string>;
  settings!: Table<Setting, string>;
  requests!: Table<ChatRequest, string>;
  instantInvites!: Table<InstantInvite, string>;
  bookings!: Table<Booking, string>;

  constructor() {
    super(DATABASE_NAME);
    registerMigrations(this);
    this.on('populate', async () => {
      const bootstrap = getBootstrapSeed();
      if (!bootstrap) {
        return;
      }
      if (bootstrap.conversations?.length) {
        await this.conversations.bulkPut(bootstrap.conversations);
      }
      if (bootstrap.messages?.length) {
        await this.messages.bulkPut(bootstrap.messages);
      }
      if (bootstrap.sessions?.length) {
        await this.sessions.bulkPut(bootstrap.sessions);
      }
      if (bootstrap.requests?.length) {
        await this.requests.bulkPut(bootstrap.requests);
      }
      if (bootstrap.invites?.length) {
        await this.instantInvites.bulkPut(bootstrap.invites);
      }
    });
  }
}

export const db = new HumanChatDB();

function getBootstrapSeed(): BootstrapPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const scoped = (window as Window & { __HUMANCHAT_BOOTSTRAP__?: BootstrapPayload }).__HUMANCHAT_BOOTSTRAP__;
  if (!scoped) {
    return null;
  }
  return scoped;
}

const createLocalMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const toDbError = (operation: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`[IndexedDB] Failed to ${operation}: ${message}`);
};

const ensureUpdated = (count: number, entity: string, id: string): void => {
  if (count === 0) {
    throw new Error(`${entity} not found: ${id}`);
  }
};

/**
 * Persists a message in the Dexie store and bumps the parent conversation's activity timestamp.
 * @param conversationId - Identifier of the conversation receiving the message.
 * @param message - Partial message payload (without id) to be stored.
 * @returns Message identifier (UUID or generated placeholder).
 * @throws Error when the conversation cannot be updated or the add operation fails.
 */
export const addMessage = async (
  conversationId: string,
  message: MessageInput
): Promise<string> => {
  try {
    const timestamp = message.timestamp ?? Date.now();
    const messageId = message.messageId ?? createLocalMessageId();
    const record: Message = {
      ...message,
      messageId,
      timestamp,
      conversationId
    };

    await db.messages.put(record);
    const updated = await db.conversations.update(conversationId, {
      lastActivity: timestamp
    });
    ensureUpdated(updated, 'Conversation', conversationId);
    return messageId;
  } catch (error) {
    throw toDbError('add message', error);
  }
};

/**
 * Retrieves all messages for a conversation sorted by timestamp.
 * @param conversationId - Conversation identifier to query.
 * @returns Chronologically sorted array of messages.
 */
export const getMessages = async (conversationId: string): Promise<Message[]> => {
  try {
    return await db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('timestamp');
  } catch (error) {
    throw toDbError('get messages', error);
  }
};

/**
 * Fetches a single conversation record or null when missing.
 * @param conversationId - Primary key of the conversation.
 */
export const getConversation = async (
  conversationId: string
): Promise<Conversation | null> => {
  try {
    return (await db.conversations.get(conversationId)) ?? null;
  } catch (error) {
    throw toDbError('get conversation', error);
  }
};

/**
 * Lists all conversations ordered by most recent activity.
 */
export const getAllConversations = async (): Promise<Conversation[]> => {
  try {
    return await db.conversations.orderBy('lastActivity').reverse().toArray();
  } catch (error) {
    throw toDbError('get all conversations', error);
  }
};

/**
 * Updates the `lastActivity` timestamp for a conversation.
 * @param conversationId - Conversation identifier to update.
 * @param timestamp - Replacement timestamp (defaults to now).
 */
export const updateConversationActivity = async (
  conversationId: string,
  timestamp: number = Date.now()
): Promise<void> => {
  try {
    const updated = await db.conversations.update(conversationId, {
      lastActivity: timestamp
    });
    ensureUpdated(updated, 'Conversation', conversationId);
  } catch (error) {
    throw toDbError('update conversation activity', error);
  }
};

/**
 * Inserts a session record and links it to its conversation.
 * @param sessionData - Fully populated session payload.
 * @returns The same session payload once persisted.
 */
export const createSession = async (sessionData: Session): Promise<Session> => {
  try {
    if (sessionData.durationMinutes < 15) {
      throw new Error('Session duration must be at least 15 minutes.');
    }
    await db.sessions.put(sessionData);
    const updated = await db.conversations.update(sessionData.conversationId, {
      linkedSessionId: sessionData.sessionId
    });
    ensureUpdated(updated, 'Conversation', sessionData.conversationId);
    return sessionData;
  } catch (error) {
    throw toDbError('create session', error);
  }
};

/**
 * Fetches a session by id.
 * @param sessionId - Primary key of the session.
 */
export const getSession = async (sessionId: string): Promise<Session | null> => {
  try {
    return (await db.sessions.get(sessionId)) ?? null;
  } catch (error) {
    throw toDbError('get session', error);
  }
};

/**
 * Updates the status (and optional endTime) for a session record.
 * @param sessionId - Target session id.
 * @param status - New status value.
 * @param endTime - Optional custom completion timestamp.
 */
export const updateSessionStatus = async (
  sessionId: string,
  status: SessionStatus,
  endTime?: number
): Promise<void> => {
  try {
    const payload: Partial<Session> = { status };
    if (status === 'complete') {
      payload.endTime = endTime ?? Date.now();
    }
    const updated = await db.sessions.update(sessionId, payload);
    ensureUpdated(updated, 'Session', sessionId);
  } catch (error) {
    throw toDbError('update session status', error);
  }
};

/**
 * Stores or replaces a setting key/value pair.
 * @param key - Setting identifier.
 * @param value - Serializable payload.
 */
export const saveSetting = async (key: string, value: unknown): Promise<void> => {
  try {
    await db.settings.put({ key, value });
  } catch (error) {
    throw toDbError('save setting', error);
  }
};

/**
 * Retrieves a setting by key.
 * @param key - Setting identifier to look up.
 */
export const getSetting = async (key: string): Promise<unknown> => {
  try {
    const result = await db.settings.get(key);
    return result?.value ?? null;
  } catch (error) {
    throw toDbError('get setting', error);
  }
};

/**
 * Increments the unread counter for a conversation.
 * @param conversationId - Conversation to mutate.
 */
export const incrementUnread = async (conversationId: string): Promise<void> => {
  try {
    const updated = await db.conversations
      .where('conversationId')
      .equals(conversationId)
      .modify((record) => {
        record.unreadCount = (record.unreadCount ?? 0) + 1;
      });
    ensureUpdated(updated, 'Conversation', conversationId);
  } catch (error) {
    throw toDbError('increment unread count', error);
  }
};

/**
 * Resets the unread counter to zero for a conversation.
 * @param conversationId - Conversation id to clear.
 */
export const clearUnread = async (conversationId: string): Promise<void> => {
  try {
    const updated = await db.conversations.update(conversationId, { unreadCount: 0 });
    ensureUpdated(updated, 'Conversation', conversationId);
  } catch (error) {
    throw toDbError('clear unread count', error);
  }
};

/**
 * Removes a conversation and all related Dexie records in a single transaction.
 * @param conversationId - Conversation identifier to remove.
 */
export const deleteConversationCascade = async (conversationId: string): Promise<void> => {
  try {
    await db.transaction('rw', db.conversations, db.messages, db.sessions, db.instantInvites, async () => {
      const existing = await db.conversations.get(conversationId);
      if (!existing) {
        return;
      }
      await db.messages.where('conversationId').equals(conversationId).delete();
      await db.sessions.where('conversationId').equals(conversationId).delete();
      await db.instantInvites.where('conversationId').equals(conversationId).delete();
      await db.conversations.delete(conversationId);
    });
  } catch (error) {
    throw toDbError('delete conversation', error);
  }
};

/**
 * Persists a managed connection request for concierge workflows.
 * @param request - Managed request payload to store.
 */
export const saveChatRequest = async (request: ChatRequest): Promise<void> => {
  try {
    await db.requests.put(request);
  } catch (error) {
    throw toDbError('save chat request', error);
  }
};

/**
 * Lists managed requests assigned to a specific manager.
 * @param managerId - Manager identifier.
 */
export const getRequestsByManager = async (managerId: string): Promise<ChatRequest[]> => {
  try {
    const rows = await db.requests.where('managerId').equals(managerId).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    throw toDbError('list manager requests', error);
  }
};

/**
 * Lists managed requests submitted by a requester.
 * @param requesterId - Requester identifier.
 */
export const getRequestsByRequester = async (requesterId: string): Promise<ChatRequest[]> => {
  try {
    const rows = await db.requests.where('requesterId').equals(requesterId).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    throw toDbError('list requester requests', error);
  }
};

/**
 * Lists requests targeting a specific expert/host.
 * @param targetUserId - Target identifier.
 */
export const getRequestsForTarget = async (targetUserId: string): Promise<ChatRequest[]> => {
  try {
    const rows = await db.requests.where('targetUserId').equals(targetUserId).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    throw toDbError('list target requests', error);
  }
};

export const saveInstantInvite = async (invite: InstantInvite): Promise<void> => {
  try {
    await db.instantInvites.put(invite);
  } catch (error) {
    throw toDbError('save instant invite', error);
  }
};

export const removeInstantInvite = async (inviteId: string): Promise<void> => {
  try {
    await db.instantInvites.delete(inviteId);
  } catch (error) {
    throw toDbError('remove instant invite', error);
  }
};

export const getInstantInviteById = async (inviteId: string): Promise<InstantInvite | null> => {
  try {
    return (await db.instantInvites.get(inviteId)) ?? null;
  } catch (error) {
    throw toDbError('get instant invite', error);
  }
};

export const getLatestInviteForConversation = async (conversationId: string): Promise<InstantInvite | null> => {
  try {
    const invites = await db.instantInvites.where('conversationId').equals(conversationId).sortBy('updatedAt');
    return invites.pop() ?? null;
  } catch (error) {
    throw toDbError('get latest instant invite', error);
  }
};

export { DATABASE_NAME };
