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
      this.localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.localStream!);
      });
    }

    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.emit('remoteStream', this.remoteStream);
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
    if (!this.pc) return;
    switch (message.type) {
      case 'offer':
        if (!message.offer) return;
        await this.pc.setRemoteDescription(new RTCSessionDescription(message.offer as RTCSessionDescriptionInit));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal({ type: 'answer', answer });
        break;
      case 'answer':
        if (!message.answer) return;
        await this.pc.setRemoteDescription(new RTCSessionDescription(message.answer as RTCSessionDescriptionInit));
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
    const offer = await this.pc.createOffer({ iceRestart });
    await this.pc.setLocalDescription(offer);
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
