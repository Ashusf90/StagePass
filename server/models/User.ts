import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { UserRole } from '../utils/crypto.ts';

export type OrganizerStatus = 'pending' | 'approved' | 'suspended';

export interface IRefreshTokenEntry {
  tokenHash: string;
  jti: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organizerStatus: OrganizerStatus;
  organizationName?: string;
  refreshTokens: IRefreshTokenEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshTokenEntry>(
  {
    tokenHash: { type: String, required: true },
    jti: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['attendee', 'organizer', 'admin'],
      default: 'attendee',
      required: true,
    },
    organizerStatus: {
      type: String,
      enum: ['pending', 'approved', 'suspended'],
      default: 'approved',
    },
    organizationName: { type: String, trim: true, maxlength: 100 },
    refreshTokens: { type: [RefreshTokenSchema], default: [], select: false },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ role: 1, organizerStatus: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
