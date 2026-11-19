import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.ts';
import { Booking, type IBooking } from '../models/Booking.ts';
import { Event } from '../models/Event.ts';
import { Seat, type ISeat } from '../models/Seat.ts';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.ts';

function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `SP-${suffix}`;
}

export async function releaseExpiredLocks(): Promise<{
  releasedSeats: number;
  expiredBookings: number;
}> {
  const now = new Date();

  const [seatResult, bookingResult] = await Promise.all([
    Seat.updateMany(
      {
        status: 'locked',
        lockExpiresAt: { $lte: now },
      },
      {
        $set: {
          status: 'available',
          lockedByUserId: null,
          lockExpiresAt: null,
          bookingId: null,
        },
      }
    ),
    Booking.updateMany(
      {
        status: 'pending_payment',
        lockExpiresAt: { $lte: now },
      },
      {
        $set: {
          status: 'expired',
        },
      }
    ),
  ]);

  return {
    releasedSeats: seatResult.modifiedCount || 0,
    expiredBookings: bookingResult.modifiedCount || 0,
  };
}

export async function lockSeatsForBooking(input: {
  userId: string;
  eventId: string;
  seatIds?: string[];
  tierSelections?: Array<{ section: string; quantity: number }>;
}): Promise<IBooking> {
  await releaseExpiredLocks();

  const event = await Event.findById(input.eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  if (event.status !== 'published' || event.approvalStatus !== 'approved') {
    throw new BadRequestError('This event is not currently open for booking');
  }
  if (event.endDate <= new Date()) {
    throw new BadRequestError('This event has already ended');
  }

  const requestedSeatIds = Array.from(new Set(input.seatIds || []));
  const tierSelections = (input.tierSelections || []).filter((t) => t.quantity > 0);
  const totalRequestedCount =
    requestedSeatIds.length +
    tierSelections.reduce((sum, item) => sum + item.quantity, 0);

  if (totalRequestedCount === 0) {
    throw new BadRequestError('Select at least one seat or ticket tier to hold');
  }
  if (totalRequestedCount > 8) {
    throw new BadRequestError('You can hold a maximum of 8 tickets per reservation');
  }

  const userObjectId = new mongoose.Types.ObjectId(input.userId);
  const eventObjectId = new mongoose.Types.ObjectId(input.eventId);

  // Release any previous pending hold by this same user on this event so holds stay clean
  const previousPending = await Booking.find({
    userId: userObjectId,
    eventId: eventObjectId,
    status: 'pending_payment',
  });

  if (previousPending.length > 0) {
    const prevIds = previousPending.map((b) => b._id);
    await Seat.updateMany(
      {
        eventId: eventObjectId,
        bookingId: { $in: prevIds },
        status: 'locked',
        lockedByUserId: userObjectId,
      },
      {
        $set: {
          status: 'available',
          lockedByUserId: null,
          lockExpiresAt: null,
          bookingId: null,
        },
      }
    );
    await Booking.updateMany(
      { _id: { $in: prevIds }, status: 'pending_payment' },
      { $set: { status: 'expired', lockExpiresAt: new Date() } }
    );
  }

  const bookingId = new mongoose.Types.ObjectId();
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + env.seatLockDurationMs);
  const lockedSeats: ISeat[] = [];

  try {
    // 1. Atomically lock individually selected seats
    for (const rawSeatId of requestedSeatIds) {
      const locked = await Seat.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(rawSeatId),
          eventId: eventObjectId,
          $or: [
            { status: 'available' },
            { status: 'locked', lockExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            status: 'locked',
            lockedByUserId: userObjectId,
            lockExpiresAt,
            bookingId,
          },
        },
        { new: true }
      );

      if (!locked) {
        throw new ConflictError(
          'One or more selected seats were just held or booked by another attendee. Please choose different seats.',
          'SEAT_CONFLICT'
        );
      }
      lockedSeats.push(locked);
    }

    // 2. Atomically lock requested quantity from General Admission / Tier capacity
    for (const tierReq of tierSelections) {
      for (let i = 0; i < tierReq.quantity; i++) {
        const lockedTierUnit = await Seat.findOneAndUpdate(
          {
            eventId: eventObjectId,
            kind: 'tier',
            section: tierReq.section,
            $or: [
              { status: 'available' },
              { status: 'locked', lockExpiresAt: { $lte: now } },
            ],
          },
          {
            $set: {
              status: 'locked',
              lockedByUserId: userObjectId,
              lockExpiresAt,
              bookingId,
            },
          },
          { new: true }
        );

        if (!lockedTierUnit) {
          throw new ConflictError(
            `Not enough remaining tickets in ${tierReq.section}.`,
            'TIER_CAPACITY_CONFLICT'
          );
        }
        lockedSeats.push(lockedTierUnit);
      }
    }
  } catch (err) {
    // Compensating rollback: immediately release any seats locked in this batch
    if (lockedSeats.length > 0) {
      await Seat.updateMany(
        {
          _id: { $in: lockedSeats.map((s) => s._id) },
          lockedByUserId: userObjectId,
          bookingId,
        },
        {
          $set: {
            status: 'available',
            lockedByUserId: null,
            lockExpiresAt: null,
            bookingId: null,
          },
        }
      );
    }
    throw err;
  }

  const items = lockedSeats.map((seat) => ({
    seatId: seat._id,
    section: seat.section,
    row: seat.row,
    seatNumber: seat.seatNumber,
    tierName: seat.tierName,
    unitPrice: seat.price,
  }));

  const subtotalAmount = items.reduce((sum, item) => sum + item.unitPrice, 0);

  const booking = await Booking.create({
    _id: bookingId,
    bookingReference: generateBookingReference(),
    userId: userObjectId,
    eventId: eventObjectId,
    items,
    subtotalAmount,
    discountAmount: 0,
    totalAmount: subtotalAmount,
    currency: event.seatMapConfig.currency || 'USD',
    status: 'pending_payment',
    lockExpiresAt,
  });

  return booking;
}

