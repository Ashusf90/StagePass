import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IPaymentWebhookEvent extends Document {
  _id: mongoose.Types.ObjectId;
  providerEventId: string;
  provider: string;
  eventType: string;
  bookingId?: mongoose.Types.ObjectId;
  paymentIntentId?: string;
  signatureVerified: boolean;
  status: 'processed' | 'failed';
  processedAt: Date;
  payloadSummary: Record<string, unknown>;
}

const PaymentWebhookEventSchema = new Schema<IPaymentWebhookEvent>(
  {
    providerEventId: { type: String, required: true, unique: true },
    provider: { type: String, default: 'sandbox_gateway', required: true },
    eventType: { type: String, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    paymentIntentId: { type: String },
    signatureVerified: { type: Boolean, required: true },
    status: { type: String, enum: ['processed', 'failed'], default: 'processed' },
    processedAt: { type: Date, default: Date.now, required: true },
    payloadSummary: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

PaymentWebhookEventSchema.index({ processedAt: -1 });

export const PaymentWebhookEvent: Model<IPaymentWebhookEvent> =
  mongoose.models.PaymentWebhookEvent ||
  mongoose.model<IPaymentWebhookEvent>('PaymentWebhookEvent', PaymentWebhookEventSchema);
