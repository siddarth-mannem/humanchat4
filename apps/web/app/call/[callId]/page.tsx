/**
 * Call page - /call/[callId]
 * Main entry point for video/audio calls
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LiveRoom from '@/components/LiveRoom';
import { getCall } from '@/services/callApi';

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;

  const [callData, setCallData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCall() {
      try {
        const data = await getCall(callId);
        
        if (data.status === 'ended' || data.status === 'declined' || data.status === 'missed') {
          setError('This call has already ended');
          setTimeout(() => router.push('/chat'), 2000);
          return;
        }

        setCallData(data);
      } catch (err: any) {
        console.error('Failed to load call:', err);
        setError(err.message || 'Failed to load call');
        setTimeout(() => router.push('/chat'), 2000);
      } finally {
        setLoading(false);
      }
    }

    loadCall();
  }, [callId, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading call...</p>
        </div>
      </div>
    );
  }

  if (error || !callData) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error || 'Call not found'}</div>
          <p className="text-gray-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveRoom
      callId={callId}
      roomName={callData.roomName}
      liveKitToken={callData.liveKitToken}
      callType={callData.callType}
      isHost={callData.isHost}
    />
  );
}
