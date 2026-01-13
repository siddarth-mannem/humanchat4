/**
 * Call system type definitions
 */

export type CallType = 'video' | 'audio';

export type CallStatus =
  | 'initiated'    // Created, ringing
  | 'accepted'     // Callee accepted
  | 'connected'    // Media flowing
  | 'ended'        // Clean end
  | 'declined'     // Callee declined
  | 'missed'       // No answer timeout
  | 'canceled'     // Caller canceled
  | 'failed';      // Technical failure

export type CallEventType =
  | 'initiated'
  | 'ringing'
  | 'accepted'
  | 'declined'
  | 'missed'
  | 'connected'
  | 'reconnecting'
  | 'reconnected'
  | 'ended'
  | 'canceled'
  | 'failed'
  | 'timeout'
  | 'peer_joined'
  | 'peer_left'
  | 'media_permission_denied'
  | 'ice_failed'
  | 'quality_degraded';

export interface CallSession {
  id: string;
  conversation_id: string;
  caller_user_id: string;
  callee_user_id: string;
  call_type: CallType;
  status: CallStatus;
  initiated_at: Date | string;
  accepted_at: Date | string | null;
  connected_at: Date | string | null;
  ended_at: Date | string | null;
  duration_seconds: number | null;
  livekit_room_id: string | null;
  livekit_room_name: string | null;
  is_paid: boolean;
  agreed_price_cents: number | null;
  end_reason: string | null;
  error_details: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
  // Optional joined fields from queries
  caller_name?: string;
  callee_name?: string;
  ender_name?: string;
}

export interface CallParticipant {
  userId: string;
  name: string;
  avatar?: string;
  connected?: boolean;
}

export interface StartCallRequest {
  conversationId: string;
  callType: CallType;
  idempotencyKey?: string;
}

export interface StartCallResponse {
  callId: string;
  status: CallStatus;
  liveKitToken: string;
  roomName: string;
  participants: {
    caller: CallParticipant;
    callee: CallParticipant;
  };
  initiatedAt: string;
}

export interface AcceptCallRequest {
  userId: string;
}

export interface AcceptCallResponse {
  callId: string;
  status: CallStatus;
  liveKitToken: string;
  roomName: string;
  acceptedAt: string;
}

export interface DeclineCallRequest {
  userId: string;
  reason?: 'busy' | 'declined' | 'other';
}

export interface EndCallRequest {
  userId: string;
  endReason?: 'normal' | 'timeout' | 'error';
}

// WebSocket message types
export interface WSCallRingingMessage {
  type: 'CALL_RINGING';
  callId: string;
  conversationId: string;
  caller: CallParticipant;
  callType: CallType;
  initiatedAt: string;
}

export interface WSCallAcceptedMessage {
  type: 'CALL_ACCEPTED';
  callId: string;
  acceptedBy: CallParticipant;
  acceptedAt: string;
}

export interface WSCallDeclinedMessage {
  type: 'CALL_DECLINED';
  callId: string;
  declinedBy: CallParticipant;
  reason?: string;
  declinedAt: string;
}

export interface WSCallEndedMessage {
  type: 'CALL_ENDED';
  callId: string;
  endedBy: CallParticipant;
  duration: number;
  endReason: string;
  endedAt: string;
}

export interface WSCallTimeoutMessage {
  type: 'CALL_TIMEOUT';
  callId: string;
  timeoutAt: string;
}

export interface WSCallFailedMessage {
  type: 'CALL_FAILED';
  callId: string;
  error: {
    code: string;
    message: string;
  };
  failedAt: string;
}

export type WSCallMessage =
  | WSCallRingingMessage
  | WSCallAcceptedMessage
  | WSCallDeclinedMessage
  | WSCallEndedMessage
  | WSCallTimeoutMessage
  | WSCallFailedMessage;
