import { Router } from 'express';
import * as bookingController from '../controllers/bookingController.ts';

const router = Router();

router.post('/payment', bookingController.handlePaymentWebhook);

export default router;
