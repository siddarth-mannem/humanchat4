/**
 * Call action buttons in chat header
 * Shows "Start video call" and "Start audio call" buttons
 */

'use client';

import { useState } from 'react';
import { Video, Phone } from 'lucide-react';
import { startCall } from '../services/callApi';
import { useRouter } from 'next/navigation';

interface ChatHeaderCallActionsProps {
  conversationId: string;
  isConversationAccepted: boolean;
}

export default function ChatHeaderCallActions({
  conversationId,
  isConversationAccepted,
}: ChatHeaderCallActionsProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  console.log('[ChatHeaderCallActions] Rendered:', { conversationId, isConversationAccepted });

  const handleStartCall = async (callType: 'video' | 'audio') => {
    console.log('[ChatHeaderCallActions] Starting call:', { conversationId, callType, isConversationAccepted });
    
    if (!isConversationAccepted) {
      console.warn('[ChatHeaderCallActions] Conversation not accepted');
      alert('Wait for the chat request to be accepted first');
      return;
    }

    setIsStarting(true);

    try {
      console.log('[ChatHeaderCallActions] Calling startCall API...');
      const result = await startCall({
        conversationId,
        callType,
      });
      
      console.log('[ChatHeaderCallActions] Call started successfully:', result);

      // Navigate to live room
      router.push(`/call/${result.callId}`);
    } catch (error: any) {
      console.error('[ChatHeaderCallActions] Failed to start call:', error);
      console.error('[ChatHeaderCallActions] Error details:', {
        status: error?.status,
        message: error?.message,
        fullError: JSON.stringify(error, null, 2)
      });
      
      if (error.status === 409) {
        alert('A call is already in progress');
      } else {
        alert(error.message || 'Failed to start call. Please try again.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Always show buttons, but disable if not accepted
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleStartCall('video')}
        disabled={isStarting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Start video call"
      >
        <Video size={20} />
        <span className="hidden sm:inline">Start video call</span>
      </button>

      <button
        onClick={() => handleStartCall('audio')}
        disabled={isStarting}
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Start audio call"
      >
        <Phone size={20} />
        <span className="hidden sm:inline">Start audio call</span>
      </button>
    </div>
  );
}
