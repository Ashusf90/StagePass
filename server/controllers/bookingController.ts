import type { NextFunction, Request, Response } from 'express';
import * as bookingService from '../services/bookingService.ts';
import * as seatLockService from '../services/seatLockService.ts';

export async function lockSeats(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await seatLockService.lockSeatsForBooking({
      userId: req.user!.sub,
      eventId: req.body.eventId,
      seatIds: req.body.seatIds,
      tierSelections: req.body.tierSelections,
    });
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

export async function releaseLock(req: Request, res: Response, next: NextFunction) {
  try {
    await seatLockService.releaseBookingLock(String(req.params.id), req.user!.sub);
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined) || req.body.idempotencyKey;
    const result = await bookingService.initiateCheckout({
      bookingId: String(req.params.id),
      userId: req.user!.sub,
      promoCode: req.body.promoCode,
      idempotencyKey,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function confirmSandbox(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bookingService.confirmSandboxPayment({
      bookingId: String(req.params.id),
      userId: req.user!.sub,
      simulateDuplicateProviderEventId: req.body?.simulateDuplicateProviderEventId,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handlePaymentWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signatureHeader = String(req.headers['x-stagepass-signature'] || '');
    const rawBody =
      (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);
    const result = await bookingService.processPaymentWebhook({
      rawBody,
      signatureHeader,
      payload: req.body,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMyBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const bookings = await bookingService.getUserBookings(req.user!.sub);
    res.status(200).json({ bookings });
  } catch (err) {
    next(err);
  }
}

export async function getBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await bookingService.getBookingById(
      String(req.params.id),
      req.user!.sub,
      req.user!.role
    );
    res.status(200).json({ booking });
  } catch (err) {
    next(err);
  }
}

export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await bookingService.cancelAndRefundBooking({
      bookingId: String(req.params.id),
      userId: req.user!.sub,
      userRole: req.user!.role,
      reason: req.body?.reason,
    });
    res.status(200).json({ booking });
  } catch (err) {
    next(err);
  }
}
