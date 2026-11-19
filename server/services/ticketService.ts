import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.ts';
import { Booking } from '../models/Booking.ts';
import { Event } from '../models/Event.ts';
import { verifyQrToken } from '../utils/crypto.ts';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.ts';

export async function verifyAndCheckInTicket(input: {
  qrToken: string;
  eventId?: string;
  staffUserId: string;
  staffRole: string;
}) {
  if (!input.qrToken || !input.qrToken.trim()) {
    throw new BadRequestError('QR ticket token is required');
  }

  let decoded;
  try {
    decoded = verifyQrToken(input.qrToken.trim());
  } catch {
    throw new BadRequestError('Invalid or tampered QR ticket signature', 'INVALID_QR');
  }

  if (input.eventId && decoded.eventId !== input.eventId) {
    throw new ConflictError(
      'This ticket belongs to a different event.',
      'EVENT_MISMATCH'
    );
  }

  const event = await Event.findById(decoded.eventId);
  if (!event) {
    throw new NotFoundError('Event associated with this ticket was not found');
  }

  if (
    input.staffRole !== 'admin' &&
    event.organizerId.toString() !== input.staffUserId
  ) {
    throw new ForbiddenError(
      'You can only verify tickets for events organized by your account'
    );
  }

  // Atomic single check-in guard: prevents simultaneous duplicate gate scans
  const checkedInBooking = await Booking.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(decoded.bookingId),
      eventId: event._id,
      status: 'confirmed',
      checkedInAt: null,
    },
    {
      $set: {
        checkedInAt: new Date(),
        checkedInBy: new mongoose.Types.ObjectId(input.staffUserId),
      },
    },
    { new: true }
  )
    .populate('userId', 'name email')
    .populate('eventId', 'title venueName startDate');

  if (!checkedInBooking) {
    const existing = await Booking.findById(decoded.bookingId).populate(
      'userId',
      'name email'
    );
    if (!existing) {
      throw new NotFoundError('Ticket booking record does not exist');
    }
    if (existing.status !== 'confirmed') {
      throw new ConflictError(
        `Ticket cannot be admitted because booking status is '${existing.status}'`,
        'TICKET_NOT_ACTIVE'
      );
    }
    if (existing.checkedInAt) {
      throw new ConflictError(
        `Duplicate scan blocked: ticket ${existing.bookingReference} was already checked in at ${existing.checkedInAt.toISOString()}`,
        'ALREADY_CHECKED_IN',
        { checkedInAt: existing.checkedInAt, bookingReference: existing.bookingReference }
      );
    }
    throw new ConflictError('Ticket could not be verified');
  }

  await AuditLog.create({
    actorId: new mongoose.Types.ObjectId(input.staffUserId),
    actorRole: input.staffRole,
    action: 'ticket.checked_in',
    targetType: 'Booking',
    targetId: checkedInBooking._id.toString(),
    details: {
      bookingReference: checkedInBooking.bookingReference,
      ticketCode: decoded.ticketCode,
      eventId: event._id.toString(),
    },
  });

  return {
    verified: true,
    ticketCode: decoded.ticketCode,
    booking: checkedInBooking,
  };
}
