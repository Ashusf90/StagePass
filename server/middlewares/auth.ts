import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AccessTokenPayload, type UserRole } from '../utils/crypto.ts';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(new UnauthorizedError('Missing or malformed Authorization Bearer token'));
    return;
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Access token expired or invalid', 'TOKEN_EXPIRED'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    req.user = verifyAccessToken(token);
  } catch {
    req.user = undefined;
  }
  next();
}

export function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Role '${req.user.role}' is not permitted to perform this action`
        )
      );
      return;
    }
    next();
  };
}
