import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type EventStatus = 'draft' | 'published' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type EventCategory = 'Concert' | 'Theater' | 'Conference' | 'Festival' | 'Sports';
export type SeatMapMode = 'seated' | 'tiered' | 'hybrid';

export interface ISectionConfig {
  name: string;
  kind: 'seat' | 'tier';
  price: number;
  rows?: string[];
  seatsPerRow?: number;
  capacity?: number;
  colorToken?: string;
}

export interface IPromoCode {
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: Date;
  active: boolean;
}

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  organizerId: mongoose.Types.ObjectId;
  title: string;
  subtitle?: string;
  description: string;
  category: EventCategory;
  venueName: string;
  address: string;
  city: string;
  startDate: Date;
  endDate: Date;
  status: EventStatus;
  approvalStatus: ApprovalStatus;
  artworkTheme: 'symphony' | 'amphitheater' | 'summit' | 'theater';
  seatMapConfig: {
    mode: SeatMapMode;
    currency: string;
    stageLabel: string;
    sections: ISectionConfig[];
  };
  promoCodes: IPromoCode[];
  cancellationWindowHours: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionConfigSchema = new Schema<ISectionConfig>(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['seat', 'tier'], required: true },
    price: { type: Number, required: true, min: 0 },
    rows: { type: [String], default: [] },
    seatsPerRow: { type: Number, min: 1, max: 30 },
    capacity: { type: Number, min: 1, max: 5000 },
    colorToken: { type: String },
  },
  { _id: false }
);

const PromoCodeSchema = new Schema<IPromoCode>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, min: 1, max: 90 },
    maxUses: { type: Number, required: true, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    subtitle: { type: String, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    category: {
      type: String,
      enum: ['Concert', 'Theater', 'Conference', 'Festival', 'Sports'],
      required: true,
    },
    venueName: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, required: true, trim: true, maxlength: 220 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled'],
      default: 'published',
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      required: true,
    },
    artworkTheme: {
      type: String,
      enum: ['symphony', 'amphitheater', 'summit', 'theater'],
      default: 'symphony',
    },
    seatMapConfig: {
      mode: { type: String, enum: ['seated', 'tiered', 'hybrid'], required: true },
      currency: { type: String, default: 'USD', uppercase: true },
      stageLabel: { type: String, default: 'Main Stage' },
      sections: { type: [SectionConfigSchema], required: true },
    },
    promoCodes: { type: [PromoCodeSchema], default: [] },
    cancellationWindowHours: { type: Number, default: 24, min: 0 },
  },
  {
    timestamps: true,
  }
);

EventSchema.index({ status: 1, approvalStatus: 1, startDate: 1 });
EventSchema.index({ organizerId: 1, createdAt: -1 });
EventSchema.index({ category: 1, startDate: 1 });
EventSchema.index({ title: 'text', venueName: 'text', city: 'text', description: 'text' });

export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);
