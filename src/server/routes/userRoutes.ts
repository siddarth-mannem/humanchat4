import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import type { User } from '../types/index.js';
import { getUserById, updateUserProfile, searchUsers, getUserAvailability, getUserStatus } from '../services/userService.js';
import { logRequestedPersonInterest } from '../services/requestedPeopleService.js';
import { updateUserPresence } from '../services/presenceService.js';

const router = Router();

router.get('/search', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const q = (req.query.q as string) ?? '';
    const online = req.query.online ? req.query.online === 'true' : undefined;
    const users = await searchUsers(q, online);
    const trimmed = q.trim();
    if (users.length === 0 && trimmed.length >= 3) {
      await logRequestedPersonInterest({
        requestedName: trimmed,
        searchQuery: q,
        userId: req.user!.id
      }).catch((error) => {
        console.warn('Failed to log requested person', error);
      });
    }
    success(res, { users });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    success(res, { user });
  } catch (error) {
    next(error);
  }
});

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  headline: z.string().optional(),
  bio: z.string().optional(),
  conversation_type: z.enum(['free', 'paid', 'charity']).optional(),
  instant_rate_per_minute: z.number().nullable().optional(),
  scheduled_rates: z.record(z.string(), z.number()).optional(),
  is_online: z.boolean().optional(),
  has_active_session: z.boolean().optional()
});

router.patch('/:id', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
  const payload = updateSchema.parse(req.body) as Partial<User>;
  const user = await updateUserProfile(req.params.id, payload);
    success(res, { user });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/availability', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const availability = await getUserAvailability(req.params.id);
    success(res, availability);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/status', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const status = await getUserStatus(req.params.id);
    success(res, status);
  } catch (error) {
    next(error);
  }
});

const presenceSchema = z.object({ state: z.enum(['active', 'idle', 'offline']) });

router.post('/me/presence', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = presenceSchema.parse(req.body ?? {});
    const user = await updateUserPresence(req.user!.id, payload.state);
    success(res, {
      presence: {
        state: user.presence_state,
        isOnline: user.is_online,
        hasActiveSession: user.has_active_session,
        lastSeenAt: user.last_seen_at
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
