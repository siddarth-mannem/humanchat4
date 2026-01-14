'use client';

const WS_BASE_URL = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000').replace(/^http/i, 'ws');
const DEFAULT_SIGNALING_PATH = '/session';

const DEFAULT_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

const ICE_SERVERS = [
  ...DEFAULT_ICE,
  ...(TURN_URL && TURN_USERNAME && TURN_CREDENTIAL
    ? [{ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL }]
    : [])
];

export type VideoCallState = 'idle' | 'permission' | 'connecting' | 'connected' | 'failed' | 'disconnected' | 'ended';

export interface CallMetrics {
  audioLevel: number;
  connectionState?: RTCPeerConnectionState;
  iceState?: RTCIceConnectionState;
}

interface VideoCallEvents {
  state: (state: VideoCallState) => void;
  localStream: (stream: MediaStream | null) => void;
  remoteStream: (stream: MediaStream | null) => void;
  error: (message: string) => void;
  metric: (metrics: CallMetrics) => void;
}

const createListenerMap = () => ({
  state: new Set<VideoCallEvents['state']>(),
  localStream: new Set<VideoCallEvents['localStream']>(),
  remoteStream: new Set<VideoCallEvents['remoteStream']>(),
  error: new Set<VideoCallEvents['error']>(),
  metric: new Set<VideoCallEvents['metric']>()
});

export interface VideoCallOptions {
  sessionId: string;
  userId: string;
  isInitiator: boolean;
  signalingBaseUrl?: string;
  signalingPath?: string;
  mediaMode?: 'video' | 'audio';
}

export class VideoCall {
  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private readonly sessionId: string;
  private readonly userId: string;
  private readonly isInitiator: boolean;
  private readonly mediaMode: 'video' | 'audio';
  private state: VideoCallState = 'idle';
  private listeners = createListenerMap();
  private connectionTimeout?: ReturnType<typeof setTimeout>;
  private signalingBase: string;
  private signalingPath: string;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private meterFrame?: number;

  constructor(options: VideoCallOptions) {
    this.sessionId = options.sessionId;
    this.userId = options.userId;
    this.isInitiator = options.isInitiator;
    this.signalingBase = (options.signalingBaseUrl ?? WS_BASE_URL).replace(/\/$/, '');
    this.signalingPath = options.signalingPath ?? DEFAULT_SIGNALING_PATH;
    this.mediaMode = options.mediaMode ?? 'video';
  }

  public on<T extends keyof VideoCallEvents>(event: T, callback: VideoCallEvents[T]): () => void {
    this.listeners[event].add(callback as never);
    return () => this.listeners[event].delete(callback as never);
  }

  private emit<T extends keyof VideoCallEvents>(event: T, payload: Parameters<VideoCallEvents[T]>[0]): void {
    this.listeners[event].forEach((listener) => {
      try {
        (listener as (arg: typeof payload) => void)(payload);
      } catch (error) {
        console.warn('VideoCall listener failed', error);
      }
    });
  }

  private setState(next: VideoCallState): void {
    this.state = next;
    this.emit('state', next);
  }

