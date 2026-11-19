import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.ts';
import { Booking } from '../models/Booking.ts';
import { Event, type IEvent, type ISectionConfig } from '../models/Event.ts';
import { PaymentWebhookEvent } from '../models/PaymentWebhookEvent.ts';
import { Seat } from '../models/Seat.ts';
import { User } from '../models/User.ts';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.ts';
import { releaseExpiredLocks } from './seatLockService.ts';

export async function generateSeatsForEvent(
  eventId: mongoose.Types.ObjectId,
  sections: ISectionConfig[]
): Promise<number> {
  const docs: Array<{
    eventId: mongoose.Types.ObjectId;
    kind: 'seat' | 'tier';
    section: string;
    row?: string;
    seatNumber: string;
    tierName?: string;
    price: number;
    status: 'available';
  }> = [];

  for (const sec of sections) {
    if (sec.kind === 'seat') {
      const rows = sec.rows && sec.rows.length > 0 ? sec.rows : ['A', 'B', 'C'];
      const perRow = sec.seatsPerRow || 8;
      for (const row of rows) {
        for (let num = 1; num <= perRow; num++) {
          docs.push({
            eventId,
            kind: 'seat',
            section: sec.name,
            row,
            seatNumber: String(num),
            price: sec.price,
            status: 'available',
          });
        }
      }
    } else {
      const capacity = sec.capacity || 25;
      for (let idx = 1; idx <= capacity; idx++) {
        docs.push({
          eventId,
          kind: 'tier',
          section: sec.name,
          row: 'GA',
          seatNumber: `${sec.name.slice(0, 3).toUpperCase()}-${String(idx).padStart(3, '0')}`,
          tierName: sec.name,
          price: sec.price,
          status: 'available',
        });
      }
    }
  }

  if (docs.length > 0) {
    await Seat.insertMany(docs);
  }
  return docs.length;
}

export async function listPublicEvents(filters: {
  search?: string;
  category?: string;
  dateFilter?: 'upcoming' | 'this_week' | 'this_month' | 'all';
}) {
  await releaseExpiredLocks();

  const query: Record<string, unknown> = {
    status: 'published',
    approvalStatus: 'approved',
  };

  if (filters.category && filters.category !== 'All') {
    query.category = filters.category;
  }

  const now = new Date();
  if (filters.dateFilter === 'this_week') {
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    query.startDate = { $gte: now, $lte: weekEnd };
  } else if (filters.dateFilter === 'this_month') {
    const monthEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    query.startDate = { $gte: now, $lte: monthEnd };
  } else if (filters.dateFilter !== 'all') {
    query.endDate = { $gte: now };
  }

  if (filters.search && filters.search.trim()) {
    const regex = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { title: regex },
      { venueName: regex },
      { city: regex },
      { category: regex },
    ];
  }

  const events = await Event.find(query)
    .populate('organizerId', 'name organizationName')
    .sort({ startDate: 1 });

  // Attach real-time seat availability counts & starting price
  const eventIds = events.map((e) => e._id);
  const stats = await Seat.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    {
      $group: {
        _id: '$eventId',
        totalSeats: { $sum: 1 },
        availableSeats: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] },
        },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
  ]);

  const statsMap = new Map(stats.map((s) => [s._id.toString(), s]));

  return events.map((ev) => {
    const s = statsMap.get(ev._id.toString());
    return {
      ...ev.toObject(),
      availability: {
        totalSeats: s?.totalSeats ?? 0,
        availableSeats: s?.availableSeats ?? 0,
        minPrice: s?.minPrice ?? 0,
        maxPrice: s?.maxPrice ?? 0,
      },
    };
  });
}

export async function getEventWithSeats(eventId: string, viewerUserId?: string) {
  await releaseExpiredLocks();

  const event = await Event.findById(eventId).populate(
    'organizerId',
    'name organizationName'
  );
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const seats = await Seat.find({ eventId: event._id }).sort({
    section: 1,
    row: 1,
    seatNumber: 1,
  });

  // Expose safe lock state (indicate whether locked by the requesting user vs someone else)
  const sanitizedSeats = seats.map((seat) => ({
    _id: seat._id,
    kind: seat.kind,
    section: seat.section,
    row: seat.row,
    seatNumber: seat.seatNumber,
    tierName: seat.tierName,
    price: seat.price,
    status: seat.status,
    lockExpiresAt: seat.lockExpiresAt,
    isLockedByMe:
      Boolean(viewerUserId) &&
      seat.status === 'locked' &&
      seat.lockedByUserId?.toString() === viewerUserId,
  }));

  // Aggregate tier summary for tiered/hybrid sections
  const tierSummaryMap = new Map<
    string,
    { section: string; price: number; total: number; available: number; locked: number; booked: number }
  >();

  for (const s of seats) {
    if (s.kind === 'tier') {
      const existing = tierSummaryMap.get(s.section) || {
        section: s.section,
        price: s.price,
        total: 0,
        available: 0,
        locked: 0,
        booked: 0,
      };
      existing.total += 1;
      existing[s.status] += 1;
      tierSummaryMap.set(s.section, existing);
    }
  }

  return {
    event: {
      ...event.toObject(),
      promoCodes: event.promoCodes
        .filter((p) => p.active && p.usedCount < p.maxUses)
        .map((p) => ({ code: p.code, discountPercent: p.discountPercent })),
    },
    seats: sanitizedSeats,
    tierSummary: Array.from(tierSummaryMap.values()),
  };
}

