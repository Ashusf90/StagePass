import type { NextFunction, Request, Response } from 'express';
import * as ticketService from '../services/ticketService.ts';

export async function verifyTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ticketService.verifyAndCheckInTicket({
      qrToken: req.body.qrToken,
      eventId: req.body.eventId,
      staffUserId: req.user!.sub,
      staffRole: req.user!.role,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
