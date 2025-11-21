import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/humanchat',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  cookieDomain: process.env.COOKIE_DOMAIN,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePlatformFeeBps: process.env.STRIPE_PLATFORM_FEE_BPS ? Number(process.env.STRIPE_PLATFORM_FEE_BPS) : 1000,
  stripeCharityAccountId: process.env.STRIPE_CHARITY_CONNECT_ACCOUNT,
  corsOrigin: process.env.CORS_ORIGIN ?? 'https://humanchat.com',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ?? `${process.env.API_BASE_URL ?? 'http://localhost:4000'}/api/auth/google/callback`,
  magicLinkSecret: process.env.MAGIC_LINK_SECRET ?? 'dev-magic-secret',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM ?? 'Sam <sam@humanchat.com>',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
  postgresCryptoKey: process.env.POSTGRES_CRYPTO_KEY ?? 'change-me'
};