export async function createOrganizerEvent(
  organizerId: string,
  input: {
    title: string;
    subtitle?: string;
    description: string;
    category: IEvent['category'];
    venueName: string;
    address: string;
    city: string;
    startDate: string;
    endDate: string;
    status?: 'draft' | 'published';
    artworkTheme?: IEvent['artworkTheme'];
    seatMapConfig: {
      mode: 'seated' | 'tiered' | 'hybrid';
      currency: string;
      stageLabel: string;
      sections: ISectionConfig[];
    };
    promoCodes?: Array<{ code: string; discountPercent: number; maxUses: number }>;
    cancellationWindowHours?: number;
  }
) {
  const organizer = await User.findById(organizerId);
  if (!organizer) {
    throw new NotFoundError('Organizer not found');
  }
  if (organizer.organizerStatus === 'suspended') {
    throw new ForbiddenError('Suspended organizers cannot create events');
  }

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (end <= start) {
    throw new BadRequestError('Event end date must be after start date');
  }

  const event = await Event.create({
    organizerId: organizer._id,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    category: input.category,
    venueName: input.venueName,
    address: input.address,
    city: input.city,
    startDate: start,
    endDate: end,
    status: input.status || 'published',
    approvalStatus: organizer.organizerStatus === 'approved' ? 'approved' : 'pending',
    artworkTheme: input.artworkTheme || 'symphony',
    seatMapConfig: input.seatMapConfig,
    promoCodes: (input.promoCodes || []).map((p) => ({
      ...p,
      code: p.code.toUpperCase(),
      usedCount: 0,
      active: true,
    })),
    cancellationWindowHours: input.cancellationWindowHours ?? 24,
  });

  const seatCount = await generateSeatsForEvent(event._id, input.seatMapConfig.sections);

  await AuditLog.create({
    actorId: organizer._id,
    actorEmail: organizer.email,
    actorRole: organizer.role,
    action: 'event.created',
    targetType: 'Event',
    targetId: event._id.toString(),
    details: { title: event.title, seatCount, approvalStatus: event.approvalStatus },
  });

  return { event, seatCount };
}

export async function updateOrganizerEvent(
  eventId: string,
  requesterId: string,
  requesterRole: string,
  updates: {
    status?: 'draft' | 'published' | 'cancelled';
    promoCode?: { code: string; discountPercent: number; maxUses: number };
  }
) {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  if (event.organizerId.toString() !== requesterId && requesterRole !== 'admin') {
    throw new ForbiddenError('Not authorized to modify this event');
  }

  if (updates.status) {
    event.status = updates.status;
  }

  if (updates.promoCode) {
    const code = updates.promoCode.code.trim().toUpperCase();
    const existingIdx = event.promoCodes.findIndex((p) => p.code === code);
    if (existingIdx >= 0) {
      event.promoCodes[existingIdx].discountPercent = updates.promoCode.discountPercent;
      event.promoCodes[existingIdx].maxUses = updates.promoCode.maxUses;
      event.promoCodes[existingIdx].active = true;
    } else {
      event.promoCodes.push({
        code,
        discountPercent: updates.promoCode.discountPercent,
        maxUses: updates.promoCode.maxUses,
        usedCount: 0,
        active: true,
      });
    }
  }

  await event.save();
  return event;
}

