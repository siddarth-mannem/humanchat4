import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/server/routes/authRoutes';

const registerUserMock = jest.fn();
const loginUserMock = jest.fn();
const requestMagicLinkMock = jest.fn();
const verifyMagicLinkMock = jest.fn();
const buildGoogleAuthUrlMock = jest.fn(() => 'https://google.test');
const handleGoogleCallbackMock = jest.fn();
const parseGoogleStateMock = jest.fn(() => ({}));
const loginWithSupabaseTokenMock = jest.fn();
const issueAuthCookiesMock = jest.fn();

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
  loginWithSupabaseToken: (...args: unknown[]) => loginWithSupabaseTokenMock(...(args as Parameters<typeof loginWithSupabaseTokenMock>))
}));

jest.mock('../../src/server/services/tokenService', () => ({
  issueAuthCookies: (...args: unknown[]) => issueAuthCookiesMock(...(args as Parameters<typeof issueAuthCookiesMock>)),
  clearAuthCookies: jest.fn(),
  refreshFromRequest: jest.fn()
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
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

  it('bridges Supabase sessions into API cookies', async () => {
    loginWithSupabaseTokenMock.mockResolvedValueOnce({ id: 'user-123', email: 'sam@example.com', role: 'user' });
    const app = buildApp();
    const response = await request(app).post('/api/auth/supabase').send({ accessToken: 'token-abc' });
    if (response.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('supabase route response', response.status, response.body);
    }

    expect(response.status).toBe(200);
    expect(loginWithSupabaseTokenMock).toHaveBeenCalledWith('token-abc');
    expect(issueAuthCookiesMock).toHaveBeenCalledWith(expect.any(Object), { id: 'user-123', email: 'sam@example.com', role: 'user' }, true);
  });

  it('validates Supabase payloads', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/auth/supabase').send({});
    if (response.status !== 400) {
      // eslint-disable-next-line no-console
      console.error('supabase validation response', response.status, response.body);
    }

    expect(response.status).toBe(400);
    expect(loginWithSupabaseTokenMock).not.toHaveBeenCalled();
  });
});
