import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { TurnService } from '../../application/TurnService';
import { VenueNotFoundError } from '../../domain/errors';
import type { VenueRepository } from '../../domain/ports';

const TurnBody = z.object({
  sessionId: z.string().min(8).max(64),
  venueCode: z.string().min(3).max(40),
  text: z.string().max(1000),
  sttConfidence: z.number().min(0).max(1).optional(),
});

export interface AppDeps {
  turnService: TurnService;
  venues: VenueRepository;
  corsOrigin?: string | string[];
}

/** HTTP adapter: translates requests into application calls. No business rules here. */
export function createApp({ turnService, venues, corsOrigin }: AppDeps) {
  const app = express();
  app.use(cors({ origin: corsOrigin ?? true }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/venues/:code', async (req, res) => {
    const venue = await venues.findByCode(req.params.code);
    if (!venue) {
      res.status(404).json({ error: 'venue_not_found' });
      return;
    }
    const { code, type, name, location, tollFree, staffCounter, tasks } = venue;
    res.json({ code, type, name, location, tollFree, staffCounter, tasks });
  });

  app.post('/api/turn', async (req, res) => {
    const body = TurnBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid_request', details: body.error.issues });
      return;
    }
    res.json(await turnService.handle(body.data));
  });

  app.delete('/api/sessions/:id', (req, res) => {
    turnService.endSession(req.params.id);
    res.status(204).end();
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof VenueNotFoundError) {
      res.status(404).json({ error: 'venue_not_found' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
