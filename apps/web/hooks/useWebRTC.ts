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
              // CRITICAL: Create a NEW MediaStream to trigger React re-render
              const mediaStream = new MediaStream();
              
              // Add existing tracks from previous stream
              if (prevStream) {
                prevStream.getTracks().forEach(t => mediaStream.addTrack(t));
              }
              
              // Add the new track
              mediaStream.addTrack(track.mediaStreamTrack);
              
              console.log('[useWebRTC] Remote stream updated (NEW OBJECT):', {
                audioTracks: mediaStream.getAudioTracks().length,
                videoTracks: mediaStream.getVideoTracks().length,
                audioEnabled: mediaStream.getAudioTracks()[0]?.enabled,
              });
              
              return mediaStream;
            });
          }
        });
        
        // CRITICAL: Subscribe to track publications immediately
        participant.on('trackPublished', (publication) => {
          console.log('[useWebRTC] Track published by remote participant:', {
            identity: participant.identity,
            kind: publication.kind,
            trackSid: publication.trackSid
          });
          
          // Subscribe to the track
          publication.setSubscribed(true);
        });
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        onParticipantDisconnected?.(participant);
      });

      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        console.log('Local track published:', publication.kind);
      });
      
      // Handle existing participants after room state is synced
      room.on(RoomEvent.Connected, () => {
        console.log('[useWebRTC] Room connected event - checking for existing participants');
        
        // Add a small delay to ensure room state is fully synced
        setTimeout(() => {
          // Now check for existing participants (works after room is fully connected)
          if (room.remoteParticipants && room.remoteParticipants.size > 0) {
            const existingParticipants = Array.from(room.remoteParticipants.values());
            console.log('[useWebRTC] Found existing participants:', {
              count: existingParticipants.length,
              identities: existingParticipants.map(p => p.identity)
            });
            
            existingParticipants.forEach((participant) => {
              console.log('[useWebRTC] Subscribing to existing participant:', {
                identity: participant.identity,
                trackPublicationsCount: participant.trackPublications.size
              });
              
              // Subscribe to their already-published tracks
              participant.trackPublications.forEach((publication) => {
                console.log('[useWebRTC] Existing track publication:', {
                  kind: publication.kind,
                  trackSid: publication.trackSid,
                  isSubscribed: publication.isSubscribed
                });
                
                // Explicitly subscribe
                if (!publication.isSubscribed) {
                  publication.setSubscribed(true);
                  console.log('[useWebRTC] Explicitly subscribed to track:', publication.trackSid);
                }
                
                if (publication.track) {
                  const track = publication.track;
                  console.log('[useWebRTC] Found existing track:', {
                    kind: track.kind,
                    trackId: track.sid,
                    enabled: track.mediaStreamTrack.enabled
                  });
                  
                  if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
                    track.mediaStreamTrack.enabled = true;
                    
                    setRemoteStream((prevStream) => {
                      // CRITICAL: Create a NEW MediaStream to trigger React re-render
                      const mediaStream = new MediaStream();
                      
                      // Add existing tracks
                      if (prevStream) {
                        prevStream.getTracks().forEach(t => mediaStream.addTrack(t));
                      }
                      
                      // Add new track
                      mediaStream.addTrack(track.mediaStreamTrack);
                      
                      console.log('[useWebRTC] Added existing track to remote stream (NEW OBJECT):', {
                        audioTracks: mediaStream.getAudioTracks().length,
                        videoTracks: mediaStream.getVideoTracks().length
                      });
                      
                      return mediaStream;
                    });
                  }
                }
              });
              
              // Also listen for future track publications
              participant.on('trackPublished', (publication) => {
                console.log('[useWebRTC] New track published by existing participant:', {
                  identity: participant.identity,
                  kind: publication.kind,
                  trackSid: publication.trackSid
                });
                publication.setSubscribed(true);
              });
              
              // Also listen for future track subscriptions
              participant.on('trackSubscribed', (track) => {
                console.log('[useWebRTC] Track subscribed from existing participant:', {
                  kind: track.kind,
                  trackId: track.sid
                });
                
                if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
                  track.mediaStreamTrack.enabled = true;
                  
                  setRemoteStream((prevStream) => {
                    // CRITICAL: Create a NEW MediaStream to trigger React re-render
                    const mediaStream = new MediaStream();
                    
                    // Add existing tracks
                    if (prevStream) {
                      prevStream.getTracks().forEach(t => mediaStream.addTrack(t));
                    }
                    
                    // Add new track
                    mediaStream.addTrack(track.mediaStreamTrack);
                    
                    console.log('[useWebRTC] Remote stream updated (NEW OBJECT):', {
                      audioTracks: mediaStream.getAudioTracks().length,
                      videoTracks: mediaStream.getVideoTracks().length
                    });
                    
                    return mediaStream;
                  });
                }
              });
            });
          } else {
            console.log('[useWebRTC] No existing participants found after delay');
          }
        }, 500); // Wait 500ms for room state to sync
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
