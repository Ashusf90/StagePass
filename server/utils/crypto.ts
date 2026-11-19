import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';

export type UserRole = 'attendee' | 'organizer' | 'admin';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export interface QrTicketPayload {
  bookingId: string;
  eventId: string;
  userId: string;
  ticketCode: string;
  jti: string;
  type: 'ticket_qr';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
  if (decoded.type !== 'access') {
    throw new Error('Invalid access token type');
  }
  return decoded;
}

export function signRefreshToken(userId: string): { token: string; jti: string; expiresAt: Date } {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: userId, jti, type: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.refreshTokenTtl }
  );
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { token, jti, expiresAt };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  return decoded;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signQrToken(payload: Omit<QrTicketPayload, 'jti' | 'type'>): string {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { ...payload, jti, type: 'ticket_qr' },
    env.qrSigningSecret,
    { expiresIn: '365d' }
  );
}

export function verifyQrToken(token: string): QrTicketPayload {
  const decoded = jwt.verify(token, env.qrSigningSecret) as QrTicketPayload;
  if (decoded.type !== 'ticket_qr') {
    throw new Error('Invalid QR ticket token');
  }
  return decoded;
}

export function signWebhookPayload(rawPayload: string): string {
  return crypto
    .createHmac('sha256', env.paymentWebhookSecret)
    .update(rawPayload)
    .digest('hex');
}

export function verifyWebhookSignature(rawPayload: string, signatureHeader: string): boolean {
  if (!signatureHeader) return false;
  const expected = signWebhookPayload(rawPayload);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signatureHeader.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
