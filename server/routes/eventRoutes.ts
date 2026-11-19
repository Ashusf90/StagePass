import { Router } from 'express';
import { z } from 'zod';
import * as eventController from '../controllers/eventController.ts';
import { authenticate, authorizeRoles, optionalAuth } from '../middlewares/auth.ts';
import { validateBody } from '../middlewares/validate.ts';

const router = Router();

const sectionSchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(['seat', 'tier']),
  price: z.number().min(0),
  rows: z.array(z.string().min(1).max(6)).optional(),
  seatsPerRow: z.number().int().min(1).max(30).optional(),
  capacity: z.number().int().min(1).max(5000).optional(),
  colorToken: z.string().optional(),
});

const createEventSchema = z.object({
  title: z.string().min(3).max(140),
  subtitle: z.string().max(200).optional(),
  description: z.string().min(10).max(4000),
  category: z.enum(['Concert', 'Theater', 'Conference', 'Festival', 'Sports']),
  venueName: z.string().min(2).max(120),
  address: z.string().min(4).max(220),
  city: z.string().min(2).max(80),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(['draft', 'published']).optional(),
  artworkTheme: z.enum(['symphony', 'amphitheater', 'summit', 'theater']).optional(),
  seatMapConfig: z.object({
    mode: z.enum(['seated', 'tiered', 'hybrid']),
    currency: z.string().min(3).max(3).default('USD'),
    stageLabel: z.string().min(2).max(60).default('Main Stage'),
    sections: z.array(sectionSchema).min(1),
  }),
  promoCodes: z
    .array(
      z.object({
        code: z.string().min(2).max(24),
        discountPercent: z.number().min(1).max(90),
        maxUses: z.number().int().min(1),
      })
    )
    .optional(),
  cancellationWindowHours: z.number().int().min(0).max(720).optional(),
});

const updateEventSchema = z.object({
  status: z.enum(['draft', 'published', 'cancelled']).optional(),
  promoCode: z
    .object({
      code: z.string().min(2).max(24),
      discountPercent: z.number().min(1).max(90),
      maxUses: z.number().int().min(1),
    })
    .optional(),
});

router.get('/', eventController.listEvents);
router.get(
  '/organizer/mine',
  authenticate,
  authorizeRoles('organizer', 'admin'),
  eventController.listOrganizerEvents
);
router.get('/:id', optionalAuth, eventController.getEventDetail);
router.post(
  '/',
  authenticate,
  authorizeRoles('organizer', 'admin'),
  validateBody(createEventSchema),
  eventController.createEvent
);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('organizer', 'admin'),
  validateBody(updateEventSchema),
  eventController.updateEvent
);
router.get(
  '/:id/analytics',
  authenticate,
  authorizeRoles('organizer', 'admin'),
  eventController.getEventAnalytics
);

export default router;