export async function releaseBookingLock(bookingId: string, userId: string): Promise<void> {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new NotFoundError('Reservation not found');
  }
  if (booking.userId.toString() !== userId) {
    throw new ForbiddenError('You do not own this reservation');
  }
  if (booking.status !== 'pending_payment') {
    return;
  }

  await Seat.updateMany(
    {
      bookingId: booking._id,
      status: 'locked',
      lockedByUserId: booking.userId,
    },
    {
      $set: {
        status: 'available',
        lockedByUserId: null,
        lockExpiresAt: null,
        bookingId: null,
      },
    }
  );

  booking.status = 'expired';
  booking.lockExpiresAt = new Date();
  await booking.save();
}

export async function validateOwnedActiveLocks(
  bookingId: string,
  userId: string
): Promise<IBooking> {
  await releaseExpiredLocks();

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new NotFoundError('Reservation not found');
  }
  if (booking.userId.toString() !== userId) {
    throw new ForbiddenError('You do not own this reservation');
  }
  if (booking.status === 'expired') {
    throw new ConflictError(
      'Your 10-minute seat hold has expired. Please re-select your seats.',
      'LOCK_EXPIRED'
    );
  }
  if (booking.status !== 'pending_payment') {
    throw new ConflictError(`Reservation is already ${booking.status}`, 'INVALID_STATE');
  }
  if (!booking.lockExpiresAt || booking.lockExpiresAt <= new Date()) {
    await releaseBookingLock(bookingId, userId);
    throw new ConflictError(
      'Your 10-minute seat hold has expired. Please re-select your seats.',
      'LOCK_EXPIRED'
    );
  }

  const ownedSeatCount = await Seat.countDocuments({
    _id: { $in: booking.items.map((item) => item.seatId) },
    bookingId: booking._id,
    status: 'locked',
    lockedByUserId: booking.userId,
    lockExpiresAt: { $gt: new Date() },
  });

  if (ownedSeatCount !== booking.items.length) {
    throw new ConflictError(
      'Seat lock ownership could not be verified. Please re-select your seats.',
      'LOCK_INVALID'
    );
  }

  return booking;
}
