import bcrypt from 'bcryptjs';
import { User, type IUser } from '../models/User.ts';
import { AuditLog } from '../models/AuditLog.ts';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type UserRole,
} from '../utils/crypto.ts';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../utils/errors.ts';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    organizerStatus: string;
    organizationName?: string;
  };
}

function formatUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    organizerStatus: user.organizerStatus,
    organizationName: user.organizationName,
  };
}

async function issueTokensForUser(user: IUser): Promise<AuthTokensResponse> {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const { token: refreshToken, jti, expiresAt } = signRefreshToken(
    user._id.toString()
  );

  // Keep up to 5 active refresh tokens per user
  const activeTokens = (user.refreshTokens || [])
    .filter((t) => t.expiresAt > new Date())
    .slice(-4);

  activeTokens.push({
    tokenHash: hashToken(refreshToken),
    jti,
    expiresAt,
    createdAt: new Date(),
  });

  user.refreshTokens = activeTokens;
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: formatUser(user),
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  role?: 'attendee' | 'organizer';
  organizationName?: string;
}): Promise<AuthTokensResponse> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ConflictError('An account with this email already exists', 'EMAIL_IN_USE');
  }

  const role: UserRole = input.role === 'organizer' ? 'organizer' : 'attendee';
  const passwordHash = await bcrypt.hash(input.password, 10);

  if (role === 'organizer' && !input.organizationName?.trim()) {
    throw new BadRequestError('Organization name is required for organizer accounts');
  }

  const user = await User.create({
    name: input.name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    organizerStatus: role === 'organizer' ? 'pending' : 'approved',
    organizationName: input.organizationName?.trim(),
  });

  await AuditLog.create({
    actorId: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'user.registered',
    targetType: 'User',
    targetId: user._id.toString(),
    details: { role: user.role, organizerStatus: user.organizerStatus },
  });

  return issueTokensForUser(user);
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthTokensResponse> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordHash +refreshTokens'
  );

  if (!user) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.role === 'organizer' && user.organizerStatus === 'suspended') {
    throw new ForbiddenError(
      'This organizer account has been suspended by an administrator.'
    );
  }

  return issueTokensForUser(user);
}

export async function refreshAuthTokens(refreshToken: string): Promise<AuthTokensResponse> {
  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token is required');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token', 'REFRESH_EXPIRED');
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user) {
    throw new UnauthorizedError('Account not found');
  }

  const tokenHash = hashToken(refreshToken);
  const matchingIndex = (user.refreshTokens || []).findIndex(
    (entry) =>
      entry.tokenHash === tokenHash &&
      entry.jti === payload.jti &&
      entry.expiresAt > new Date()
  );

  if (matchingIndex === -1) {
    // Possible token reuse: revoke all refresh tokens for safety
    user.refreshTokens = [];
    await user.save();
    throw new UnauthorizedError('Refresh token revoked or reused', 'TOKEN_REVOKED');
  }

  // Rotate token: remove the used token before issuing a fresh pair
  user.refreshTokens.splice(matchingIndex, 1);
  return issueTokensForUser(user);
}

export async function logoutUser(userId: string, refreshToken?: string): Promise<void> {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;

  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    user.refreshTokens = (user.refreshTokens || []).filter(
      (entry) => entry.tokenHash !== tokenHash
    );
  } else {
    user.refreshTokens = [];
  }
  await user.save();
}

export async function getUserProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  return formatUser(user);
}
