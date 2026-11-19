import { Router } from 'express';
import { z } from 'zod';
import * as adminController from '../controllers/adminController.ts';
import { authenticate, authorizeRoles } from '../middlewares/auth.ts';
import { validateBody } from '../middlewares/validate.ts';

const router = Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/overview', adminController.getOverview);
router.patch(
  '/organizers/:id/status',
  validateBody(z.object({ status: z.enum(['approved', 'suspended']) })),
  adminController.updateOrganizerStatus
);
router.patch(
  '/events/:id/moderation',
  validateBody(z.object({ approvalStatus: z.enum(['approved', 'rejected']) })),
  adminController.updateEventModeration
);

export default router;
