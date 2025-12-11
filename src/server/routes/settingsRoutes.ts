import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authenticatedLimiter } from '../middleware/rateLimit.js';
import { success } from '../utils/apiResponse.js';
import {
  completeOnboarding,
  fetchUserSettings,
  updateAvailability,
  updateConnectionSettings
} from '../services/settingsService.js';

const router = Router();

const availabilitySchema = z.object({ is_online: z.boolean() });
const connectionSchema = z.object({
  conversation_type: z.enum(['free', 'paid', 'charity']),
  instant_rate_per_minute: z.number().min(0).max(100000).nullable().optional(),
  charity_id: z.string().min(1).nullable().optional(),
  donation_preference: z.union([z.boolean(), z.enum(['on', 'off'])]).optional()
});
const onboardingSchema = z.object({ onboarding_complete: z.boolean() });

const respondWithSettings = async (res: Parameters<typeof success>[0], userId: string, includeCharities = false) => {
  const payload = await fetchUserSettings(userId);
  if (includeCharities) {
    success(res, payload);
    return;
  }
  success(res, { settings: payload.settings });
};

router.get('/', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    await respondWithSettings(res, req.user!.id, true);
  } catch (error) {
    next(error);
  }
});

router.patch('/availability', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const { is_online } = availabilitySchema.parse(req.body ?? {});
    await updateAvailability(req.user!.id, is_online);
    await respondWithSettings(res, req.user!.id);
  } catch (error) {
    next(error);
  }
});

router.patch('/connection', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const payload = connectionSchema.parse(req.body ?? {});
    await updateConnectionSettings(req.user!.id, payload);
    await respondWithSettings(res, req.user!.id);
  } catch (error) {
    next(error);
  }
});

router.patch('/', authenticate, authenticatedLimiter, async (req, res, next) => {
  try {
    const { onboarding_complete } = onboardingSchema.parse(req.body ?? {});
    if (onboarding_complete) {
      await completeOnboarding(req.user!.id);
    }
    await respondWithSettings(res, req.user!.id);
  } catch (error) {
    next(error);
  }
});

export default router;
