import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'expired'
  | 'cancelled'
  | 'refunded';

export interface IBookingItem {
  seatId: mongoose.Types.ObjectId;
  section: string;
  row?: string;
  seatNumber?: string;
  tierName?: string;
  unitPrice: number;
}

export interface IBooking extends Document {
  _id: mongoose.Types.ObjectId;
  bookingReference: string;
  userId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  items: IBookingItem[];
  subtotalAmount: number;
  discountAmount: number;
  promoCode?: string;
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  idempotencyKey?: string;
  paymentIntentId?: string;
  lockExpiresAt: Date | null;
  qrCodeToken?: string;
  checkedInAt: Date | null;
  checkedInBy: mongoose.Types.ObjectId | null;
  refundReason?: string;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingItemSchema = new Schema<IBookingItem>(
  {
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
    section: { type: String, required: true },
    row: { type: String },
    seatNumber: { type: String },
    tierName: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const BookingSchema = new Schema<IBooking>(
  {
    bookingReference: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    items: { type: [BookingItemSchema], required: true },
    subtotalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    promoCode: { type: String, uppercase: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'expired', 'cancelled', 'refunded'],
      default: 'pending_payment',
      required: true,
    },
    idempotencyKey: { type: String, sparse: true, unique: true },
    paymentIntentId: { type: String },
    lockExpiresAt: { type: Date, default: null },
    qrCodeToken: { type: String },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    refundReason: { type: String },
    refundedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ eventId: 1, status: 1 });
BookingSchema.index({ status: 1, lockExpiresAt: 1 });
BookingSchema.index({ paymentIntentId: 1 });

export const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
