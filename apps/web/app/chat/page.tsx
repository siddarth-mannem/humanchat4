'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import ConversationSidebar from '../../components/ConversationSidebar';
import ConversationView from '../../components/ConversationView';
import MobileBottomNav, { type MobileNavRoute } from '../../components/MobileBottomNav';
import ProfilePanel from '../../components/ProfilePanel';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useConversationData } from '../../hooks/useConversationData';
import { useChatRequests } from '../../hooks/useChatRequests';
import { fetchUserProfile, type UserProfile } from '../../services/profileApi';
import { INSTANT_INVITE_TARGETED_EVENT, type InstantInviteTargetedDetail } from '../../constants/events';
import { PENDING_INVITE_CONVERSATION_KEY } from '../../constants/storageKeys';

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [shouldOpenSam, setShouldOpenSam] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'conversation'>('list');
  const [activeNav, setActiveNav] = useState<MobileNavRoute>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { isMobile, isTablet } = useBreakpoint();
  const { conversations, unreadTotal } = useConversationData();
  const {
    requests,
    loading: requestsLoading,
    error: requestsError,
    updateStatus,
    updatingId
  } = useChatRequests();
  const fetchedRequestersRef = useRef<Set<string>>(new Set());
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, Pick<UserProfile, 'name' | 'headline' | 'avatarUrl'>>>(
    {}
  );
  const pendingConversationParam = searchParams.get('conversationId');

  const samConversationId = useMemo(() => {
    return conversations.find((entry) => entry.conversation.type === 'sam')?.conversation.conversationId ?? 'sam-concierge';
  }, [conversations]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (focus === 'sam') {
      setShouldOpenSam(true);
    }
  }, []);

  useEffect(() => {
    if (!shouldOpenSam) return;
    setActiveConversationId(samConversationId);
    if (isMobile) {
      setActiveNav('sam');
      setMobilePane('conversation');
    } else {
      setActiveNav('home');
    }
  }, [shouldOpenSam, samConversationId, isMobile]);

  useEffect(() => {
    if (activeConversationId || shouldOpenSam) {
      return;
    }

    if (typeof window !== 'undefined') {
      const pendingStored = window.sessionStorage?.getItem(PENDING_INVITE_CONVERSATION_KEY);
      if (pendingStored) {
        return;
      }
    }

    const firstConversationId = conversations[0]?.conversation.conversationId;
    if (firstConversationId) {
      setActiveConversationId(firstConversationId);
    }
  }, [activeConversationId, conversations, shouldOpenSam]);

  const focusConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      if (isMobile) {
        setActiveNav('home');
        setMobilePane('conversation');
      } else {
        setActiveNav('home');
        setSidebarCollapsed(false);
      }
    },
    [isMobile]
  );

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    if (isMobile) {
      setMobilePane('conversation');
      setActiveNav('home');
    }
  };

  const handleBackToList = () => {
    setMobilePane('list');
  };

  const handleNavChange = (route: MobileNavRoute) => {
    setActiveNav(route);
    if (route === 'home') {
      setMobilePane(activeConversationId ? 'conversation' : 'list');
    }
    if (route === 'sam') {
      setActiveConversationId(samConversationId);
      setMobilePane('conversation');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleInstantInvite = (event: Event) => {
      const detail = (event as CustomEvent<InstantInviteTargetedDetail>).detail;
      if (!detail?.conversationId) {
        return;
      }
      focusConversation(detail.conversationId);
    };

    window.addEventListener(INSTANT_INVITE_TARGETED_EVENT, handleInstantInvite as EventListener);
    return () => {
      window.removeEventListener(INSTANT_INVITE_TARGETED_EVENT, handleInstantInvite as EventListener);
    };
  }, [focusConversation]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedConversationId = window.sessionStorage?.getItem(PENDING_INVITE_CONVERSATION_KEY);
    if (!storedConversationId) {
      return;
    }
    window.sessionStorage.removeItem(PENDING_INVITE_CONVERSATION_KEY);
    focusConversation(storedConversationId);
  }, [focusConversation]);

  useEffect(() => {
    if (!pendingConversationParam) {
      return;
    }
    focusConversation(pendingConversationParam);
    router.replace('/chat');
  }, [pendingConversationParam, focusConversation, router]);

  useEffect(() => {
    const pendingIds = requests
      .filter((request) => request.status === 'pending')
      .map((request) => request.requesterId)
      .filter((requesterId) => !fetchedRequestersRef.current.has(requesterId));
    if (pendingIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const hydrate = async () => {
      const results = await Promise.all(
        pendingIds.map(async (requesterId) => {
          try {
            return await fetchUserProfile(requesterId);
          } catch (error) {
            console.warn('Failed to load requester profile', { requesterId, error });
            return null;
          }
        })
      );
      if (cancelled) {
        return;
      }
      setRequesterProfiles((prev) => {
        const next = { ...prev };
        results.forEach((profile) => {
          if (profile) {
            next[profile.id] = {
              name: profile.name,
              headline: profile.headline,
              avatarUrl: profile.avatarUrl
            };
            fetchedRequestersRef.current.add(profile.id);
          }
        });
        return next;
      });
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [requests]);

  const handleRequestAction = useCallback(
    async (requestId: string, status: 'pending' | 'approved' | 'declined') => {
      const result = await updateStatus(requestId, status);
      if (status === 'approved' && result.conversation) {
        setActiveConversationId(result.conversation.conversationId);
        if (isMobile) {
          setMobilePane('conversation');
          setActiveNav('home');
        }
      }
      return result;
    },
    [isMobile, updateStatus]
  );

  return (
    <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-midnight text-white">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/10 bg-midnight px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/60">
        <span>Chat Window</span>
        {isTablet && (
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] normal-case tracking-normal text-white"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isMobile && (
          <div className="flex h-full shrink-0 overflow-hidden">
            <ConversationSidebar
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              collapsed={isTablet && sidebarCollapsed}
              requests={requests}
              requestProfiles={requesterProfiles}
              requestLoading={requestsLoading}
              requestError={requestsError}
              onRequestAction={handleRequestAction}
              requestActionPendingId={updatingId}
            />
          </div>
        )}

        {isMobile ? (
          <section
            className={clsx('relative flex min-h-0 flex-1 flex-col', {
              'overflow-hidden': !(activeNav === 'account'),
              'overflow-y-auto': activeNav === 'account'
            })}
          >
            {activeNav === 'account' && (
              <div className="flex flex-1">
                <ProfilePanel />
              </div>
            )}
            {activeNav === 'home' && mobilePane === 'list' && (
              <ConversationSidebar
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                requests={requests}
                requestProfiles={requesterProfiles}
                requestLoading={requestsLoading}
                requestError={requestsError}
                onRequestAction={handleRequestAction}
                requestActionPendingId={updatingId}
              />
            )}
            {(activeNav === 'sam' || (activeNav === 'home' && mobilePane === 'conversation')) && (
              <ConversationView
                activeConversationId={activeConversationId ?? samConversationId}
                onSelectConversation={handleSelectConversation}
                isMobile
                onBack={handleBackToList}
              />
            )}
          </section>
        ) : (
          <section className="flex flex-1 flex-col overflow-hidden">
            <ConversationView activeConversationId={activeConversationId} onSelectConversation={handleSelectConversation} />
          </section>
        )}
      </div>
      {isMobile && <MobileBottomNav active={activeNav} onChange={handleNavChange} hasUnread={unreadTotal > 0} />}
    </main>
  );
}
