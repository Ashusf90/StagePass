import crypto from 'node:crypto';
import { signWebhookPayload, verifyWebhookSignature } from '../utils/crypto.ts';

export interface CreatePaymentIntentInput {
  bookingId: string;
  bookingReference: string;
  amount: number;
  currency: string;
  customerEmail: string;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  provider: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'succeeded';
}

export interface PaymentWebhookPayload {
  providerEventId: string;
  eventType: 'payment_intent.succeeded' | 'payment_intent.failed';
  provider: string;
  data: {
    paymentIntentId: string;
    bookingId: string;
    amount: number;
    currency: string;
  };
  createdAt: string;
}

export interface PaymentGateway {
  readonly providerName: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  buildSignedWebhook(input: {
    paymentIntentId: string;
    bookingId: string;
    amount: number;
    currency: string;
    providerEventId?: string;
    eventType?: 'payment_intent.succeeded' | 'payment_intent.failed';
  }): { rawBody: string; signature: string; payload: PaymentWebhookPayload };
  verifySignature(rawBody: string, signatureHeader: string): boolean;
}

class SandboxPaymentGateway implements PaymentGateway {
  public readonly providerName = 'sandbox_gateway';

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const suffix = crypto.randomBytes(8).toString('hex');
    const paymentIntentId = `pi_sp_${suffix}`;
    const clientSecret = `cs_sp_${crypto.randomBytes(12).toString('hex')}`;

    return {
      paymentIntentId,
      provider: this.providerName,
      clientSecret,
      amount: input.amount,
      currency: input.currency,
      status: 'requires_payment_method',
    };
  }

  buildSignedWebhook(input: {
    paymentIntentId: string;
    bookingId: string;
    amount: number;
    currency: string;
    providerEventId?: string;
    eventType?: 'payment_intent.succeeded' | 'payment_intent.failed';
  }) {
    const payload: PaymentWebhookPayload = {
      providerEventId:
        input.providerEventId || `evt_sp_${crypto.randomBytes(8).toString('hex')}`,
      eventType: input.eventType || 'payment_intent.succeeded',
      provider: this.providerName,
      data: {
        paymentIntentId: input.paymentIntentId,
        bookingId: input.bookingId,
        amount: input.amount,
        currency: input.currency,
      },
      createdAt: new Date().toISOString(),
    };

    const rawBody = JSON.stringify(payload);
    const signature = signWebhookPayload(rawBody);
    return { rawBody, signature, payload };
  }

  verifySignature(rawBody: string, signatureHeader: string): boolean {
    return verifyWebhookSignature(rawBody, signatureHeader);
  }
}

export const paymentGateway: PaymentGateway = new SandboxPaymentGateway();
