import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../src/server/routes/authRoutes';

const registerUserMock = jest.fn();
const loginUserMock = jest.fn();
const requestMagicLinkMock = jest.fn();
const verifyMagicLinkMock = jest.fn();
const buildGoogleAuthUrlMock = jest.fn(() => 'https://google.test');
const handleGoogleCallbackMock = jest.fn();
const parseGoogleStateMock = jest.fn(() => ({}));
const loginWithFirebaseTokenMock = jest.fn();
const issueAuthCookiesMock = jest.fn();
const clearAuthCookiesMock = jest.fn();
const refreshFromRequestMock = jest.fn();
const getSessionByRefreshTokenMock = jest.fn();
const renewSessionWithRefreshTokenMock = jest.fn();
const issueAccessCookieMock = jest.fn();

jest.mock('../../src/server/middleware/rateLimit', () => ({
  unauthenticatedLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  authenticatedLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
}));

jest.mock('../../src/server/services/authService', () => ({
  registerUser: (...args: unknown[]) => registerUserMock(...(args as Parameters<typeof registerUserMock>)),
  loginUser: (...args: unknown[]) => loginUserMock(...(args as Parameters<typeof loginUserMock>)),
  requestMagicLink: (...args: unknown[]) => requestMagicLinkMock(...(args as Parameters<typeof requestMagicLinkMock>)),
  verifyMagicLink: (...args: unknown[]) => verifyMagicLinkMock(...(args as Parameters<typeof verifyMagicLinkMock>)),
  buildGoogleAuthUrl: (...args: unknown[]) => buildGoogleAuthUrlMock(...(args as Parameters<typeof buildGoogleAuthUrlMock>)),
  handleGoogleCallback: (...args: unknown[]) => handleGoogleCallbackMock(...(args as Parameters<typeof handleGoogleCallbackMock>)),
  parseGoogleState: (...args: unknown[]) => parseGoogleStateMock(...(args as Parameters<typeof parseGoogleStateMock>)),
  loginWithFirebaseToken: (...args: unknown[]) => loginWithFirebaseTokenMock(...(args as Parameters<typeof loginWithFirebaseTokenMock>))
}));

jest.mock('../../src/server/services/tokenService', () => ({
  issueAuthCookies: (...args: unknown[]) => issueAuthCookiesMock(...(args as Parameters<typeof issueAuthCookiesMock>)),
  clearAuthCookies: (...args: unknown[]) => clearAuthCookiesMock(...(args as Parameters<typeof clearAuthCookiesMock>)),
  refreshFromRequest: (...args: unknown[]) => refreshFromRequestMock(...(args as Parameters<typeof refreshFromRequestMock>)),
  getSessionByRefreshToken: (...args: unknown[]) => getSessionByRefreshTokenMock(...(args as Parameters<typeof getSessionByRefreshTokenMock>)),
  renewSessionWithRefreshToken: (...args: unknown[]) => renewSessionWithRefreshTokenMock(...(args as Parameters<typeof renewSessionWithRefreshTokenMock>)),
  issueAccessCookie: (...args: unknown[]) => issueAccessCookieMock(...(args as Parameters<typeof issueAccessCookieMock>))
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ message: err.message ?? 'error' });
  });
  return app;
};

describe('authRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bridges Firebase sessions into API cookies', async () => {
    loginWithFirebaseTokenMock.mockResolvedValueOnce({ id: 'user-123', email: 'sam@example.com', role: 'user' });
    const app = buildApp();
    const response = await request(app).post('/api/auth/firebase').send({ idToken: 'token-abc-123456' });
    if (response.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('firebase route response', response.status, response.body);
    }

    expect(response.status).toBe(200);
    expect(loginWithFirebaseTokenMock).toHaveBeenCalledWith('token-abc-123456');
    expect(issueAuthCookiesMock).toHaveBeenCalledWith(expect.any(Object), { id: 'user-123', email: 'sam@example.com', role: 'user' }, true);
  });

  it('validates Firebase payloads', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/auth/firebase').send({});
    if (response.status !== 400) {
      // eslint-disable-next-line no-console
      console.error('firebase validation response', response.status, response.body);
    }

    expect(response.status).toBe(400);
    expect(loginWithFirebaseTokenMock).not.toHaveBeenCalled();
  });

  it('reuses an existing refresh session when the cookie matches the Firebase user', async () => {
    loginWithFirebaseTokenMock.mockResolvedValueOnce({ id: 'user-123', email: 'sam@example.com', role: 'user' });
    getSessionByRefreshTokenMock.mockResolvedValueOnce({ user_id: 'user-123' });
    renewSessionWithRefreshTokenMock.mockResolvedValueOnce({ user_id: 'user-123' });

    const app = buildApp();
    const response = await request(app)
      .post('/api/auth/firebase')
      .set('Cookie', 'hc_refresh=refresh-abc')
      .send({ idToken: 'token-abc-123456' });

    expect(response.status).toBe(200);
    expect(issueAccessCookieMock).toHaveBeenCalledTimes(1);
    expect(issueAuthCookiesMock).not.toHaveBeenCalled();
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it('clears mismatched refresh cookies before issuing a new session', async () => {
    loginWithFirebaseTokenMock.mockResolvedValueOnce({ id: 'user-123', email: 'sam@example.com', role: 'user' });
    getSessionByRefreshTokenMock.mockResolvedValueOnce({ user_id: 'different-user' });

    const app = buildApp();
    const response = await request(app)
      .post('/api/auth/firebase')
      .set('Cookie', 'hc_refresh=refresh-def')
      .send({ idToken: 'token-abc-123456' });

    expect(response.status).toBe(200);
    expect(clearAuthCookiesMock).toHaveBeenCalledWith(expect.any(Object), 'refresh-def');
    expect(issueAuthCookiesMock).toHaveBeenCalledTimes(1);
  });
});
