import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import type { Request } from 'express';

// Disable rate limiting outside production to simplify local development
const skipRateLimit = env.nodeEnv !== 'production';

// Whitelist for trusted IPs (e.g., your dev IP, Vercel IPs)
const whitelistedIPs: string[] = [
  // Add your IPs here if needed, e.g., '203.0.113.1'
];

const skipForWhitelist = (req: Request): boolean => {
  if (skipRateLimit) return true;
  const clientIP = req.ip || req.socket.remoteAddress || '';
  return whitelistedIPs.includes(clientIP);
};

export const unauthenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500, // Increased from 100 to 500
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForWhitelist,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again later.'
    }
  }
});

export const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5000, // Increased from 1000 to 5000
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForWhitelist,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again later.'
    }
  }
});
