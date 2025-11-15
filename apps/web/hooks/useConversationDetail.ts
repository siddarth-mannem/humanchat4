'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type Conversation, type Message, type Session } from '../../../src/lib/db';

interface ConversationDetailState {
  conversation: Conversation | null;
  session: Session | null;
  messages: Message[];
  loading: boolean;
  error: Error | null;
}

const initialState: ConversationDetailState = {
  conversation: null,
  session: null,
  messages: [],
  loading: false,
  error: null
};

const fetchConversationDetail = async (conversationId: string) => {
  const conversation = await db.conversations.get(conversationId);
  if (!conversation) {
    return null;
  }

  const [messages, session] = await Promise.all([
    db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('timestamp'),
    conversation.linkedSessionId ? db.sessions.get(conversation.linkedSessionId) : null
  ]);

  return { conversation, session, messages };
};

export const useConversationDetail = (conversationId?: string) => {
  const [state, setState] = useState<ConversationDetailState>(initialState);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    subscriptionRef.current?.unsubscribe();

    if (!conversationId) {
      setState(initialState);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const subscription = liveQuery(() => fetchConversationDetail(conversationId)).subscribe({
      next: (result) => {
        if (!result) {
          setState({ conversation: null, session: null, messages: [], loading: false, error: null });
          return;
        }
        const session = result.session ?? null;
        setState({ ...result, session, loading: false, error: null });
      },
      error: (err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ conversation: null, session: null, messages: [], loading: false, error });
      }
    });

    subscriptionRef.current = subscription;

    return () => subscription.unsubscribe();
  }, [conversationId]);

  const summary = useMemo(() => state, [state]);

  return summary;
};
