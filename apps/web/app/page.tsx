'use client';

import { useState } from 'react';
import ConversationSidebar from '../components/ConversationSidebar';
import ConversationView from '../components/ConversationView';

export default function HomePage() {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();

  return (
    <main>
      <ConversationSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
      />
      <ConversationView activeConversationId={activeConversationId} onSelectConversation={setActiveConversationId} />
    </main>
  );
}