export async function getOrganizerEvents(organizerId: string) {
  await releaseExpiredLocks();
  const events = await Event.find({
    organizerId: new mongoose.Types.ObjectId(organizerId),
  }).sort({ createdAt: -1 });

  const eventIds = events.map((e) => e._id);
  const [seatAgg, bookingAgg] = await Promise.all([
    Seat.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      {
        $group: {
          _id: '$eventId',
          total: { $sum: 1 },
          booked: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } },
          locked: { $sum: { $cond: [{ $eq: ['$status', 'locked'] }, 1, 0] } },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { eventId: { $in: eventIds }, status: 'confirmed' } },
      {
        $group: {
          _id: '$eventId',
          revenue: { $sum: '$totalAmount' },
          confirmedBookings: { $sum: 1 },
          checkedInCount: {
            $sum: { $cond: [{ $ne: ['$checkedInAt', null] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const seatMap = new Map(seatAgg.map((s) => [s._id.toString(), s]));
  const bookingMap = new Map(bookingAgg.map((b) => [b._id.toString(), b]));

  return events.map((ev) => {
    const seats = seatMap.get(ev._id.toString()) || {
      total: 0,
      booked: 0,
      locked: 0,
      available: 0,
    };
    const sales = bookingMap.get(ev._id.toString()) || {
      revenue: 0,
      confirmedBookings: 0,
      checkedInCount: 0,
    };
    return {
      ...ev.toObject(),
      metrics: {
        ...seats,
        ...sales,
      },
    };
  });
}

export async function getEventAnalytics(
  eventId: string,
  requesterId: string,
  requesterRole: string
) {
  await releaseExpiredLocks();
  const event = await Event.findById(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  if (event.organizerId.toString() !== requesterId && requesterRole !== 'admin') {
    throw new ForbiddenError('Not authorized to view analytics for this event');
  }

  const [sectionBreakdown, bookings] = await Promise.all([
    Seat.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: '$section',
          price: { $first: '$price' },
          total: { $sum: 1 },
          booked: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } },
          locked: { $sum: { $cond: [{ $eq: ['$status', 'locked'] }, 1, 0] } },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
        },
      },
      { $sort: { price: -1 } },
    ]),
    Booking.find({ eventId: event._id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50),
  ]);

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const checkedInBookings = confirmedBookings.filter((b) => Boolean(b.checkedInAt)).length;
  const ticketsSold = confirmedBookings.reduce((sum, b) => sum + b.items.length, 0);

  return {
    event,
    summary: {
      totalRevenue,
      confirmedBookings: confirmedBookings.length,
      ticketsSold,
      checkedInBookings,
    },
    sectionBreakdown,
    recentBookings: bookings,
  };
}

export async function getAdminOverview() {
  await releaseExpiredLocks();

  const [organizers, events, bookings, webhookEvents, auditLogs, revenueAgg] =
    await Promise.all([
      User.find({ role: 'organizer' }).sort({ createdAt: -1 }),
      Event.find().populate('organizerId', 'name email organizationName').sort({ createdAt: -1 }),
      Booking.find()
        .populate('userId', 'name email')
        .populate('eventId', 'title venueName')
        .sort({ createdAt: -1 })
        .limit(40),
      PaymentWebhookEvent.find().sort({ processedAt: -1 }).limit(30),
      AuditLog.find().sort({ createdAt: -1 }).limit(40),
      Booking.aggregate([
        { $match: { status: 'confirmed' } },
        {
          $group: {
            _id: null,
            grossVolume: { $sum: '$totalAmount' },
            confirmedCount: { $sum: 1 },
          },
        },
      ]),
    ]);

  return {
    metrics: {
      grossVolume: revenueAgg[0]?.grossVolume || 0,
      confirmedBookings: revenueAgg[0]?.confirmedCount || 0,
      totalEvents: events.length,
      pendingApprovals:
        events.filter((e) => e.approvalStatus === 'pending').length +
        organizers.filter((o) => o.organizerStatus === 'pending').length,
    },
    organizers,
    events,
    bookings,
    webhookEvents,
    auditLogs,
  };
}

export async function moderateOrganizer(
  organizerId: string,
  status: 'approved' | 'suspended',
  adminId: string
) {
  const organizer = await User.findById(organizerId);
  if (!organizer || organizer.role !== 'organizer') {
    throw new NotFoundError('Organizer not found');
  }
  organizer.organizerStatus = status;
  await organizer.save();

  await AuditLog.create({
    actorId: new mongoose.Types.ObjectId(adminId),
    actorRole: 'admin',
    action: `organizer.${status}`,
    targetType: 'User',
    targetId: organizer._id.toString(),
    details: { email: organizer.email, organizationName: organizer.organizationName },
  });

  return organizer;
}

export async function moderateEvent(
  eventId: string,
  approvalStatus: 'approved' | 'rejected',
  adminId: string
) {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  event.approvalStatus = approvalStatus;
  if (approvalStatus === 'rejected') {
    event.status = 'cancelled';
  }
  await event.save();

  await AuditLog.create({
    actorId: new mongoose.Types.ObjectId(adminId),
    actorRole: 'admin',
    action: `event.${approvalStatus}`,
    targetType: 'Event',
    targetId: event._id.toString(),
    details: { title: event.title },
  });

  return event;
}
