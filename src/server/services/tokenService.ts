import { Request, Response } from 'express';
import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { query } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';
import { UserRole } from '../types/index.js';

const ACCESS_COOKIE = 'hc_access';
const REFRESH_COOKIE = 'hc_refresh';
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SessionTokenRow {
  token_hash: string;
  user_id: string;
  remember_me: boolean;
  expires_at: string;
  last_used_at: string;
}

interface UserIdentity {
  email: string;
  role: UserRole;
}

const getUserIdentity = async (userId: string): Promise<UserIdentity> => {
  const result = await query<UserIdentity>('SELECT email, role FROM users WHERE id = $1', [userId]);
  const identity = result.rows[0];
  if (!identity) {
    throw new ApiError(404, 'NOT_FOUND', 'User missing while issuing access token');
  }
  return identity;
};

const isProd = env.nodeEnv === 'production';

const cookieConfig = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProd,
  maxAge,
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {})
});

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const createRefreshToken = async (userId: string, rememberMe: boolean): Promise<{ token: string; maxAge: number }> => {
  const token = crypto.randomBytes(48).toString('hex');
  const hashed = hashToken(token);
  const lifetimeDays = rememberMe ? 90 : 30;
  const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO session_tokens (token_hash, user_id, remember_me, expires_at, last_used_at, created_at)
     VALUES ($1,$2,$3,$4,NOW(),NOW())`,
    [hashed, userId, rememberMe, expiresAt]
  );
  return { token, maxAge: lifetimeDays * 24 * 60 * 60 * 1000 };
};

const getSessionByToken = async (token: string): Promise<SessionTokenRow | null> => {
  const hashed = hashToken(token);
  const result = await query<SessionTokenRow>('SELECT * FROM session_tokens WHERE token_hash = $1 LIMIT 1', [hashed]);
  return result.rows[0] ?? null;
};

export const getSessionByRefreshToken = async (token: string): Promise<SessionTokenRow | null> => {
  return getSessionByToken(token);
};

const refreshSession = async (token: string): Promise<SessionTokenRow> => {
  const session = await getSessionByToken(token);
  if (!session) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid refresh token');
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await revokeRefreshToken(token);
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
  }
  const lifetimeDays = session.remember_me ? 90 : 30;
  await query(
    `UPDATE session_tokens
       SET last_used_at = NOW(),
           expires_at = NOW() + ($1 || ' days')::interval
     WHERE token_hash = $2`,
    [lifetimeDays, hashToken(token)]
  );
  return session;
};

export const renewSessionWithRefreshToken = async (token: string): Promise<SessionTokenRow> => {
  return refreshSession(token);
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  const hashed = hashToken(token);
  await query('DELETE FROM session_tokens WHERE token_hash = $1', [hashed]);
};

export const revokeAllSessionsForUser = async (userId: string): Promise<void> => {
  await query('DELETE FROM session_tokens WHERE user_id = $1', [userId]);
};

const signAccessToken = (payload: { id: string; email: string; role: UserRole }): string => {
  return jwt.sign(payload, env.jwtSecret as Secret, { expiresIn: env.jwtExpiresIn } as SignOptions);
};

const setAccessCookie = (res: Response, token: string): void => {
  res.cookie(ACCESS_COOKIE, token, cookieConfig(ACCESS_TTL_MS));
};

const setRefreshCookie = (res: Response, token: string, maxAge: number): void => {
  res.cookie(REFRESH_COOKIE, token, cookieConfig(maxAge));
};

export const issueAccessCookie = (res: Response, user: { id: string; email: string; role: UserRole }): void => {
  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  setAccessCookie(res, accessToken);
};

export const issueAuthCookies = async (
  res: Response,
  user: { id: string; email: string; role: UserRole },
  rememberMe = false
): Promise<void> => {
  const refresh = await createRefreshToken(user.id, rememberMe);
  issueAccessCookie(res, user);
  setRefreshCookie(res, refresh.token, refresh.maxAge);
};

export const clearAuthCookies = async (res: Response, refreshToken?: string): Promise<void> => {
  res.clearCookie(ACCESS_COOKIE);
  res.clearCookie(REFRESH_COOKIE);
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
};

export const refreshFromRequest = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing refresh token');
  }
  const session = await refreshSession(refreshToken);
  const identity = await getUserIdentity(session.user_id);
  const accessToken = signAccessToken({ id: session.user_id, email: identity.email, role: identity.role });
  setAccessCookie(res, accessToken);
};

export const extractAccessToken = (req: Request): string | null => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies?.[ACCESS_COOKIE]) {
    return req.cookies[ACCESS_COOKIE];
  }
  return null;
};

export interface AccessTokenPayload extends JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
  } catch (error) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token');
  }
};