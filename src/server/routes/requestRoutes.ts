import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import { createRequest, listRequests, updateRequestStatus } from '../services/requestService.js';

const router = Router();

const createSchema = z.object({
  target_user_id: z.string().uuid(),
  message: z.string().min(5),
  preferred_time: z.string().min(3).max(160).optional(),
  budget_range: z.string().min(2).max(80).optional()
});

router.post('/', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body);
    const request = await createRequest({
      requester_user_id: req.user!.id,
      target_user_id: payload.target_user_id,
      message: payload.message,
      preferred_time: payload.preferred_time,
      budget_range: payload.budget_range
    });
    success(res, { request }, 201);
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const requests = await listRequests(req.user!.id);
    success(res, { requests });
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({ status: z.enum(['pending', 'approved', 'declined']) });

router.patch('/:id/status', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = statusSchema.parse(req.body);
    const request = await updateRequestStatus(req.params.id, payload.status, {
      id: req.user!.id,
      role: req.user!.role
    });
    success(res, { request });
  } catch (error) {
    next(error);
  }
});

export default router;
