'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import styles from './ConversationView.module.css';
import { useConversationDetail } from '../hooks/useConversationDetail';
import SamChatView from './SamChatView';
import SessionView from './SessionView';

interface ConversationViewProps {
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
}

type ScrollBinding = {
  node: HTMLDivElement | null;
  cleanup?: () => void;
};

export default function ConversationView({ activeConversationId, onSelectConversation }: ConversationViewProps) {
  const { conversation, session, messages, loading, error } = useConversationDetail(activeConversationId);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const bindingRef = useRef<ScrollBinding>({ node: null });

  const registerScrollContainer = useCallback(
    (node: HTMLDivElement | null) => {
      bindingRef.current.cleanup?.();
      bindingRef.current = { node };

      if (!node || !activeConversationId) {
        return;
      }

      const stored = scrollPositions.current.get(activeConversationId);
      if (typeof stored === 'number') {
        node.scrollTop = stored;
      } else {
        node.scrollTop = node.scrollHeight;
      }

      const handleScroll = () => {
        scrollPositions.current.set(activeConversationId, node.scrollTop);
      };

      node.addEventListener('scroll', handleScroll);
      const cleanup = () => {
        node.removeEventListener('scroll', handleScroll);
        scrollPositions.current.set(activeConversationId, node.scrollTop);
      };
      bindingRef.current.cleanup = cleanup;
    },
    [activeConversationId]
  );

  useEffect(() => {
    return () => {
      bindingRef.current.cleanup?.();
    };
  }, []);

  const summary = useMemo(() => {
    if (!activeConversationId) {
      return {
        title: 'No conversation selected',
        subtitle: 'Pick a conversation from the sidebar to get started.'
      };
    }
    if (!conversation) {
      return {
        title: 'Conversation not found',
        subtitle: 'It may have been removed locally. Try syncing again.'
      };
    }
    return {
      title: conversation.type === 'sam' ? 'Sam Concierge' : conversation.participants.join(', '),
      subtitle: conversation.type === 'sam' ? 'AI Concierge' : 'Direct chat'
    };
  }, [activeConversationId, conversation]);

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{summary.title}</div>
          <div className={styles.subtitle}>{summary.subtitle}</div>
        </div>
        {conversation && (
          <div className={styles.subtitle}>
            Last activity • {new Date(conversation.lastActivity).toLocaleTimeString()}
          </div>
        )}
      </div>
      <div className={styles.viewArea}>
        {!activeConversationId && <div className={styles.placeholder}>Choose a conversation to see the full history and context.</div>}
        {activeConversationId && loading && <div className={styles.loading}>Loading conversation…</div>}
        {activeConversationId && error && !loading && (
          <div className={styles.error}>Failed to load conversation. Please retry.</div>
        )}
        {activeConversationId && conversation && !loading && !error && (
          <div className={clsx(styles.viewArea)} key={conversation.conversationId}>
            {conversation.type === 'sam' ? (
              <SamChatView
                conversation={conversation}
                messages={messages}
                registerScrollContainer={registerScrollContainer}
                onOpenConversation={onSelectConversation}
                onConnectNow={(userId) => {
                  console.info('Connect now with', userId);
                }}
                onBookTime={(userId) => {
                  console.info('Book time with', userId);
                }}
              />
            ) : (
              <SessionView
                conversation={conversation}
                session={session}
                messages={messages}
                registerScrollContainer={registerScrollContainer}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
