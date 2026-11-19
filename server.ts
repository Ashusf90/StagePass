import cookieParser from 'cookie-parser';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { connectDatabase } from './server/config/db.ts';
import { env } from './server/config/env.ts';
import { startLockCleanupJob } from './server/jobs/lockCleanupJob.ts';
import { errorHandler } from './server/middlewares/errorHandler.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import authRoutes from './server/routes/authRoutes.ts';
import bookingRoutes from './server/routes/bookingRoutes.ts';
import eventRoutes from './server/routes/eventRoutes.ts';
import ticketRoutes from './server/routes/ticketRoutes.ts';
import webhookRoutes from './server/routes/webhookRoutes.ts';
import { seedDatabaseIfEmpty } from './server/seed/seedData.ts';

async function bootstrap() {
  await connectDatabase();
  await seedDatabaseIfEmpty();
  startLockCleanupJob(15_000);

  const app = express();
  app.set('trust proxy', 1);

  // Capture rawBody for webhook HMAC signature verification
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(cookieParser());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/webhooks', webhookRoutes);

  app.use(errorHandler);

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = env.nodeEnv === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[server] StagePass MERN server listening on http://0.0.0.0:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Fatal bootstrap error:', err);
  process.exit(1);
});
