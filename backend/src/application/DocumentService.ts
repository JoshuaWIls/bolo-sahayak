import { VenueNotFoundError } from '../domain/errors';
import type {
  DocumentReader,
  GuardrailContext,
  OutputGuardrail,
  SessionStore,
  TextMasker,
  VenueRepository,
} from '../domain/ports';
import { createSession, type Session } from '../domain/session';
import type { AgentReply, DocumentRequest, ReplySource, TurnResult } from '../domain/types';
import { phrase } from './messages';
import { parseAgentReply } from './replySchema';
import { enrich } from './TurnService';

export interface DocumentServiceDeps {
  venues: VenueRepository;
  sessions: SessionStore;
  masker: TextMasker;
  reader: DocumentReader;
  outputGuardrails: OutputGuardrail[];
  maxAttempts?: number;
}

/** What the conversation history records instead of the photo itself. */
export const PHOTO_PLACEHOLDER = '[PHOTO]';

/**
 * "Show form": explains a photographed form, slip or notice board.
 * The image is passed straight to the reader and never stored. Anything the
 * reader copies off the paper (account, Aadhaar, phone numbers) is masked
 * before it reaches the screen or the session history.
 */
export class DocumentService {
  private readonly maxAttempts: number;

  constructor(private readonly deps: DocumentServiceDeps) {
    this.maxAttempts = deps.maxAttempts ?? 2;
  }

  async read(request: DocumentRequest): Promise<TurnResult> {
    const venue = await this.deps.venues.findByCode(request.venueCode);
    if (!venue) throw new VenueNotFoundError(request.venueCode);

    const session = this.loadSession(request.sessionId, venue.code);
    if (request.preferredLanguage && request.preferredLanguage !== session.language) {
      session.language = request.preferredLanguage;
      session.script = request.preferredLanguage === 'en' ? 'latin' : 'native';
      session.pendingLanguage = undefined;
    }

    const ctx: GuardrailContext = { venue, language: session.language, script: session.script, text: '' };
    let reply: AgentReply | null = null;
    for (let attempt = 1; attempt <= this.maxAttempts && !reply; attempt++) {
      try {
        reply = parseAgentReply(
          await this.deps.reader.read({
            venue,
            language: session.language,
            script: session.script,
            image: request.image,
          }),
        );
      } catch {
        // Provider error or refusal: treated like an unreadable photo.
      }
    }

    let source: ReplySource = 'llm';
    if (!reply) {
      source = 'fallback';
      reply = {
        lang: session.language,
        action: 'camera',
        ...phrase('unreadablePhoto', session.language, session.script),
      };
    } else {
      reply = this.maskReply(reply);
      reply = enrich(
        this.deps.outputGuardrails.reduce((r, g) => g.filter(r, ctx), reply),
        venue,
      );
    }

    session.history.push({ role: 'user', text: PHOTO_PLACEHOLDER }, { role: 'agent', text: reply.reply });
    session.history = session.history.slice(-12);
    this.deps.sessions.save(session);
    return { reply, source, sessionLanguage: session.language, maskedText: PHOTO_PLACEHOLDER };
  }

  private maskReply(reply: AgentReply): AgentReply {
    return {
      ...reply,
      reply: this.deps.masker.mask(reply.reply).masked,
      replyEnglish: this.deps.masker.mask(reply.replyEnglish).masked,
    };
  }

  private loadSession(id: string, venueCode: string): Session {
    const existing = this.deps.sessions.get(id);
    if (existing && existing.venueCode === venueCode) return existing;
    return createSession(id, venueCode);
  }
}
