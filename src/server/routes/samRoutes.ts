import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import { handleSamChat } from '../services/samService.js';

const router = Router();

const bodySchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'sam']),
      content: z.string(),
      timestamp: z.string().optional()
    })
  ),
  userContext: z
    .object({
      sidebarState: z.record(z.string(), z.any()).optional(),
      timezone: z.string().optional(),
      availableProfiles: z
        .array(
          z.object({
            name: z.string(),
            headline: z.string(),
            expertise: z.array(z.string()),
            rate_per_minute: z.number(),
            status: z.enum(['available', 'away', 'booked'])
          })
        )
        .optional()
    })
    .catchall(z.any())
    .optional()
});

router.post('/chat', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = bodySchema.parse(req.body);
    const conversationId = (req.query.conversationId as string) ?? req.user!.id;
    const response = await handleSamChat(conversationId, req.user!.id, payload);
    success(res, response);
  } catch (error) {
    next(error);
  }
});

export default router;
