import { Router } from 'express';
import { z } from 'zod';
import * as bookingController from '../controllers/bookingController.ts';
import { authenticate } from '../middlewares/auth.ts';
import { bookingRateLimiter } from '../middlewares/rateLimiter.ts';
import { validateBody } from '../middlewares/validate.ts';

const router = Router();

const lockSchema = z.object({
  eventId: z.string().min(1),
  seatIds: z.array(z.string()).optional(),
  tierSelections: z
    .array(
      z.object({
        section: z.string().min(1),
        quantity: z.number().int().min(0).max(8),
      })
    )
    .optional(),
});

const checkoutSchema = z.object({
  promoCode: z.string().max(24).optional(),
  idempotencyKey: z.string().max(120).optional(),
});

const confirmSandboxSchema = z.object({
  simulateDuplicateProviderEventId: z.string().optional(),
});

const cancelSchema = z.object({
  reason: z.string().max(300).optional(),
});

router.use(authenticate);

router.get('/me', bookingController.listMyBookings);
router.post('/lock', bookingRateLimiter, validateBody(lockSchema), bookingController.lockSeats);
router.delete('/:id/lock', bookingController.releaseLock);
router.post(
  '/:id/checkout',
  bookingRateLimiter,
  validateBody(checkoutSchema),
  bookingController.checkout
);
router.post(
  '/:id/confirm-sandbox',
  bookingRateLimiter,
  validateBody(confirmSandboxSchema),
  bookingController.confirmSandbox
);
router.get('/:id', bookingController.getBooking);
router.post('/:id/cancel', validateBody(cancelSchema), bookingController.cancelBooking);

export default router;
