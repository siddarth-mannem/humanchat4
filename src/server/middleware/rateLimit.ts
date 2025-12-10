import rateLimit from 'express-rate-limit';

export const unauthenticatedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
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
  limit: 5000, // Increased for development/testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again later.'
    }
  }
});
