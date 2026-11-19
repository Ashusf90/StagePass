import { Router } from 'express';
import { z } from 'zod';
import * as ticketController from '../controllers/ticketController.ts';
import { authenticate, authorizeRoles } from '../middlewares/auth.ts';
import { validateBody } from '../middlewares/validate.ts';

const router = Router();

const verifySchema = z.object({
  qrToken: z.string().min(10),
  eventId: z.string().optional(),
});

router.post(
  '/verify',
  authenticate,
  authorizeRoles('organizer', 'admin'),
  validateBody(verifySchema),
  ticketController.verifyTicket
);

export default router;
