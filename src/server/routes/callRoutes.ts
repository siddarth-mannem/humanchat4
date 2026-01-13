/**
 * Call REST API routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../errors/ApiError.js';
import * as callService from '../services/callService.js';
import { generateLiveKitToken } from '../services/liveKitService.js';
import { StartCallRequest, AcceptCallRequest, DeclineCallRequest, EndCallRequest } from '../types/calls.js';

const router = Router();

// Zod schemas for validation
const startCallSchema = z.object({
  conversationId: z.string().uuid(),
  callType: z.enum(['video', 'audio']),
  idempotencyKey: z.string().uuid().optional(),
});

const acceptCallSchema = z.object({
  userId: z.string(),
});

const declineCallSchema = z.object({
  userId: z.string(),
  reason: z.enum(['busy', 'declined', 'other']).optional(),
});

const endCallSchema = z.object({
  userId: z.string(),
  endReason: z.enum(['normal', 'timeout', 'error']).optional(),
});

/**
 * POST /api/calls/start
 * Start a new video or audio call
 */
router.post(
  '/start',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = startCallSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'INVALID_REQUEST', 'Invalid request', parsed.error.flatten());
      }

      const userId = req.user!.id;
      const request: StartCallRequest = parsed.data;

      const result = await callService.startCall(request, userId);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/calls/:callId/accept
 * Accept an incoming call
 */
router.post(
  '/:callId/accept',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      const userId = req.user!.id;

      const result = await callService.acceptCall(callId, userId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/calls/:callId/decline
 * Decline an incoming call
 */
router.post(
  '/:callId/decline',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      const parsed = declineCallSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'INVALID_REQUEST', 'Invalid request', parsed.error.flatten());
      }

      const userId = req.user!.id;
      const { reason } = parsed.data;

      await callService.declineCall(callId, userId, reason);

      res.json({
        callId,
        status: 'declined',
        declinedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/calls/:callId/end
 * End an active call
 */
router.post(
  '/:callId/end',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      const userId = req.user!.id;
      
      const parsed = endCallSchema.safeParse(req.body);
      const endReason = parsed.success ? parsed.data.endReason : 'normal';

      await callService.endCall(callId, userId, endReason);

      // Fetch final call details
      const call = await callService.getCallById(callId, userId);

      res.json({
        callId,
        status: 'ended',
        duration: call?.duration_seconds || 0,
        endedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/calls/:callId/connected
 * Mark call as connected when both parties join
 */
router.post(
  '/:callId/connected',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      await callService.markCallConnected(callId);
      
      res.json({
        callId,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/calls/:callId
 * Get call session details with LiveKit token
 */
router.get(
  '/:callId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      const userId = req.user!.id;

      console.log('[callRoutes GET] Fetching call:', {
        callId,
        userId,
        hasUser: !!req.user,
        userEmail: req.user?.email,
      });

      const call = await callService.getCallById(callId, userId);

      if (!call) {
        throw new ApiError(404, 'NOT_FOUND', 'Call not found');
      }

      // Use the room name from the database (stored when call was created)
      const roomName = call.livekit_room_name || `call_${callId}`;
      const liveKitToken = await generateLiveKitToken({
        roomName,
        userId,
        userName: req.user!.email || 'User',
      });

      // Calculate current duration if connected
      let currentDuration = call.duration_seconds || 0;
      if (call.status === 'connected' && call.connected_at) {
        currentDuration = Math.floor((Date.now() - new Date(call.connected_at).getTime()) / 1000);
      }

      const responseData = {
        callId: call.id,
        conversationId: call.conversation_id,
        callType: call.call_type,
        status: call.status,
        roomName,
        liveKitToken,
        initiatedAt: new Date(call.initiated_at).toISOString(),
        connectedAt: call.connected_at ? new Date(call.connected_at).toISOString() : undefined,
        duration: currentDuration,
      };

      console.log('[callRoutes GET] Sending response:', {
        callId: responseData.callId,
        status: responseData.status,
        hasToken: !!liveKitToken,
        roomName,
      });

      res.json(responseData);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
