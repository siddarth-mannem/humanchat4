/**
 * Live room component
 * Main video call interface with media streams
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CallControls from './CallControls';
import { endCall, markCallConnected } from '../services/callApi';
import { useWebRTC } from '../hooks/useWebRTC';

interface LiveRoomProps {
  callId: string;
  roomName: string;
  liveKitToken: string;
  callType: 'video' | 'audio';
  isHost?: boolean;
}

export default function LiveRoom({
  callId,
  roomName,
  liveKitToken,
  callType,
  isHost = false,
}: LiveRoomProps) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Use WebRTC hook (LiveKit integration)
  const {
    connect,
    disconnect,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    localStream,
    remoteStream,
    connectionState,
  } = useWebRTC({
    roomName,
    token: liveKitToken,
    onConnectionStateChange: async (state) => {
      setConnectionStatus(state);
      if (state === 'connected') {
        setIsConnecting(false);
        // Mark call as connected in backend to track duration
        try {
          await markCallConnected(callId);
          console.log('[LiveRoom] Call marked as connected');
        } catch (error) {
          console.error('[LiveRoom] Failed to mark call as connected:', error);
        }
      }
    },
    onParticipantConnected: () => {
      console.log('Remote participant joined');
    },
    onParticipantDisconnected: () => {
      console.log('Remote participant left');
      handleEndCall('normal');
    },
  });

  // Connect to room on mount
  useEffect(() => {
    console.log('[LiveRoom] Connecting to room...');
    connect();

    // Don't disconnect in cleanup - let explicit call actions handle disconnect
    // This prevents issues with React Strict Mode double-mounting
    return () => {
      console.log('[LiveRoom] Cleanup - not disconnecting (will be handled by end call)');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[LiveRoom] Setting remote stream:', {
        audioTracks: remoteStream.getAudioTracks().length,
        videoTracks: remoteStream.getVideoTracks().length,
        audioEnabled: remoteStream.getAudioTracks()[0]?.enabled,
      });
      remoteVideoRef.current.srcObject = remoteStream;
      // Ensure video element is not muted
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1.0;
      
      // Force play to ensure audio starts
      remoteVideoRef.current.play().catch((err) => {
        console.error('[LiveRoom] Failed to play remote video:', err);
      });
    }
  }, [remoteStream]);

  // Duration timer
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionStatus]);

  const handleEndCall = async (reason: 'normal' | 'error' = 'normal') => {
    try {
      await endCall(callId, reason);
      disconnect();
      router.push('/chat'); // Navigate back to chat
    } catch (error) {
      console.error('Failed to end call:', error);
      // Navigate anyway
      router.push('/chat');
    }
  };

  const handleToggleMute = async () => {
    await toggleAudio();
    setIsMuted(!isMuted);
  };

  const handleToggleCamera = async () => {
    if (callType === 'audio') return; // No video in audio calls
    
    await toggleVideo();
    setIsCameraOff(!isCameraOff);
  };

  const handleToggleScreenShare = async () => {
    await toggleScreenShare();
    setIsScreenSharing(!isScreenSharing);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-gray-800 rounded-full text-sm">
              <span className="text-white font-medium">
                {isHost ? 'Session: Free' : 'Session: Free'}
              </span>
            </div>
            <div className="text-white font-mono text-lg">
              {formatDuration(duration)}
            </div>
          </div>

          {connectionStatus === 'connecting' && (
            <div className="text-yellow-400 text-sm">Connecting...</div>
          )}
          {connectionStatus === 'reconnecting' && (
            <div className="text-orange-400 text-sm">Reconnecting...</div>
          )}
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 relative">
        {/* Remote video (full screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-cover"
        />

        {/* Local video (PiP) */}
        <div className="absolute bottom-24 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          {!isCameraOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="text-white text-4xl font-bold">
                {isHost ? 'H' : 'U'}
              </div>
            </div>
          )}
        </div>

        {/* Connecting overlay */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-xl">Connecting...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onTogglePiP={() => {
            // Toggle PiP mode (browser API)
            if (document.pictureInPictureElement) {
              document.exitPictureInPicture();
            } else if (localVideoRef.current) {
              localVideoRef.current.requestPictureInPicture();
            }
          }}
          onEndCall={() => handleEndCall('normal')}
          showCamera={callType === 'video'}
        />
      </div>
    </div>
  );
}
