import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { DocumentService } from '../../application/DocumentService';
import type { TurnService } from '../../application/TurnService';
import { VenueNotFoundError } from '../../domain/errors';
import type { VenueRepository } from '../../domain/ports';

const Language = z.enum(['hi', 'kn', 'en']);
const SessionId = z.string().min(8).max(64);
const VenueCode = z.string().min(3).max(40);

const TurnBody = z.object({
  sessionId: SessionId,
  venueCode: VenueCode,
  text: z.string().max(1000),
  sttConfidence: z.number().min(0).max(1).optional(),
  preferredLanguage: Language.optional(),
});

/** Claude accepts images up to 5 MB; base64 is ~4/3 of that. The client downsizes first. */
const MAX_IMAGE_BASE64 = 6_800_000;

const DocumentBody = z.object({
  sessionId: SessionId,
  venueCode: VenueCode,
  image: z.object({
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    base64: z
      .string()
      .min(100)
      .max(MAX_IMAGE_BASE64)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be plain base64 (no data: prefix)'),
  }),
  preferredLanguage: Language.optional(),
});

export interface AppDeps {
  turnService: TurnService;
  documentService: DocumentService;
  venues: VenueRepository;
  corsOrigin?: string | string[];
  llmProvider?: string;
  /** Called when someone opens a help page, so a local model is loaded before they speak. */
  warmUp?: () => void;
}

/** HTTP adapter: translates requests into application calls. No business rules here. */
export function createApp({ turnService, documentService, venues, corsOrigin, llmProvider, warmUp }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin ?? true }));

  const smallJson = express.json({ limit: '16kb' });
  const imageJson = express.json({ limit: '7mb' });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, llm: llmProvider ?? 'unknown' });
  });

  app.get('/api/venues/:code', async (req, res) => {
    const venue = await venues.findByCode(req.params.code);
    if (!venue) {
      res.status(404).json({ error: 'venue_not_found' });
      return;
    }
    warmUp?.();
    const { code, type, name, location, tollFree, staffCounter, tasks } = venue;
    res.json({ code, type, name, location, tollFree, staffCounter, tasks });
  });

  app.post('/api/turn', smallJson, async (req, res) => {
    const body = TurnBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid_request', details: body.error.issues });
      return;
    }
    res.json(await turnService.handle(body.data));
  });

  app.post('/api/document', imageJson, async (req, res) => {
    const body = DocumentBody.safeParse(req.body);
    if (!body.success) {
      // Never echo the image back in error details.
      res.status(400).json({ error: 'invalid_request', details: body.error.issues.map(({ path, message }) => ({ path, message })) });
      return;
    }
    res.json(await documentService.read(body.data));
  });

  app.delete('/api/sessions/:id', (req, res) => {
    turnService.endSession(req.params.id);
    res.status(204).end();
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof VenueNotFoundError) {
      res.status(404).json({ error: 'venue_not_found' });
      return;
    }
    // body-parser errors: malformed JSON (400), too large (413), wrong charset (415).
    const status = (err as { status?: unknown })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      const type = (err as { type?: string }).type;
      const code = type === 'entity.parse.failed' ? 'invalid_json' : type === 'entity.too.large' ? 'payload_too_large' : 'bad_request';
      res.status(status).json({ error: code });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
