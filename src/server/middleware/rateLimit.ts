import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Disable rate limiting outside production to simplify local development
const skipRateLimit = env.nodeEnv !== 'production';

export const unauthenticatedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again later.'
    }
  }
});

export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again later.'
    }
  }
});
