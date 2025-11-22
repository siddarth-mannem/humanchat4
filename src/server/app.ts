import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { env } from './config/env.js';
import { unauthenticatedLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { success } from './utils/apiResponse.js';

const app = express();

// Forwarded headers come from Cloud Run's proxy, so trust the first hop to keep rate limiting stable.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true
  })
);
app.use(morgan('combined'));
app.use(cookieParser());
app.use('/health', (_req, res) => success(res, { status: 'ok' }));
app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use('/api', unauthenticatedLimiter, routes);
app.use(errorHandler);

export default app;
