import { NextFunction, Request, Response } from 'express';
import { fail } from '../utils/apiResponse.js';
import { extractAccessToken, verifyAccessToken } from '../services/tokenService.js';
import { UserRole } from '../types/index.js';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  console.log('[auth] Authenticating request:', {
    path: req.path,
    method: req.method,
    hasCookies: !!req.cookies,
    cookieKeys: Object.keys(req.cookies || {}),
    hasAuthHeader: !!req.headers.authorization,
  });

  const token = extractAccessToken(req);
  
  console.log('[auth] Token extracted:', {
    hasToken: !!token,
    tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
  });

  if (!token) {
    console.error('[auth] No token found');
    fail(res, 'UNAUTHORIZED', 'Missing access token', 401);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    console.log('[auth] Authentication successful:', {
      userId: payload.id,
      email: payload.email,
    });
    next();
  } catch (error) {
    console.error('[auth] Token verification failed:', error);
    fail(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
};

export const requireRole = (roles: UserRole | UserRole[]) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      fail(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }
    if (!allowed.includes(req.user.role)) {
      fail(res, 'FORBIDDEN', 'You do not have permission to perform this action', 403);
      return;
    }
    next();
  };
};
