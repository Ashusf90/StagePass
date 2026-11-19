import bcrypt from 'bcryptjs';
import { AuditLog } from '../models/AuditLog.ts';
import { Booking } from '../models/Booking.ts';
import { Event } from '../models/Event.ts';
import { PaymentWebhookEvent } from '../models/PaymentWebhookEvent.ts';
import { Seat } from '../models/Seat.ts';
import { User } from '../models/User.ts';
import { generateSeatsForEvent } from '../services/eventService.ts';
import { signQrToken } from '../utils/crypto.ts';

export async function seedDatabaseIfEmpty(): Promise<void> {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    return;
  }

  console.log('[seed] Populating initial multi-vendor events, seats, users, and bookings...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [attendee, organizerApproved, organizerPending, admin] = await User.create([
    {
      name: 'Alex Rivera',
      email: 'alex@stagepass.io',
      passwordHash,
      role: 'attendee',
      organizerStatus: 'approved',
    },
    {
      name: 'Elena Vance',
      email: 'elena@luminaevents.com',
      passwordHash,
      role: 'organizer',
      organizerStatus: 'approved',
      organizationName: 'Lumina Acoustic Arts',
    },
    {
      name: 'Marcus Chen',
      email: 'marcus@horizonlive.io',
      passwordHash,
      role: 'organizer',
      organizerStatus: 'pending',
      organizationName: 'Horizon Live Productions',
    },
    {
      name: 'Nadia Sterling',
      email: 'admin@stagepass.io',
      passwordHash,
      role: 'admin',
      organizerStatus: 'approved',
    },
  ]);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const event1 = await Event.create({
    organizerId: organizerApproved._id,
    title: 'Nordic Chamber Symphony: Autumn Nocturne',
    subtitle: '42-piece string ensemble performing Arvo Pärt and Max Richter',
    description:
      'An acoustic evening inside the sculpted cedar auditorium. Featuring spatial string arrangements, solo cello concertos, and custom stage lighting calibrated for natural reverberation.',
    category: 'Concert',
    venueName: 'Walt Disney Concert Hall',
    address: '111 S Grand Ave',
    city: 'Los Angeles, CA',
    startDate: new Date(now + 5 * day),
    endDate: new Date(now + 5 * day + 3 * 60 * 60 * 1000),
    status: 'published',
    approvalStatus: 'approved',
    artworkTheme: 'symphony',
    seatMapConfig: {
      mode: 'seated',
      currency: 'USD',
      stageLabel: 'Acoustic Stage',
      sections: [
        {
          name: 'Orchestra Front',
          kind: 'seat',
          price: 145,
          rows: ['A', 'B', 'C'],
          seatsPerRow: 8,
        },
        {
          name: 'Terrace Balcony',
          kind: 'seat',
          price: 85,
          rows: ['D', 'E'],
          seatsPerRow: 8,
        },
      ],
    },
    promoCodes: [
      { code: 'EARLY20', discountPercent: 20, maxUses: 100, usedCount: 1, active: true },
      { code: 'MEMBER10', discountPercent: 10, maxUses: 50, usedCount: 0, active: true },
    ],
    cancellationWindowHours: 24,
  });

  const event2 = await Event.create({
    organizerId: organizerApproved._id,
    title: 'Solstice Electronic Amphitheater',
    subtitle: 'Architectural live modular sets at twilight',
    description:
      'Open-air sunset gathering combining live analog synthesizers, quadraphonic sound projection, and tiered sandstone seating overlooking the canyon ridge.',
    category: 'Festival',
    venueName: 'Red Rocks Amphitheatre',
    address: '18300 W Alameda Pkwy',
    city: 'Morrison, CO',
    startDate: new Date(now + 12 * day),
    endDate: new Date(now + 12 * day + 5 * 60 * 60 * 1000),
    status: 'published',
    approvalStatus: 'approved',
    artworkTheme: 'amphitheater',
    seatMapConfig: {
      mode: 'hybrid',
      currency: 'USD',
      stageLabel: 'Main Amphitheater Stage',
      sections: [
        {
          name: 'VIP Soundboard Deck',
          kind: 'seat',
          price: 190,
          rows: ['V1', 'V2'],
          seatsPerRow: 6,
        },
        {
          name: 'General Admission Bowl',
          kind: 'tier',
          price: 75,
          capacity: 45,
        },
        {
          name: 'Backstage Lounge Pass',
          kind: 'tier',
          price: 260,
          capacity: 15,
        },
      ],
    },
    promoCodes: [
      { code: 'SOLSTICE15', discountPercent: 15, maxUses: 60, usedCount: 0, active: true },
    ],
    cancellationWindowHours: 48,
  });

  const event3 = await Event.create({
    organizerId: organizerApproved._id,
    title: 'Distributed Systems & Architecture Summit',
    subtitle: 'Two-day engineering symposium on consensus, storage, and resilience',
    description:
      'Deep-dive technical talks from principal engineers building high-throughput databases, payment ledgers, and deterministic state machines.',
    category: 'Conference',
    venueName: 'Moscone West Pavilion',
    address: '800 Howard St',
    city: 'San Francisco, CA',
    startDate: new Date(now + 21 * day),
    endDate: new Date(now + 22 * day),
    status: 'published',
    approvalStatus: 'approved',
    artworkTheme: 'summit',
    seatMapConfig: {
      mode: 'tiered',
      currency: 'USD',
      stageLabel: 'Keynote Auditorium',
      sections: [
        {
          name: 'Full Conference Pass',
          kind: 'tier',
          price: 320,
          capacity: 60,
        },
        {
          name: 'Workshop + Keynotes',
          kind: 'tier',
          price: 480,
          capacity: 24,
        },
      ],
    },
    promoCodes: [
      { code: 'EARLY20', discountPercent: 20, maxUses: 40, usedCount: 0, active: true },
    ],
    cancellationWindowHours: 72,
  });

  const event4 = await Event.create({
    organizerId: organizerPending._id,
    title: 'The Glass Menagerie — Studio Staging',
    subtitle: 'Intimate in-the-round dramatic revival',
    description:
      'A stark, stripped-back theatrical staging surrounded on three sides by tiered studio seating.',
    category: 'Theater',
    venueName: 'Steppenwolf Studio',
    address: '1650 N Halsted St',
    city: 'Chicago, IL',
    startDate: new Date(now + 9 * day),
    endDate: new Date(now + 9 * day + 2.5 * 60 * 60 * 1000),
    status: 'published',
    approvalStatus: 'pending',
    artworkTheme: 'theater',
    seatMapConfig: {
      mode: 'seated',
      currency: 'USD',
      stageLabel: 'In-The-Round Stage',
      sections: [
        {
          name: 'Stage Ring',
          kind: 'seat',
          price: 95,
          rows: ['A', 'B'],
          seatsPerRow: 8,
        },
        {
          name: 'Upper Gallery',
          kind: 'seat',
          price: 58,
          rows: ['C', 'D'],
          seatsPerRow: 8,
        },
      ],
    },
    promoCodes: [],
    cancellationWindowHours: 24,
  });

  await Promise.all([
    generateSeatsForEvent(event1._id, event1.seatMapConfig.sections),
    generateSeatsForEvent(event2._id, event2.seatMapConfig.sections),
    generateSeatsForEvent(event3._id, event3.seatMapConfig.sections),
    generateSeatsForEvent(event4._id, event4.seatMapConfig.sections),
  ]);

  // Create a confirmed booking for Alex on Event 1 (seats A-4, A-5)
  const sampleSeats = await Seat.find({
    eventId: event1._id,
    section: 'Orchestra Front',
    row: 'A',
    seatNumber: { $in: ['4', '5'] },
  });

  if (sampleSeats.length === 2) {
    const booking1Id = await Booking.create({
      bookingReference: 'SP-8492KL',
      userId: attendee._id,
      eventId: event1._id,
      items: sampleSeats.map((s) => ({
        seatId: s._id,
        section: s.section,
        row: s.row,
        seatNumber: s.seatNumber,
        unitPrice: s.price,
      })),
      subtotalAmount: 290,
      discountAmount: 58,
      promoCode: 'EARLY20',
      totalAmount: 232,
      currency: 'USD',
      status: 'confirmed',
      idempotencyKey: 'seed-booking-1',
      paymentIntentId: 'pi_sp_seed_90421',
      lockExpiresAt: null,
    });

    const qrToken = signQrToken({
      bookingId: booking1Id._id.toString(),
      eventId: event1._id.toString(),
      userId: attendee._id.toString(),
      ticketCode: 'TKT-SP-8492KL-A1',
    });

    booking1Id.qrCodeToken = qrToken;
    await booking1Id.save();

    await Seat.updateMany(
      { _id: { $in: sampleSeats.map((s) => s._id) } },
      {
        $set: {
          status: 'booked',
          lockedByUserId: attendee._id,
          bookingId: booking1Id._id,
          lockExpiresAt: null,
        },
      }
    );

    await PaymentWebhookEvent.create({
      providerEventId: 'evt_sp_seed_1001',
      provider: 'sandbox_gateway',
      eventType: 'payment_intent.succeeded',
      bookingId: booking1Id._id,
      paymentIntentId: 'pi_sp_seed_90421',
      signatureVerified: true,
      status: 'processed',
      processedAt: new Date(now - 3600 * 1000),
      payloadSummary: {
        amount: 232,
        currency: 'USD',
        bookingReference: 'SP-8492KL',
      },
    });
  }

  // Mark 2 additional seats in Event 1 Row B as booked by another patron for realistic map occupancy
  const otherSeats = await Seat.find({
    eventId: event1._id,
    section: 'Orchestra Front',
    row: 'B',
    seatNumber: { $in: ['3', '4', '5'] },
  });
  if (otherSeats.length > 0) {
    await Seat.updateMany(
      { _id: { $in: otherSeats.map((s) => s._id) } },
      { $set: { status: 'booked' } }
    );
  }

  await AuditLog.create([
    {
      actorId: admin._id,
      actorEmail: admin.email,
      actorRole: 'admin',
      action: 'platform.seeded',
      targetType: 'System',
      details: { eventsSeeded: 4, usersSeeded: 4 },
    },
    {
      actorId: attendee._id,
      actorEmail: attendee.email,
      actorRole: 'system_webhook',
      action: 'booking.confirmed',
      targetType: 'Booking',
      details: { bookingReference: 'SP-8492KL', totalAmount: 232 },
    },
  ]);

  console.log('[seed] Database seeding completed');
}
