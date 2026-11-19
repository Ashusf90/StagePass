import type { NextFunction, Request, Response } from 'express';
import * as authService from '../services/authService.ts';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.registerUser(req.body);
    res.cookie('sp_refresh_token', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginUser(req.body);
    res.cookie('sp_refresh_token', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.body?.refreshToken || req.cookies?.sp_refresh_token;
    const result = await authService.refreshAuthTokens(token);
    res.cookie('sp_refresh_token', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.body?.refreshToken || req.cookies?.sp_refresh_token;
    if (req.user) {
      await authService.logoutUser(req.user.sub, token);
    }
    res.clearCookie('sp_refresh_token');
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUserProfile(req.user!.sub);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
