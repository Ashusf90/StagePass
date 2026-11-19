import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/authController.ts';
import { authenticate } from '../middlewares/auth.ts';
import { authRateLimiter } from '../middlewares/rateLimiter.ts';
import { validateBody } from '../middlewares/validate.ts';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['attendee', 'organizer']).optional(),
  organizationName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', authRateLimiter, validateBody(registerSchema), authController.register);
router.post('/login', authRateLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
