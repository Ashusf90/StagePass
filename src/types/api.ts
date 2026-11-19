export type UserRole = 'attendee' | 'organizer' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizerStatus: 'pending' | 'approved' | 'suspended';
  organizationName?: string;
}

export interface SectionConfig {
  name: string;
  kind: 'seat' | 'tier';
  price: number;
  rows?: string[];
  seatsPerRow?: number;
  capacity?: number;
}

export interface EventItem {
  _id: string;
  organizerId: {
    _id: string;
    name: string;
    organizationName?: string;
  };
  title: string;
  subtitle?: string;
  description: string;
  category: 'Concert' | 'Theater' | 'Conference' | 'Festival' | 'Sports';
  venueName: string;
  address: string;
  city: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published' | 'cancelled';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  artworkTheme: 'symphony' | 'amphitheater' | 'summit' | 'theater';
  seatMapConfig: {
    mode: 'seated' | 'tiered' | 'hybrid';
    currency: string;
    stageLabel: string;
    sections: SectionConfig[];
  };
  promoCodes?: Array<{ code: string; discountPercent: number }>;
  cancellationWindowHours: number;
  availability?: {
    totalSeats: number;
    availableSeats: number;
    minPrice: number;
    maxPrice: number;
  };
  metrics?: {
    total: number;
    booked: number;
    locked: number;
    available: number;
    revenue: number;
    confirmedBookings: number;
    checkedInCount: number;
  };
}

export interface SeatItem {
  _id: string;
  kind: 'seat' | 'tier';
  section: string;
  row?: string;
  seatNumber?: string;
  tierName?: string;
  price: number;
  status: 'available' | 'locked' | 'booked';
  lockExpiresAt: string | null;
  isLockedByMe: boolean;
}

export interface TierSummary {
  section: string;
  price: number;
  total: number;
  available: number;
  locked: number;
  booked: number;
}

export interface BookingItem {
  seatId: string;
  section: string;
  row?: string;
  seatNumber?: string;
  tierName?: string;
  unitPrice: number;
}

export interface BookingRecord {
  _id: string;
  bookingReference: string;
  userId: string | { _id: string; name: string; email: string };
  eventId: string | Partial<EventItem>;
  items: BookingItem[];
  subtotalAmount: number;
  discountAmount: number;
  promoCode?: string;
  totalAmount: number;
  currency: string;
  status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  paymentIntentId?: string;
  lockExpiresAt: string | null;
  qrCodeToken?: string;
  checkedInAt: string | null;
  refundReason?: string;
  refundedAt?: string;
  createdAt: string;
}

export interface WebhookEventLog {
  _id: string;
  providerEventId: string;
  provider: string;
  eventType: string;
  bookingId?: string;
  paymentIntentId?: string;
  signatureVerified: boolean;
  status: string;
  processedAt: string;
  payloadSummary: Record<string, unknown>;
}

export interface AuditLogEntry {
  _id: string;
  actorEmail?: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}
