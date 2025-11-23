import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/postgres.js';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../types/index.js';
import { firebaseAuth } from './firebaseAdmin.js';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface MagicLinkRow {
  token_hash: string;
  user_id: string;
  remember_me: boolean;
  expires_at: string;
  consumed: boolean;
}

const MAGIC_LINK_TTL_MINUTES = 15;

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort ?? 587,
      secure: (env.smtpPort ?? 587) === 465,
      auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
    })
  : nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });

const googleClient = new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const ensureUserByEmail = async (email: string, nameHint?: string): Promise<User> => {
  const existing = await query<User>('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
  if (existing.rows[0]) {
    return existing.rows[0];
  }
  const fallbackName = nameHint ?? email.split('@')[0];
  const userId = crypto.randomUUID();
  const insert = await query<User>(
    `INSERT INTO users (id, name, email, role, is_online, has_active_session, managed, created_at, updated_at)
     VALUES ($1,$2,$3,'user',false,false,false,NOW(),NOW()) RETURNING *`,
    [userId, fallbackName, email]
  );
  return insert.rows[0];
};

export const registerUser = async ({ name, email, password }: RegisterInput): Promise<User> => {
  const existing = await query<User>('SELECT * FROM users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rows.length > 0) {
    throw new ApiError(409, 'CONFLICT', 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const insert = await query<User>(
    `INSERT INTO users (name, email, password_hash, role, conversation_type, is_online, has_active_session, managed, created_at, updated_at)
     VALUES ($1, $2, $3, 'user', 'paid', false, false, false, NOW(), NOW())
     RETURNING *`,
    [name, email, passwordHash]
  );

  return insert.rows[0];
};

export const loginUser = async (email: string, password: string): Promise<User> => {
  const result = await query<User & { password_hash: string }>('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
  const user = result.rows[0];
  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, (user as unknown as { password_hash: string }).password_hash);
  if (!isValid) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  return user;
};

export const requestMagicLink = async (email: string, rememberMe: boolean): Promise<void> => {
  const user = await ensureUserByEmail(email);
  const token = crypto.randomBytes(32).toString('hex');
  const hashed = hashToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO magic_links (token_hash, user_id, remember_me, expires_at, consumed, created_at)
     VALUES ($1,$2,$3,$4,false,NOW())`,
    [hashed, user.id, rememberMe, expiresAt]
  );

  const link = `${env.apiBaseUrl}/api/auth/magic-link/verify?token=${token}`;
  const html = `<p>Hi ${user.name ?? 'there'},</p><p>Click <a href="${link}">here</a> to finish signing in to HumanChat. This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.</p>`;

  await transporter.sendMail({
    to: email,
    from: env.smtpFrom,
    subject: 'Your HumanChat magic link',
    html
  });
  console.info('[MagicLink] Login URL:', link);
};

export const verifyMagicLink = async (token: string): Promise<{ user: User; rememberMe: boolean }> => {
  const hashed = hashToken(token);
  const result = await query<MagicLinkRow>('SELECT * FROM magic_links WHERE token_hash = $1 LIMIT 1', [hashed]);
  const link = result.rows[0];
  if (!link || link.consumed) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Magic link invalid or already used');
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Magic link expired');
  }
  await query('UPDATE magic_links SET consumed = true, consumed_at = NOW() WHERE token_hash = $1', [hashed]);
  const user = await query<User>('SELECT * FROM users WHERE id = $1', [link.user_id]);
  if (!user.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  return { user: user.rows[0], rememberMe: link.remember_me };
};

export const loginWithFirebaseToken = async (idToken: string): Promise<User> => {
  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch (error) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Firebase token invalid or expired');
  }

  if (!decoded.email) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Firebase token missing email');
  }

  const nameHint = decoded.name ?? decoded.email.split('@')[0];
  const avatarUrl = decoded.picture;

  const user = await ensureUserByEmail(decoded.email, nameHint);
  if (avatarUrl && avatarUrl !== user.avatar_url) {
    await query('UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1', [user.id, avatarUrl]);
    return { ...user, avatar_url: avatarUrl };
  }
  return user;
};

export const buildGoogleAuthUrl = (state: Record<string, unknown> = {}): string => {
  const encodedState = Buffer.from(JSON.stringify(state)).toString('base64url');
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['openid', 'profile', 'email'],
    state: encodedState
  });
};

const decodeState = (state?: string | null): Record<string, unknown> => {
  if (!state) return {};
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
};

export const handleGoogleCallback = async (code: string): Promise<User> => {
  const { tokens } = await googleClient.getToken(code);
  const idToken = tokens.id_token;
  if (!idToken) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Missing Google identity token');
  }
  const ticket = await googleClient.verifyIdToken({ idToken, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Unable to read Google profile');
  }
  const user = await ensureUserByEmail(payload.email, payload.name ?? undefined);
  await query('UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1', [user.id, payload.picture ?? null]);
  return { ...user, avatar_url: payload.picture ?? user.avatar_url } as User;
};

export const parseGoogleState = (state?: string | null): { rememberMe?: boolean; redirect?: string } => {
  const decoded = decodeState(state);
  return {
    rememberMe: decoded.rememberMe as boolean | undefined,
    redirect: decoded.redirect as string | undefined
  };
};
