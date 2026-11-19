import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.ts';
import { Booking } from '../models/Booking.ts';
import { Event } from '../models/Event.ts';
import { PaymentWebhookEvent } from '../models/PaymentWebhookEvent.ts';
import { Seat } from '../models/Seat.ts';
import { User } from '../models/User.ts';
import { signQrToken } from '../utils/crypto.ts';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors.ts';
import { paymentGateway, type PaymentWebhookPayload } from './paymentService.ts';
import { validateOwnedActiveLocks } from './seatLockService.ts';

export async function initiateCheckout(input: {
  bookingId: string;
  userId: string;
  promoCode?: string;
  idempotencyKey?: string;
}) {
  if (input.idempotencyKey) {
    const existingByKey = await Booking.findOne({
      idempotencyKey: input.idempotencyKey,
      userId: new mongoose.Types.ObjectId(input.userId),
    });
    if (existingByKey && existingByKey.paymentIntentId) {
      return {
        booking: existingByKey,
        paymentIntent: {
          paymentIntentId: existingByKey.paymentIntentId,
          provider: paymentGateway.providerName,
          amount: existingByKey.totalAmount,
          currency: existingByKey.currency,
        },
        idempotentReplay: true,
      };
    }
  }

  const booking = await validateOwnedActiveLocks(input.bookingId, input.userId);
  const event = await Event.findById(booking.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  const user = await User.findById(input.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  let discountAmount = 0;
  let appliedPromo: string | undefined;

  if (input.promoCode && input.promoCode.trim()) {
    const normalized = input.promoCode.trim().toUpperCase();
    const promo = event.promoCodes.find(
      (p) =>
        p.code === normalized &&
        p.active &&
        p.usedCount < p.maxUses &&
        (!p.expiresAt || p.expiresAt > new Date())
    );
    if (!promo) {
      throw new BadRequestError(`Promo code '${normalized}' is invalid or expired`);
    }
    discountAmount = Number(
      ((booking.subtotalAmount * promo.discountPercent) / 100).toFixed(2)
    );
    appliedPromo = promo.code;
  }

  const totalAmount = Math.max(0, Number((booking.subtotalAmount - discountAmount).toFixed(2)));

  const paymentIntent = await paymentGateway.createPaymentIntent({
    bookingId: booking._id.toString(),
    bookingReference: booking.bookingReference,
    amount: totalAmount,
    currency: booking.currency,
    customerEmail: user.email,
  });

  booking.discountAmount = discountAmount;
  booking.promoCode = appliedPromo;
  booking.totalAmount = totalAmount;
  booking.paymentIntentId = paymentIntent.paymentIntentId;
  if (input.idempotencyKey) {
    booking.idempotencyKey = input.idempotencyKey;
  }
  await booking.save();

  return {
    booking,
    paymentIntent,
    idempotentReplay: false,
  };
}

export async function processPaymentWebhook(input: {
  rawBody: string;
  signatureHeader: string;
  payload: PaymentWebhookPayload;
}) {
  const isSignatureValid = paymentGateway.verifySignature(
    input.rawBody,
    input.signatureHeader
  );

  if (!isSignatureValid) {
    throw new UnauthorizedError('Invalid payment webhook signature', 'INVALID_SIGNATURE');
  }

  const { providerEventId, eventType, provider, data } = input.payload;
  if (!providerEventId || !eventType || !data?.bookingId) {
    throw new BadRequestError('Malformed webhook payload');
  }

  // Enforce idempotency via unique index on providerEventId
  try {
    await PaymentWebhookEvent.create({
      providerEventId,
      provider: provider || paymentGateway.providerName,
      eventType,
      bookingId: new mongoose.Types.ObjectId(data.bookingId),
      paymentIntentId: data.paymentIntentId,
      signatureVerified: true,
      status: 'processed',
      processedAt: new Date(),
      payloadSummary: {
        amount: data.amount,
        currency: data.currency,
        bookingId: data.bookingId,
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: number }).code === 11000
    ) {
      // Duplicate webhook delivery: return 200 OK without re-processing
      return {
        received: true,
        duplicate: true,
        providerEventId,
      };
    }
    throw err;
  }

  if (eventType !== 'payment_intent.succeeded') {
    return {
      received: true,
      duplicate: false,
      providerEventId,
      handled: false,
    };
  }

  const booking = await Booking.findById(data.bookingId);
  if (!booking) {
    throw new NotFoundError('Booking referenced by webhook not found');
  }

  if (booking.status === 'confirmed') {
    return {
      received: true,
      duplicate: true,
      providerEventId,
      booking,
    };
  }

  if (booking.status !== 'pending_payment') {
    throw new ConflictError(
      `Cannot confirm booking in '${booking.status}' status`,
      'BOOKING_NOT_PENDING'
    );
  }

  // Atomically transition seats from locked -> booked
  const seatIds = booking.items.map((item) => item.seatId);
  const seatUpdate = await Seat.updateMany(
    {
      _id: { $in: seatIds },
      bookingId: booking._id,
      status: 'locked',
      lockedByUserId: booking.userId,
    },
    {
      $set: {
        status: 'booked',
        lockExpiresAt: null,
      },
    }
  );

  if (seatUpdate.modifiedCount !== booking.items.length) {
    throw new ConflictError(
      'Unable to finalize all reserved seats because lock ownership expired',
      'SEAT_FINALIZATION_FAILED'
    );
  }

  const ticketCode = `TKT-${booking.bookingReference}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;

  const qrCodeToken = signQrToken({
    bookingId: booking._id.toString(),
    eventId: booking.eventId.toString(),
    userId: booking.userId.toString(),
    ticketCode,
  });

  booking.status = 'confirmed';
  booking.lockExpiresAt = null;
  booking.paymentIntentId = data.paymentIntentId || booking.paymentIntentId;
  booking.qrCodeToken = qrCodeToken;
  await booking.save();

  if (booking.promoCode) {
    await Event.updateOne(
      { _id: booking.eventId, 'promoCodes.code': booking.promoCode },
      { $inc: { 'promoCodes.$.usedCount': 1 } }
    );
  }

  await AuditLog.create({
    actorId: booking.userId,
    actorRole: 'system_webhook',
    action: 'booking.confirmed',
    targetType: 'Booking',
    targetId: booking._id.toString(),
    details: {
      bookingReference: booking.bookingReference,
      providerEventId,
      totalAmount: booking.totalAmount,
      seatsCount: booking.items.length,
    },
  });

  return {
    received: true,
    duplicate: false,
    providerEventId,
    booking,
  };
}

export async function confirmSandboxPayment(input: {
  bookingId: string;
  userId: string;
  simulateDuplicateProviderEventId?: string;
}) {
  const booking = await Booking.findById(input.bookingId);
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }
  if (booking.userId.toString() !== input.userId) {
    throw new ForbiddenError('You do not own this booking');
  }
  if (!booking.paymentIntentId) {
    throw new BadRequestError('Checkout has not been initiated for this booking');
  }

  // Only enforce lock validity if not intentionally simulating a duplicate webhook on an already confirmed booking
  if (booking.status === 'pending_payment') {
    await validateOwnedActiveLocks(input.bookingId, input.userId);
  }

  const { rawBody, signature, payload } = paymentGateway.buildSignedWebhook({
    paymentIntentId: booking.paymentIntentId,
    bookingId: booking._id.toString(),
    amount: booking.totalAmount,
    currency: booking.currency,
    providerEventId: input.simulateDuplicateProviderEventId,
  });

  const result = await processPaymentWebhook({
    rawBody,
    signatureHeader: signature,
    payload,
  });

  const updatedBooking = await Booking.findById(booking._id).populate(
    'eventId',
    'title venueName address city startDate endDate category artworkTheme'
  );

  return {
    ...result,
    booking: updatedBooking,
  };
}

export async function getUserBookings(userId: string) {
  return Booking.find({ userId: new mongoose.Types.ObjectId(userId) })
    .populate(
      'eventId',
      'title subtitle venueName address city startDate endDate category artworkTheme cancellationWindowHours status'
    )
    .sort({ createdAt: -1 });
}

export async function getBookingById(bookingId: string, requesterId: string, requesterRole: string) {
  const booking = await Booking.findById(bookingId).populate(
    'eventId',
    'title subtitle venueName address city startDate endDate category artworkTheme organizerId cancellationWindowHours'
  );
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  const eventDoc = booking.eventId as unknown as { organizerId?: mongoose.Types.ObjectId };
  const isOwner = booking.userId.toString() === requesterId;
  const isOrganizer = eventDoc?.organizerId?.toString() === requesterId;
  if (!isOwner && !isOrganizer && requesterRole !== 'admin') {
    throw new ForbiddenError('Not authorized to view this booking');
  }
  return booking;
}

export async function cancelAndRefundBooking(input: {
  bookingId: string;
  userId: string;
  userRole: string;
  reason?: string;
}) {
  const booking = await Booking.findById(input.bookingId);
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }
  if (booking.userId.toString() !== input.userId && input.userRole !== 'admin') {
    throw new ForbiddenError('Not authorized to cancel this booking');
  }
  if (booking.status !== 'confirmed') {
    throw new BadRequestError(
      `Only confirmed bookings can be cancelled and refunded (current status: ${booking.status})`
    );
  }
  if (booking.checkedInAt) {
    throw new ConflictError(
      'Checked-in tickets are no longer eligible for cancellation or refund'
    );
  }

  const event = await Event.findById(booking.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const hoursUntilEvent =
    (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (
    input.userRole !== 'admin' &&
    hoursUntilEvent < (event.cancellationWindowHours ?? 24)
  ) {
    throw new BadRequestError(
      `Refunds are only eligible at least ${event.cancellationWindowHours} hours prior to event start`
    );
  }

  const seatIds = booking.items.map((i) => i.seatId);
  await Seat.updateMany(
    { _id: { $in: seatIds }, bookingId: booking._id },
    {
      $set: {
        status: 'available',
        lockedByUserId: null,
        lockExpiresAt: null,
        bookingId: null,
      },
    }
  );

  booking.status = 'refunded';
  booking.refundReason = input.reason?.trim() || 'Requested by attendee';
  booking.refundedAt = new Date();
  await booking.save();

  await AuditLog.create({
    actorId: new mongoose.Types.ObjectId(input.userId),
    actorRole: input.userRole,
    action: 'booking.refunded',
    targetType: 'Booking',
    targetId: booking._id.toString(),
    details: {
      bookingReference: booking.bookingReference,
      refundAmount: booking.totalAmount,
      reason: booking.refundReason,
    },
  });

  return booking;
}
