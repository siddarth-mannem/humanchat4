import { NextFunction, Request, Response } from 'express';
import { fail } from '../utils/apiResponse.js';
import { extractAccessToken, verifyAccessToken } from '../services/tokenService.js';
import { loginWithFirebaseToken } from '../services/authService.js';
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

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = extractAccessToken(req);
  if (!token) {
    fail(res, 'UNAUTHORIZED', 'Missing access token', 401);
    return;
  }

  try {
    // First try to verify as JWT access token
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (jwtError) {
    // If JWT verification fails, try Firebase ID token
    try {
      const user = await loginWithFirebaseToken(token);
      req.user = { id: user.id, email: user.email, role: user.role };
      next();
    } catch (firebaseError) {
      fail(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
    }
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
