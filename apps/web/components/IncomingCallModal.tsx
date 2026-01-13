/**
 * Incoming call modal
 * Shows caller info and Accept/Decline buttons
 */

'use client';

import { useEffect, useState } from 'react';
import { Video, Phone, X } from 'lucide-react';
import { acceptCall, declineCall } from '../services/callApi';
import { useRouter } from 'next/navigation';

interface IncomingCallModalProps {
  callId: string;
  caller: {
    userId: string;
    name: string;
    avatar?: string;
  };
  callType: 'video' | 'audio';
  onClose: () => void;
}

export default function IncomingCallModal({
  callId,
  caller,
  callType,
  onClose,
}: IncomingCallModalProps) {
  const router = useRouter();
  const [isResponding, setIsResponding] = useState(false);

  // Auto-dismiss after 60 seconds (timeout)
  useEffect(() => {
    const timeout = setTimeout(() => {
      onClose();
    }, 60000);

    return () => clearTimeout(timeout);
  }, [onClose]);

  const handleAccept = async () => {
    setIsResponding(true);

    try {
      console.log('[IncomingCallModal] Accepting call:', callId);
      const result = await acceptCall(callId);
      console.log('[IncomingCallModal] Call accepted, result:', result);
      
      // Navigate to live room with state
      router.push(`/call/${callId}?accepted=true`);
      onClose();
    } catch (error: any) {
      console.error('[IncomingCallModal] Failed to accept call:', error);
      alert(error.message || 'Failed to accept call');
    } finally {
      setIsResponding(false);
    }
  };

  const handleDecline = async () => {
    setIsResponding(true);

    try {
      await declineCall(callId, 'declined');
      onClose();
    } catch (error: any) {
      console.error('Failed to decline call:', error);
      onClose(); // Close anyway
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-700">
        {/* Close button */}
        <button
          onClick={handleDecline}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        {/* Caller avatar */}
        <div className="flex flex-col items-center mb-6">
          {caller.avatar ? (
            <img
              src={caller.avatar}
              alt={caller.name}
              className="w-24 h-24 rounded-full mb-4 border-4 border-blue-500"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center mb-4 text-white text-3xl font-bold">
              {caller.name.charAt(0).toUpperCase()}
            </div>
          )}

          <h2 className="text-2xl font-bold text-white mb-2">{caller.name}</h2>
          
          <div className="flex items-center gap-2 text-gray-300">
            {callType === 'video' ? (
              <>
                <Video size={20} />
                <span>Incoming video call</span>
              </>
            ) : (
              <>
                <Phone size={20} />
                <span>Incoming audio call</span>
              </>
            )}
          </div>
        </div>

        {/* Call animation */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 bg-blue-500 rounded-full animate-ping absolute"></div>
            <div className="w-16 h-16 bg-blue-500 rounded-full relative"></div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleDecline}
            disabled={isResponding}
            className="flex-1 py-3 px-6 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Decline
          </button>

          <button
            onClick={handleAccept}
            disabled={isResponding}
            className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
