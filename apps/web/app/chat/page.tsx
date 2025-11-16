'use client';

import { useMemo, useState } from 'react';
import ConversationSidebar from '../../components/ConversationSidebar';
import ConversationView from '../../components/ConversationView';
import MobileBottomNav, { type MobileNavRoute } from '../../components/MobileBottomNav';
import DiscoverPanel from '../../components/DiscoverPanel';
import ProfilePanel from '../../components/ProfilePanel';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useConversationData } from '../../hooks/useConversationData';

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [mobilePane, setMobilePane] = useState<'list' | 'conversation'>('list');
  const [activeNav, setActiveNav] = useState<MobileNavRoute>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { isMobile, isTablet } = useBreakpoint();
  const { conversations, unreadTotal } = useConversationData();

  const samConversationId = useMemo(() => {
    return conversations.find((entry) => entry.conversation.type === 'sam')?.conversation.conversationId ?? 'sam-concierge';
  }, [conversations]);

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

  return (
    <main className="flex min-h-screen flex-col bg-midnight text-white">
      <div className="flex flex-1">
        {!isMobile && (
          <ConversationSidebar
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            collapsed={isTablet && sidebarCollapsed}
          />
        )}

        {isMobile ? (
          <section className="relative flex min-h-screen flex-1 flex-col">
            {activeNav === 'discover' && <DiscoverPanel onBookProfile={() => setActiveNav('home')} />}
            {activeNav === 'profile' && <ProfilePanel />}
            {activeNav === 'home' && mobilePane === 'list' && (
              <ConversationSidebar
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
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
          <section className="flex flex-1 flex-col">
            {isTablet && (
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="text-sm uppercase tracking-[0.2em] text-white/50">Workspace</span>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-4 py-1 text-sm"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                >
                  {sidebarCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>
            )}
            <ConversationView activeConversationId={activeConversationId} onSelectConversation={handleSelectConversation} />
          </section>
        )}
      </div>
      {isMobile && <MobileBottomNav active={activeNav} onChange={handleNavChange} hasUnread={unreadTotal > 0} />}
    </main>
  );
}
