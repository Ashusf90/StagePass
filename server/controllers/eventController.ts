import type { NextFunction, Request, Response } from 'express';
import * as eventService from '../services/eventService.ts';

export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, category, date } = req.query as {
      search?: string;
      category?: string;
      date?: 'upcoming' | 'this_week' | 'this_month' | 'all';
    };
    const events = await eventService.listPublicEvents({
      search,
      category,
      dateFilter: date || 'upcoming',
    });
    res.status(200).json({ events });
  } catch (err) {
    next(err);
  }
}

export async function getEventDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await eventService.getEventWithSeats(
      String(req.params.id),
      req.user?.sub
    );
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await eventService.createOrganizerEvent(req.user!.sub, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await eventService.updateOrganizerEvent(
      String(req.params.id),
      req.user!.sub,
      req.user!.role,
      req.body
    );
    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
}

export async function listOrganizerEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await eventService.getOrganizerEvents(req.user!.sub);
    res.status(200).json({ events });
  } catch (err) {
    next(err);
  }
}

export async function getEventAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const analytics = await eventService.getEventAnalytics(
      String(req.params.id),
      req.user!.sub,
      req.user!.role
    );
    res.status(200).json(analytics);
  } catch (err) {
    next(err);
  }
}