  public getState(): VideoCallState {
    return this.state;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private buildSignalingUrl(): string {
    return `${this.signalingBase}${this.signalingPath}/${this.sessionId}?userId=${encodeURIComponent(this.userId)}`;
  }

  private async requestMedia(): Promise<void> {
    this.setState('permission');
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: this.mediaMode === 'video',
        audio: true
      });
      console.log('[VideoCall] Local media captured:', {
        sessionId: this.sessionId,
        userId: this.userId,
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length,
        audioEnabled: this.localStream.getAudioTracks()[0]?.enabled,
        audioSettings: this.localStream.getAudioTracks()[0]?.getSettings()
      });
      this.emit('localStream', this.localStream);
      this.startAudioMeter(this.localStream);
    } catch (error) {
      const domError = error as DOMException;
      let message = 'Unable to access media devices.';
      if (domError?.name === 'NotAllowedError' || domError?.name === 'SecurityError') {
        message = 'Camera/microphone permissions denied.';
      } else if (domError?.name === 'NotFoundError' || domError?.name === 'DevicesNotFoundError') {
        message = 'No camera or microphone detected. Try connecting different hardware.';
      } else if (domError instanceof Error && domError.message) {
        message = domError.message;
      }
      this.emit('error', message);
      this.setState('failed');
      throw error;
    }
  }

  private startAudioMeter(stream: MediaStream): void {
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      this.audioContext = new AudioContextCtor();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const loop = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const value = dataArray[i] - 128;
          sumSquares += value * value;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length) / 128;
        this.emit('metric', {
          audioLevel: Number(rms.toFixed(2)),
          connectionState: this.pc?.connectionState,
          iceState: this.pc?.iceConnectionState
        });
        this.meterFrame = window.requestAnimationFrame(loop);
      };
      this.meterFrame = window.requestAnimationFrame(loop);
    } catch (error) {
      console.warn('Audio meter unavailable', error);
    }
  }

  private stopAudioMeter(): void {
    if (this.meterFrame) {
      cancelAnimationFrame(this.meterFrame);
      this.meterFrame = undefined;
    }
    this.analyser?.disconnect();
    this.audioContext?.close().catch(() => undefined);
  }

  private createPeerConnection(): void {
    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS
    });

    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      const videoTracks = this.localStream.getVideoTracks();
      console.log('[VideoCall] Adding tracks to peer connection:', {
        sessionId: this.sessionId,
        userId: this.userId,
        isInitiator: this.isInitiator,
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
        audioEnabled: audioTracks[0]?.enabled
      });
      
      // Add tracks and verify transceivers are created
      this.localStream.getTracks().forEach((track) => {
        const sender = this.pc!.addTrack(track, this.localStream!);
        console.log('[VideoCall] Track added:', {
          sessionId: this.sessionId,
          userId: this.userId,
          trackKind: track.kind,
          trackId: track.id,
          senderTransceiver: sender.track?.kind
        });
      });
      
      // Log transceivers to verify bidirectional communication
      const transceivers = this.pc.getTransceivers();
      console.log('[VideoCall] Transceivers after adding tracks:', {
        sessionId: this.sessionId,
        userId: this.userId,
        count: transceivers.length,
        details: transceivers.map(t => ({
          kind: t.sender.track?.kind,
          direction: t.direction,
          currentDirection: t.currentDirection
        }))
      });
    }

    this.pc.ontrack = (event) => {
      console.log('[VideoCall] ⭐ ONTRACK EVENT FIRED ⭐ Received remote track:', {
        sessionId: this.sessionId,
        userId: this.userId,
        isInitiator: this.isInitiator,
        trackKind: event.track.kind,
        trackEnabled: event.track.enabled,
        trackMuted: event.track.muted,
        trackReadyState: event.track.readyState,
        streamsCount: event.streams.length
      });
      
      // Store/update the remote stream reference
      if (event.streams[0]) {
        this.remoteStream = event.streams[0];
        
        // Log current state of the remote stream
        console.log('[VideoCall] Remote stream updated:', {
          sessionId: this.sessionId,
          userId: this.userId,
          isInitiator: this.isInitiator,
          audioTracks: this.remoteStream.getAudioTracks().length,
          videoTracks: this.remoteStream.getVideoTracks().length,
          audioEnabled: this.remoteStream.getAudioTracks()[0]?.enabled,
          audioMuted: this.remoteStream.getAudioTracks()[0]?.muted,
          videoEnabled: this.remoteStream.getVideoTracks()[0]?.enabled
        });
        
        // Emit the remote stream every time we receive a track
        // This ensures the UI gets updated with the complete stream
        this.emit('remoteStream', this.remoteStream);
      } else {
        console.error('[VideoCall] ⚠️ ONTRACK event but no streams in event!', {
          sessionId: this.sessionId,
          userId: this.userId,
          trackKind: event.track.kind
        });
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: 'ice-candidate', candidate: event.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        this.setState('connected');
        this.clearConnectionTimeout();
      } else if (state === 'failed') {
        this.emit('error', 'Peer connection failed. Retrying…');
        this.restartIce();
        this.setState('failed');
      } else if (state === 'disconnected') {
        this.setState('disconnected');
      }
      this.emit('metric', {
        audioLevel: 0,
        connectionState: state,
        iceState: this.pc?.iceConnectionState
      });
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc?.iceConnectionState === 'failed') {
        this.restartIce();
      }
    };
  }

  private restartIce(): void {
    if (!this.pc) return;
    this.pc.restartIce();
    if (this.isInitiator) {
      this.createAndSendOffer(true).catch((error) => {
        console.error('ICE restart offer failed', error);
      });
    }
  }

  private connectSignaling(): void {
    this.ws = new WebSocket(this.buildSignalingUrl());
    this.ws.onopen = () => {
      this.setState('connecting');
      this.startConnectionTimeout();
      if (this.isInitiator) {
        this.createAndSendOffer().catch((error) => this.emit('error', error.message));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        this.handleSignal(message);
      } catch (error) {
        console.warn('Invalid signaling payload', error);
      }
    };

    this.ws.onerror = () => {
      this.emit('error', 'Signaling channel error');
    };

    this.ws.onclose = () => {
      if (this.state !== 'ended') {
        this.setState('disconnected');
      }
    };
  }

  private async handleSignal(message: Record<string, unknown>): Promise<void> {
    if (!this.pc) {
      console.warn('[VideoCall] Received signal but no peer connection exists yet', {
        sessionId: this.sessionId,
        userId: this.userId,
        messageType: message.type
      });
      return;
    }
    
    switch (message.type) {
      case 'offer':
        if (!message.offer) return;
        
        // Ensure we have local tracks before answering
        if (!this.localStream || this.localStream.getTracks().length === 0) {
          console.error('[VideoCall] Received offer but no local stream available!', {
            sessionId: this.sessionId,
            userId: this.userId,
            localStream: !!this.localStream
          });
          return;
        }
        
        const receivedOffer = message.offer as RTCSessionDescriptionInit;
        const offerHasAudio = receivedOffer.sdp?.includes('m=audio');
        const offerHasVideo = receivedOffer.sdp?.includes('m=video');
        
        console.log('[VideoCall] Received offer, creating answer:', {
          sessionId: this.sessionId,
          userId: this.userId,
          isInitiator: this.isInitiator,
          offerHasAudio,
          offerHasVideo,
          offerSdpPreview: receivedOffer.sdp?.substring(0, 300),
          localStreamTracks: {
            audio: this.localStream.getAudioTracks().length,
            video: this.localStream.getVideoTracks().length
          },
          senders: this.pc.getSenders().length
        });
        
        await this.pc.setRemoteDescription(new RTCSessionDescription(receivedOffer));
        
        // Manually check for remote tracks after setting remote description
        const receivers = this.pc.getReceivers();
        console.log('[VideoCall] Remote description set, receivers:', {
          sessionId: this.sessionId,
          userId: this.userId,
          receiversCount: receivers.length,
          receiversDetails: receivers.map(r => ({
            trackKind: r.track?.kind,
            trackId: r.track?.id,
            trackReadyState: r.track?.readyState
          }))
        });
        
        // Check transceivers after setting remote description
        const transceivers = this.pc.getTransceivers();
        console.log('[VideoCall] Transceivers after setRemoteDescription:', {
          sessionId: this.sessionId,
          userId: this.userId,
          count: transceivers.length,
          details: transceivers.map(t => ({
            kind: t.receiver?.track?.kind,
            direction: t.direction,
            currentDirection: t.currentDirection,
            receiverTrackId: t.receiver?.track?.id
          }))
        });
        
        // Manually extract remote stream from receivers if ontrack hasn't fired
        if (receivers.length > 0 && !this.remoteStream) {
          console.warn('[VideoCall] ⚠️ ontrack did not fire! Manually constructing remote stream from receivers');
          const remoteStream = new MediaStream();
          receivers.forEach(receiver => {
            if (receiver.track) {
              console.log('[VideoCall] Manually adding track to remote stream:', {
                trackKind: receiver.track.kind,
                trackId: receiver.track.id
              });
              remoteStream.addTrack(receiver.track);
            }
          });
          this.remoteStream = remoteStream;
          this.emit('remoteStream', this.remoteStream);
          console.log('[VideoCall] Remote stream manually created:', {
            sessionId: this.sessionId,
            userId: this.userId,
            audioTracks: remoteStream.getAudioTracks().length,
            videoTracks: remoteStream.getVideoTracks().length
          });
        }
        
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        
        const answerHasAudio = answer.sdp?.includes('m=audio');
        const answerHasVideo = answer.sdp?.includes('m=video');
        
        console.log('[VideoCall] Sending answer:', {
          sessionId: this.sessionId,
          userId: this.userId,
          senders: this.pc.getSenders().length,
          answerHasAudio,
          answerHasVideo,
          answerSdpPreview: answer.sdp?.substring(0, 300)
        });
        this.sendSignal({ type: 'answer', answer });
        break;
      case 'answer':
        if (!message.answer) return;
        
        const receivedAnswer = message.answer as RTCSessionDescriptionInit;
        const receivedAnswerHasAudio = receivedAnswer.sdp?.includes('m=audio');
        const receivedAnswerHasVideo = receivedAnswer.sdp?.includes('m=video');
        
        console.log('[VideoCall] Received answer:', {
          sessionId: this.sessionId,
          userId: this.userId,
          isInitiator: this.isInitiator,
          answerHasAudio: receivedAnswerHasAudio,
          answerHasVideo: receivedAnswerHasVideo,
          answerSdpPreview: receivedAnswer.sdp?.substring(0, 300),
          receiversBeforeApply: this.pc.getReceivers().length
        });
        
        await this.pc.setRemoteDescription(new RTCSessionDescription(receivedAnswer));
        
        console.log('[VideoCall] Answer applied, receivers:', {
          sessionId: this.sessionId,
          userId: this.userId,
          receiversCount: this.pc.getReceivers().length,
          receiversDetails: this.pc.getReceivers().map(r => ({
            trackKind: r.track?.kind,
            trackId: r.track?.id,
            trackEnabled: r.track?.enabled
          }))
        });
        break;
      case 'ice-candidate':
        if (!message.candidate) return;
        await this.pc.addIceCandidate(message.candidate as RTCIceCandidateInit);
        break;
      case 'peer-left':
        this.setState('disconnected');
        break;
      default:
        break;
    }
  }

  private async createAndSendOffer(iceRestart = false): Promise<void> {
    if (!this.pc) {
      throw new Error('Peer connection not ready');
    }
    
    const senders = this.pc.getSenders();
    console.log('[VideoCall] Creating offer:', {
      sessionId: this.sessionId,
      userId: this.userId,
      isInitiator: this.isInitiator,
      iceRestart,
      localStreamTracks: this.localStream ? {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length,
        audioTrackId: this.localStream.getAudioTracks()[0]?.id,
        videoTrackId: this.localStream.getVideoTracks()[0]?.id
      } : 'no local stream',
      sendersCount: senders.length,
      sendersDetails: senders.map(s => ({
        trackKind: s.track?.kind,
        trackId: s.track?.id,
        trackEnabled: s.track?.enabled
      }))
    });
    
    const offer = await this.pc.createOffer({ iceRestart });
    await this.pc.setLocalDescription(offer);
    
    // Check if SDP contains audio and video
    const hasAudio = offer.sdp?.includes('m=audio');
    const hasVideo = offer.sdp?.includes('m=video');
    
    console.log('[VideoCall] Sending offer:', {
      sessionId: this.sessionId,
      userId: this.userId,
      sendersCount: senders.length,
      hasAudioInSDP: hasAudio,
      hasVideoInSDP: hasVideo,
      sdpPreview: offer.sdp?.substring(0, 300)
    });
    
    this.sendSignal({ type: 'offer', offer });
  }

  private sendSignal(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          ...payload,
          senderId: this.userId
        })
      );
    }
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.connectionTimeout = setTimeout(() => {
      if (this.state === 'connected') {
        return;
      }
      this.emit('error', 'Connection timed out. Trying again…');
      if (this.isInitiator && this.pc) {
        this.createAndSendOffer(true).catch((error) => this.emit('error', error.message));
      }
    }, 30_000);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
  }

  public async start(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'failed' && this.state !== 'disconnected') {
      return;
    }
    await this.requestMedia();
    this.createPeerConnection();
    this.connectSignaling();
  }

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  public toggleVideo(): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  public endCall(): void {
    this.setState('ended');
    this.clearConnectionTimeout();
    this.stopAudioMeter();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.pc?.close();
    this.ws?.close();
    this.pc = null;
    this.ws = null;
    this.localStream = null;
    this.remoteStream = null;
    this.emit('localStream', null);
    this.emit('remoteStream', null);
  }
}
