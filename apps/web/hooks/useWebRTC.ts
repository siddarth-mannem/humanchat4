/**
 * WebRTC hook using LiveKit
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  RemoteParticipant,
  ConnectionState,
  DisconnectReason,
} from 'livekit-client';

interface UseWebRTCOptions {
  roomName: string;
  token: string;
  onConnectionStateChange?: (state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const {
    roomName,
    token,
    onConnectionStateChange,
    onParticipantConnected,
    onParticipantDisconnected,
  } = options;

  const roomRef = useRef<Room | null>(null);
  const isConnectingRef = useRef(false);
  const isDisconnectedRef = useRef(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [error, setError] = useState<Error | null>(null);

  /**
   * Connect to LiveKit room
   */
  const connect = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || roomRef.current || isDisconnectedRef.current) {
      console.log('[useWebRTC] Already connecting/connected/disconnected, skipping...', {
        isConnecting: isConnectingRef.current,
        hasRoom: !!roomRef.current,
        isDisconnected: isDisconnectedRef.current,
      });
      return;
    }

    isConnectingRef.current = true;

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: {
            width: 1280,
            height: 720,
            frameRate: 30,
          },
        },
      });

      roomRef.current = room;
      console.log('[useWebRTC] Room created and ref set');

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        console.log('Connected to room');
        setConnectionState('connected');
        onConnectionStateChange?.('connected');
      });

      room.on(RoomEvent.Reconnecting, () => {
        console.log('Reconnecting...');
        setConnectionState('reconnecting');
        onConnectionStateChange?.('reconnecting');
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('Reconnected');
        setConnectionState('connected');
        onConnectionStateChange?.('connected');
      });

      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        // Reason 1 = CLIENT_INITIATED (normal hangup)
        if (reason === 1) {
          console.log('[useWebRTC] Disconnected (client initiated)');
        } else {
          console.warn('[useWebRTC] Disconnected:', reason);
        }
        setConnectionState('disconnected');
        onConnectionStateChange?.('disconnected');
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
        onParticipantConnected?.(participant);
        
        // Subscribe to remote tracks
        participant.on('trackSubscribed', (track) => {
          console.log('[useWebRTC] Track subscribed:', {
            kind: track.kind,
            trackId: track.sid,
            enabled: track.mediaStreamTrack.enabled,
          });
          
          if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
            // Ensure track is enabled
            track.mediaStreamTrack.enabled = true;
            
            setRemoteStream((prevStream) => {
              // Create new stream or use existing
              const mediaStream = prevStream || new MediaStream();
              
              // Add the new track
              mediaStream.addTrack(track.mediaStreamTrack);
              
              console.log('[useWebRTC] Remote stream updated:', {
                audioTracks: mediaStream.getAudioTracks().length,
                videoTracks: mediaStream.getVideoTracks().length,
                audioEnabled: mediaStream.getAudioTracks()[0]?.enabled,
              });
              
              return mediaStream;
            });
          }
        });
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        onParticipantDisconnected?.(participant);
      });

      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        console.log('Local track published:', publication.kind);
      });

      // Connect with token
      const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://humanchat-grwb5joy.livekit.cloud';
      console.log('[useWebRTC] Connecting to LiveKit:', { 
        wsUrl, 
        roomName, 
        hasToken: !!token,
        tokenLength: token?.length,
        envUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL 
      });
      
      await room.connect(wsUrl, token);
      console.log('[useWebRTC] Successfully connected to room');

      // Check if still connected (might have been disconnected during async operation)
      if (!roomRef.current) {
        console.warn('[useWebRTC] Room was disconnected during connection, aborting setup');
        return;
      }

      // Enable local camera and microphone
      try {
        console.log('[useWebRTC] Requesting camera and microphone permissions...');
        await room.localParticipant.enableCameraAndMicrophone();
        console.log('[useWebRTC] Camera and microphone enabled successfully');
      } catch (mediaError) {
        console.error('[useWebRTC] Failed to enable media devices:', mediaError);
        // Continue anyway - remote viewing might still work
      }

      // Check again after async operation
      if (!roomRef.current) {
        console.warn('[useWebRTC] Room was disconnected during media setup, aborting');
        return;
      }

      // Get local stream from published tracks
      const localMediaStream = new MediaStream();
      
      if (room.localParticipant) {
        try {
          const trackPublications = (room.localParticipant as any).trackPublications || (room.localParticipant as any).tracks;
          if (trackPublications) {
            const localTracks = Array.from(trackPublications.values());
            localTracks.forEach((publication: any) => {
              if (publication?.track?.mediaStreamTrack) {
                localMediaStream.addTrack(publication.track.mediaStreamTrack);
              }
            });
          }
        } catch (err) {
          console.error('[useWebRTC] Error getting local tracks:', err);
        }
      }

      setLocalStream(localMediaStream.getTracks().length > 0 ? localMediaStream : null);
      console.log('[useWebRTC] Local stream set:', {
        hasStream: localMediaStream.getTracks().length > 0,
        trackCount: localMediaStream.getTracks().length,
        audioTracks: localMediaStream.getAudioTracks().length,
        videoTracks: localMediaStream.getVideoTracks().length,
      });

      isConnectingRef.current = false;
      console.log('[useWebRTC] Connection setup complete');

    } catch (err) {
      console.error('[useWebRTC] Failed to connect to room:', err);
      console.error('[useWebRTC] Error details:', {
        message: (err as Error).message,
        stack: (err as Error).stack,
      });
      setError(err as Error);
      setConnectionState('disconnected');
      onConnectionStateChange?.('disconnected');
      isConnectingRef.current = false;
    }
  }, [roomName, token, onConnectionStateChange, onParticipantConnected, onParticipantDisconnected]);

  /**
   * Disconnect from room
   */
  const disconnect = useCallback(() => {
    isDisconnectedRef.current = true;
    console.log('[useWebRTC] Disconnecting...');
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState('disconnected');
    isConnectingRef.current = false;
  }, []);

  /**
   * Toggle audio (mute/unmute)
   */
  const toggleAudio = useCallback(async () => {
    if (!roomRef.current) return;

    const localParticipant = roomRef.current.localParticipant;
    const isEnabled = localParticipant.isMicrophoneEnabled;

    await localParticipant.setMicrophoneEnabled(!isEnabled);
  }, []);

  /**
   * Toggle video (camera on/off)
   */
  const toggleVideo = useCallback(async () => {
    if (!roomRef.current) return;

    const localParticipant = roomRef.current.localParticipant;
    const isEnabled = localParticipant.isCameraEnabled;

    await localParticipant.setCameraEnabled(!isEnabled);
  }, []);

  /**
   * Toggle screen share
   */
  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return;

    const localParticipant = roomRef.current.localParticipant;
    const isSharing = localParticipant.isScreenShareEnabled;

    if (isSharing) {
      await localParticipant.setScreenShareEnabled(false);
    } else {
      await localParticipant.setScreenShareEnabled(true);
    }
  }, []);

  return {
    connect,
    disconnect,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    localStream,
    remoteStream,
    connectionState,
    error,
  };
}
