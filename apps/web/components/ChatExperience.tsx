'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import ConversationSidebar from './ConversationSidebar';
import ConversationView from './ConversationView';
import ProfilePanel from './ProfilePanel';
import MobileBottomNav, { type MobileNavRoute } from './MobileBottomNav';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useConversationData } from '../hooks/useConversationData';
import { useChatRequests } from '../hooks/useChatRequests';
import { fetchUserProfile, type UserProfile } from '../services/profileApi';
import { INSTANT_INVITE_TARGETED_EVENT, type InstantInviteTargetedDetail } from '../constants/events';
import { PENDING_INVITE_CONVERSATION_KEY } from '../constants/storageKeys';

const ChatShell = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [shouldOpenSam, setShouldOpenSam] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<'none' | 'conversations' | 'profile'>('none');
  const [mobileNavRoute, setMobileNavRoute] = useState<MobileNavRoute>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { isMobile, isTablet } = useBreakpoint();
  const { conversations } = useConversationData();
  const {
    requests,
    loading: requestsLoading,
    error: requestsError,
    updateStatus,
    updatingId
  } = useChatRequests();
  const fetchedRequestersRef = useRef<Set<string>>(new Set());
  const [requesterProfiles, setRequesterProfiles] = useState<
    Record<string, Pick<UserProfile, 'name' | 'headline' | 'avatarUrl'>>
  >({});
  const pendingConversationParam = searchParams.get('conversationId');

  const samConversationId = useMemo(() => {
    return conversations.find((entry) => entry.conversation.type === 'sam')?.conversation.conversationId ?? 'sam-concierge';
  }, [conversations]);

  // Determine mobile nav route based on active conversation
  useEffect(() => {
    if (!isMobile) return;
    if (shouldOpenSam || activeConversationId === samConversationId) {
      setMobileNavRoute('sam');
    } else if (activeConversationId) {
      setMobileNavRoute('home');
    }
  }, [isMobile, activeConversationId, samConversationId, shouldOpenSam]);

  const handleMobileNavChange = useCallback(
    (route: MobileNavRoute) => {
      setMobileNavRoute(route);
      if (route === 'sam') {
        setShouldOpenSam(true);
        setActiveConversationId(samConversationId);
        setMobileDrawer('none');
      } else if (route === 'home') {
        setShouldOpenSam(false);
        const firstConversationId = conversations.find((entry) => entry.conversation.type !== 'sam')?.conversation.conversationId;
        if (firstConversationId) {
          setActiveConversationId(firstConversationId);
        }
        setMobileDrawer('none');
      } else if (route === 'account') {
        setMobileDrawer('profile');
      }
    },
    [samConversationId, conversations]
  );

  // Check for unread messages
  const hasUnread = useMemo(() => {
    return conversations.some((entry) => entry.conversation.unreadCount > 0);
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
      setMobileDrawer('none');
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
        setMobileDrawer('none');
      } else {
        setSidebarCollapsed(false);
      }
    },
    [isMobile]
  );

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    if (isMobile) {
      setMobileDrawer('none');
    }
  };

  const handleShowConversationDrawer = () => {
    setMobileDrawer('conversations');
  };

  const handleShowProfileDrawer = () => {
    setMobileDrawer('profile');
  };

  const handleCloseDrawers = () => {
    setMobileDrawer('none');
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
    router.replace('/');
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
          setMobileDrawer('none');
        }
      }
      return result;
    },
    [isMobile, updateStatus]
  );

  return (
    <main className={clsx('flex flex-col overflow-hidden bg-midnight text-white', isMobile ? 'h-[100dvh]' : 'h-screen min-h-screen')}>
      {isTablet && (
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/10 bg-midnight px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/60">
          <button
            type="button"
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] normal-case tracking-normal text-white"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </button>
        </header>
      )}

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
          <section className="relative flex min-h-0 flex-1 flex-col bg-midnight">
            <ConversationView
              key={`mobile-${activeConversationId ?? samConversationId}`}
              activeConversationId={activeConversationId ?? samConversationId}
              onSelectConversation={handleSelectConversation}
              isMobile
              onBack={handleShowConversationDrawer}
              onShowProfilePanel={handleShowProfileDrawer}
            />

            <div
              className={clsx('pointer-events-none absolute inset-0 z-30 flex', {
                'pointer-events-auto': mobileDrawer === 'conversations'
              })}
              aria-hidden={mobileDrawer !== 'conversations'}
            >
              <button
                type="button"
                className={clsx('absolute inset-0 bg-black/60 transition-opacity duration-200', {
                  'opacity-0': mobileDrawer !== 'conversations',
                  'opacity-100': mobileDrawer === 'conversations'
                })}
                onClick={handleCloseDrawers}
                aria-label="Close drawer"
              />
              <div
                className={clsx(
                  'relative h-full w-full max-w-[min(90%,360px)] border-r border-white/10 bg-midnight shadow-2xl transition-transform duration-200 ease-out',
                  {
                    '-translate-x-full': mobileDrawer !== 'conversations',
                    'translate-x-0': mobileDrawer === 'conversations'
                  }
                )}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm text-white/70">
                    <span>Inbox</span>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/70"
                      onClick={handleCloseDrawers}
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
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
                  </div>
                </div>
              </div>
            </div>

            <div
              className={clsx('pointer-events-none absolute inset-0 z-30 flex justify-end', {
                'pointer-events-auto': mobileDrawer === 'profile'
              })}
              aria-hidden={mobileDrawer !== 'profile'}
            >
              <button
                type="button"
                className={clsx('absolute inset-0 bg-black/60 transition-opacity duration-200', {
                  'opacity-0': mobileDrawer !== 'profile',
                  'opacity-100': mobileDrawer === 'profile'
                })}
                onClick={handleCloseDrawers}
                aria-label="Close drawer"
              />
              <div
                className={clsx(
                  'relative h-full w-full max-w-[min(90%,360px)] border-l border-white/10 bg-midnight shadow-2xl transition-transform duration-200 ease-out',
                  {
                    'translate-x-full': mobileDrawer !== 'profile',
                    'translate-x-0': mobileDrawer === 'profile'
                  }
                )}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm text-white/70">
                    <span>Account</span>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/70"
                      onClick={handleCloseDrawers}
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <ProfilePanel />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="flex flex-1 flex-col overflow-hidden">
              <ConversationView
                key={`desktop-${activeConversationId}`}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
              />
            </section>
            <div
              aria-hidden
              className="flex h-full shrink-0 flex-col border-l border-white/10 bg-midnight/40"
              style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)' }}
            />
          </>
        )}
      </div>
      {isMobile && (
        <MobileBottomNav active={mobileNavRoute} onChange={handleMobileNavChange} hasUnread={hasUnread} />
      )}
    </main>
  );
};

const ChatExperience = () => {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-midnight text-white/70">Loading chat...</div>}>
      <ChatShell />
    </Suspense>
  );
};

export default ChatExperience;
