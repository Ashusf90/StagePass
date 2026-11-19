import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type SeatStatus = 'available' | 'locked' | 'booked';
export type SeatKind = 'seat' | 'tier';

export interface ISeat extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  kind: SeatKind;
  section: string;
  row?: string;
  seatNumber?: string;
  tierName?: string;
  price: number;
  status: SeatStatus;
  lockedByUserId: mongoose.Types.ObjectId | null;
  lockExpiresAt: Date | null;
  bookingId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SeatSchema = new Schema<ISeat>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    kind: { type: String, enum: ['seat', 'tier'], default: 'seat', required: true },
    section: { type: String, required: true, trim: true },
    row: { type: String, trim: true },
    seatNumber: { type: String, trim: true },
    tierName: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['available', 'locked', 'booked'],
      default: 'available',
      required: true,
    },
    lockedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lockExpiresAt: { type: Date, default: null },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
  },
  {
    timestamps: true,
  }
);

SeatSchema.index({ eventId: 1, status: 1, lockExpiresAt: 1 });
SeatSchema.index({ eventId: 1, section: 1, row: 1, seatNumber: 1 }, { unique: true });
SeatSchema.index({ bookingId: 1 });
SeatSchema.index({ status: 1, lockExpiresAt: 1 });

export const Seat: Model<ISeat> =
  mongoose.models.Seat || mongoose.model<ISeat>('Seat', SeatSchema);
