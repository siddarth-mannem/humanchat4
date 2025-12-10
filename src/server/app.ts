import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import routes from './routes/index.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { env } from './config/env.js';
import { unauthenticatedLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { success } from './utils/apiResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Load OpenAPI specification
const openapiPath = join(__dirname, '../../openapi.yaml');
const swaggerDocument = YAML.load(openapiPath);

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const originMatchers = env.corsOrigins.map((entry) => {
  if (entry === '*') {
    return /.*/i;
  }
  if (entry.includes('*')) {
    const pattern = `^${entry.split('*').map((segment) => escapeRegex(segment)).join('.*')}$`;
    return new RegExp(pattern, 'i');
  }
  return entry;
});

const isAllowedOrigin = (origin?: string | null): boolean => {
  if (!origin) {
    return true;
  }
  return originMatchers.some((matcher) => {
    if (typeof matcher === 'string') {
      return matcher === origin;
    }
    return matcher.test(origin);
  });
};

// Forwarded headers come from Cloud Run's proxy, so trust the first hop to keep rate limiting stable.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      if (origin) {
        console.warn(`[CORS] Blocked origin: ${origin}`);
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(morgan('combined'));
app.use(cookieParser());
app.use('/health', (_req, res) => success(res, { status: 'ok' }));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'HumanChat API Documentation'
}));

app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use('/api', unauthenticatedLimiter, routes);
app.use(errorHandler);

export default app;
