import type { NextFunction, Request, Response } from 'express';
import * as eventService from '../services/eventService.ts';

export async function getOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    const overview = await eventService.getAdminOverview();
    res.status(200).json(overview);
  } catch (err) {
    next(err);
  }
}

export async function updateOrganizerStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizer = await eventService.moderateOrganizer(
      String(req.params.id),
      req.body.status,
      req.user!.sub
    );
    res.status(200).json({ organizer });
  } catch (err) {
    next(err);
  }
}

export async function updateEventModeration(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const event = await eventService.moderateEvent(
      String(req.params.id),
      req.body.approvalStatus,
      req.user!.sub
    );
    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
}
