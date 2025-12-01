import { Router } from 'express';
import { z } from 'zod';
import {
  registerUser,
  loginUser,
  requestMagicLink,
  verifyMagicLink,
  buildGoogleAuthUrl,
  handleGoogleCallback,
  parseGoogleState,
  loginWithFirebaseToken
} from '../services/authService.js';
import { getUserById } from '../services/userService.js';
import { authenticate } from '../middleware/auth.js';
import { success } from '../utils/apiResponse.js';
import { unauthenticatedLimiter } from '../middleware/rateLimit.js';
import {
  issueAuthCookies,
  clearAuthCookies,
  refreshFromRequest,
  getSessionByRefreshToken,
  renewSessionWithRefreshToken,
  issueAccessCookie
} from '../services/tokenService.js';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { updateUserPresence } from '../services/presenceService.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

router.post('/register', unauthenticatedLimiter, async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const user = await registerUser(payload);
    success(res, { user }, 201);
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional()
});

router.post('/login', unauthenticatedLimiter, async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await loginUser(payload.email, payload.password);
    await issueAuthCookies(res, user, payload.rememberMe ?? false);
    success(res, { user });
  } catch (error) {
    next(error);
  }
});

const magicSchema = z.object({ email: z.string().email(), rememberMe: z.boolean().optional() });

router.post('/magic-link', unauthenticatedLimiter, async (req, res, next) => {
  try {
    const payload = magicSchema.parse(req.body);
    await requestMagicLink(payload.email, payload.rememberMe ?? false);
    success(res, { message: 'Magic link sent' });
  } catch (error) {
    next(error);
  }
});

const firebaseSchema = z.object({ idToken: z.string().min(16) });

router.post('/firebase', unauthenticatedLimiter, async (req, res, next) => {
  try {
    const payload = firebaseSchema.safeParse(req.body);
    if (!payload.success) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Invalid Firebase payload', payload.error.issues);
    }
    const user = await loginWithFirebaseToken(payload.data.idToken);
    const refreshToken = req.cookies?.hc_refresh;

    if (refreshToken) {
      const session = await getSessionByRefreshToken(refreshToken);
      if (session?.user_id === user.id) {
        try {
          await renewSessionWithRefreshToken(refreshToken);
          issueAccessCookie(res, user);
          success(res, { user, session: 'refreshed' });
          return;
        } catch (error) {
          await clearAuthCookies(res, refreshToken);
        }
      } else {
        await clearAuthCookies(res, refreshToken);
      }
    }

    await issueAuthCookies(res, user, true);
    success(res, { user, session: 'new' });
  } catch (error) {
    next(error);
  }
});

router.get('/magic-link/verify', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      throw new Error('Missing token');
    }
    const { user, rememberMe } = await verifyMagicLink(token);
    await issueAuthCookies(res, user, rememberMe);
    res.redirect(`${env.appUrl}/onboarding`);
  } catch (error) {
    res.status(400).send('Magic link verification failed. Please request a new link.');
  }
});

router.get('/google', unauthenticatedLimiter, (req, res) => {
  const rememberMe = req.query.rememberMe === 'true';
  const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : undefined;
  const url = buildGoogleAuthUrl({ rememberMe, redirect });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    const state = parseGoogleState(req.query.state as string | undefined);
    if (!code) {
      throw new Error('Missing authorization code');
    }
    const user = await handleGoogleCallback(code);
    await issueAuthCookies(res, user, state.rememberMe ?? false);
    res.redirect(state.redirect ?? `${env.appUrl}/onboarding`);
  } catch (error) {
    res.status(400).send('Unable to complete Google sign-in.');
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    await refreshFromRequest(req, res);
    success(res, { refreshed: true });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await updateUserPresence(req.user!.id, 'offline').catch(() => undefined);
    await clearAuthCookies(res, req.cookies?.hc_refresh);
    success(res, { message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await getUserById(req.user!.id);
    success(res, { user });
  } catch (error) {
    next(error);
  }
});

export default router;
