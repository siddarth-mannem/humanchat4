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
  loginWithSupabaseToken
} from '../services/authService.js';
import { getUserById } from '../services/userService.js';
import { authenticate } from '../middleware/auth.js';
import { success } from '../utils/apiResponse.js';
import { unauthenticatedLimiter } from '../middleware/rateLimit.js';
import { issueAuthCookies, clearAuthCookies, refreshFromRequest } from '../services/tokenService.js';
import { env } from '../config/env.js';

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

const supabaseSchema = z.object({ accessToken: z.string().min(16) });

router.post('/supabase', unauthenticatedLimiter, async (req, res, next) => {
  try {
    const payload = supabaseSchema.parse(req.body);
    const user = await loginWithSupabaseToken(payload.accessToken);
    await issueAuthCookies(res, user, true);
    success(res, { user });
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
