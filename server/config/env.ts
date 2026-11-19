import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET || 'stagepass-dev-access-secret-key-2026',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || 'stagepass-dev-refresh-secret-key-2026',
  qrSigningSecret:
    process.env.QR_SIGNING_SECRET || 'stagepass-dev-qr-signing-secret-2026',
  paymentWebhookSecret:
    process.env.PAYMENT_WEBHOOK_SECRET || 'stagepass-dev-webhook-hmac-secret-2026',
  accessTokenTtl: '15m',
  refreshTokenTtl: '7d',
  seatLockDurationMs: 10 * 60 * 1000, // 10 minutes
  appUrl: process.env.APP_URL || 'http://localhost:3000',
} as const;
