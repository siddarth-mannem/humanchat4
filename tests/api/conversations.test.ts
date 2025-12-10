import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import conversationRoutes from '../../src/server/routes/conversationRoutes';
import { errorHandler } from '../../src/server/middleware/errorHandler';

const initiateInstantConnectionMock = jest.fn();
const acceptInstantInviteMock = jest.fn();
const declineInstantInviteMock = jest.fn();
const cancelInstantInviteMock = jest.fn();
const listConversationsMock = jest.fn();
const getConversationMessagesMock = jest.fn();
const addConversationMessageMock = jest.fn();

jest.mock('../../src/server/middleware/auth', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'user-123', email: 'sam@example.com', role: 'user' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
}));

jest.mock('../../src/server/middleware/rateLimit', () => ({
  authenticatedLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  unauthenticatedLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
}));

jest.mock('../../src/server/services/conversationService', () => ({
  listConversations: (...args: unknown[]) => listConversationsMock(...args),
  getConversationMessages: (...args: unknown[]) => getConversationMessagesMock(...args),
  addConversationMessage: (...args: unknown[]) => addConversationMessageMock(...args)
}));

jest.mock('../../src/server/services/connectionService', () => ({
  initiateInstantConnection: (...args: unknown[]) => initiateInstantConnectionMock(...args)
}));

jest.mock('../../src/server/services/instantInviteService', () => ({
  acceptInstantInvite: (...args: unknown[]) => acceptInstantInviteMock(...args),
  declineInstantInvite: (...args: unknown[]) => declineInstantInviteMock(...args),
  cancelInstantInvite: (...args: unknown[]) => cancelInstantInviteMock(...args)
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/conversations', conversationRoutes);
  app.use(errorHandler);
  return app;
};

describe('conversationRoutes /connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initiates an instant connection for the authenticated user', async () => {
    initiateInstantConnectionMock.mockResolvedValueOnce({
      flow: 'session',
      conversation: { id: 'conv-1' },
      session: { id: 'sess-1' }
    });

    const app = buildApp();
    const response = await request(app)
      .post('/api/conversations/connect')
      .send({ target_user_id: '43000000-0000-4000-8000-000000000001' });

    if (response.status !== 201) {
      // eslint-disable-next-line no-console
      console.error('connect route response', response.status, response.body);
      console.error('connect route details', response.body?.error?.details);
    }
    expect(response.status).toBe(201);
    expect(initiateInstantConnectionMock).toHaveBeenCalledWith('user-123', '43000000-0000-4000-8000-000000000001');
    expect(response.body?.data).toEqual({ flow: 'session', conversation: { id: 'conv-1' }, session: { id: 'sess-1' } });
  });

  it('validates the connect payload', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/conversations/connect').send({});

    if (response.status !== 400) {
      // eslint-disable-next-line no-console
      console.error('connect validation response', response.status, response.body);
    }
    expect(response.status).toBe(400);
    expect(initiateInstantConnectionMock).not.toHaveBeenCalled();
  });

  it('accepts an invite for the authenticated user', async () => {
    acceptInstantInviteMock.mockResolvedValueOnce({ invite: { id: 'invite-1' }, session: { id: 'sess-2' } });
    const app = buildApp();
    const response = await request(app).post('/api/conversations/invites/43000000-0000-4000-8000-000000000002/accept');

    expect(response.status).toBe(200);
    expect(acceptInstantInviteMock).toHaveBeenCalledWith('43000000-0000-4000-8000-000000000002', 'user-123');
    expect(response.body?.data).toEqual({ invite: { id: 'invite-1' }, session: { id: 'sess-2' } });
  });

  it('declines an invite for the authenticated user', async () => {
    declineInstantInviteMock.mockResolvedValueOnce({ id: 'invite-3' });
    const app = buildApp();
    const response = await request(app).post('/api/conversations/invites/43000000-0000-4000-8000-000000000003/decline');

    expect(response.status).toBe(200);
    expect(response.body?.data).toEqual({ invite: { id: 'invite-3' } });
    expect(declineInstantInviteMock).toHaveBeenCalledWith('43000000-0000-4000-8000-000000000003', 'user-123');
  });

  it('cancels an invite for the authenticated user', async () => {
    cancelInstantInviteMock.mockResolvedValueOnce({ id: 'invite-4' });
    const app = buildApp();
    const response = await request(app).post('/api/conversations/invites/43000000-0000-4000-8000-000000000004/cancel');

    expect(response.status).toBe(200);
    expect(response.body?.data).toEqual({ invite: { id: 'invite-4' } });
    expect(cancelInstantInviteMock).toHaveBeenCalledWith('43000000-0000-4000-8000-000000000004', 'user-123');
  });
});
