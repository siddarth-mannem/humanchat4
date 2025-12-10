import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import {
  listConversations,
  getConversationMessages,
  addConversationMessage
} from '../services/conversationService.js';
import { initiateInstantConnection } from '../services/connectionService.js';
import { acceptInstantInvite, cancelInstantInvite, declineInstantInvite } from '../services/instantInviteService.js';

const router = Router();

router.get('/', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const conversations = await listConversations(req.user!.id);
    success(res, { conversations });
  } catch (error) {
    next(error);
  }
});

const connectSchema = z.object({
  target_user_id: z.string().uuid()
});

router.post('/connect', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = connectSchema.parse(req.body ?? {});
    const result = await initiateInstantConnection(req.user!.id, payload.target_user_id);
    success(res, result, 201);
  } catch (error) {
    next(error);
  }
});

const inviteIdSchema = z.string().uuid();

router.post('/invites/:inviteId/accept', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const inviteId = inviteIdSchema.parse(req.params.inviteId);
    const result = await acceptInstantInvite(inviteId, req.user!.id);
    success(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/invites/:inviteId/decline', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const inviteId = inviteIdSchema.parse(req.params.inviteId);
    const invite = await declineInstantInvite(inviteId, req.user!.id);
    success(res, { invite });
  } catch (error) {
    next(error);
  }
});

router.post('/invites/:inviteId/cancel', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const inviteId = inviteIdSchema.parse(req.params.inviteId);
    const invite = await cancelInstantInvite(inviteId, req.user!.id);
    success(res, { invite });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/messages', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const messages = await getConversationMessages(req.params.id);
    success(res, { messages });
  } catch (error) {
    next(error);
  }
});

const messageSchema = z.object({
  senderId: z.string().uuid(),
  content: z.string().min(1),
  type: z.enum(['user_text', 'sam_response', 'system_notice']),
  actions: z.array(z.record(z.string(), z.any())).optional()
});

router.post('/:id/messages', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = messageSchema.parse(req.body);
    const message = await addConversationMessage(
      req.params.id,
      payload.senderId,
      payload.content,
      payload.type,
      payload.actions
    );
    success(res, { message }, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
