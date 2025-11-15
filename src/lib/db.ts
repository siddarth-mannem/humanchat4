import Dexie, { Table, Transaction } from 'dexie';

const DATABASE_NAME = 'humanchat_db';

export type ConversationType = 'sam' | 'human';
export type MessageType = 'user_text' | 'sam_response' | 'system_notice';
export type SessionType = 'instant' | 'scheduled';
export type SessionStatus = 'pending' | 'in_progress' | 'complete';
export type PaymentMode = 'free' | 'paid' | 'charity';

export type SamActionType =
  | 'show_profiles'
  | 'offer_connection'
  | 'show_slots'
  | 'confirm_booking'
  | 'system_notice'
  | 'create_session'
  | 'open_conversation';

export interface ActionBase {
  id: string;
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
  instantRatePerMinute?: number;
  scheduledRates?: ScheduledRate[];
  availability?: string;
  isOnline?: boolean;
  hasActiveSession?: boolean;
  charityName?: string;
  donationPreference?: 'on' | 'off';
}

export interface ConnectionOption {
  mode: string;
  ratePerMinute?: number;
  etaMinutes?: number;
}

export type Action =
  | (ActionBase & { type: 'show_profiles'; profiles: ProfileSummary[] })
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
  | (ActionBase & {
      type: 'create_session';
      conversation: Conversation;
      session: Session;
    })
  | (ActionBase & {
      type: 'open_conversation';
      conversationId: string;
    })
  | ActionBase;

export interface Conversation {
  conversationId: string;
  type: ConversationType;
  participants: string[];
  linkedSessionId?: string;
  lastActivity: number;
  unreadCount: number;
}

export interface Message {
  id?: number;
  conversationId: string;
  senderId: string;
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
}

export interface Setting {
  key: string;
  value: unknown;
}

type MessageInput = Omit<Message, 'id' | 'conversationId' | 'timestamp'> & {
  timestamp?: number;
};

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
  messages!: Table<Message, number>;
  sessions!: Table<Session, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super(DATABASE_NAME);
    registerMigrations(this);
  }
}

export const db = new HumanChatDB();

const toDbError = (operation: string, error: unknown): Error => {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`[IndexedDB] Failed to ${operation}: ${message}`);
};

const ensureUpdated = (count: number, entity: string, id: string): void => {
  if (count === 0) {
    throw new Error(`${entity} not found: ${id}`);
  }
};

export const addMessage = async (
  conversationId: string,
  message: MessageInput
): Promise<number> => {
  try {
    const timestamp = message.timestamp ?? Date.now();
    const record: Message = {
      ...message,
      timestamp,
      conversationId
    };

    const id = await db.messages.add(record);
    const updated = await db.conversations.update(conversationId, {
      lastActivity: timestamp
    });
    ensureUpdated(updated, 'Conversation', conversationId);
    return id;
  } catch (error) {
    throw toDbError('add message', error);
  }
};

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

export const getConversation = async (
  conversationId: string
): Promise<Conversation | null> => {
  try {
    return (await db.conversations.get(conversationId)) ?? null;
  } catch (error) {
    throw toDbError('get conversation', error);
  }
};

export const getAllConversations = async (): Promise<Conversation[]> => {
  try {
    return await db.conversations.orderBy('lastActivity').reverse().toArray();
  } catch (error) {
    throw toDbError('get all conversations', error);
  }
};

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

export const getSession = async (sessionId: string): Promise<Session | null> => {
  try {
    return (await db.sessions.get(sessionId)) ?? null;
  } catch (error) {
    throw toDbError('get session', error);
  }
};

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

export const saveSetting = async (key: string, value: unknown): Promise<void> => {
  try {
    await db.settings.put({ key, value });
  } catch (error) {
    throw toDbError('save setting', error);
  }
};

export const getSetting = async (key: string): Promise<unknown> => {
  try {
    const result = await db.settings.get(key);
    return result?.value ?? null;
  } catch (error) {
    throw toDbError('get setting', error);
  }
};

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

export const clearUnread = async (conversationId: string): Promise<void> => {
  try {
    const updated = await db.conversations.update(conversationId, { unreadCount: 0 });
    ensureUpdated(updated, 'Conversation', conversationId);
  } catch (error) {
    throw toDbError('clear unread count', error);
  }
};

export { DATABASE_NAME };
