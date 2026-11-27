import { VenueNotFoundError } from '../domain/errors';
import type {
  GuardrailContext,
  InputGuardrail,
  LanguageDetector,
  LanguageModel,
  OutputGuardrail,
  SessionStore,
  TextMasker,
  VenueRepository,
} from '../domain/ports';
import { createSession, type Session } from '../domain/session';
import type { AgentReply, ReplySource, TurnRequest, TurnResult, Venue } from '../domain/types';
import type { IntentHintExtractor } from './IntentHintExtractor';
import { phrase } from './messages';
import type { ClarificationPolicy } from './policies/ClarificationPolicy';
import type { LanguagePolicy } from './policies/LanguagePolicy';
import { parseAgentReply } from './replySchema';

export interface TurnServiceDeps {
  venues: VenueRepository;
  sessions: SessionStore;
  masker: TextMasker;
  detector: LanguageDetector;
  languagePolicy: LanguagePolicy;
  clarificationPolicy: ClarificationPolicy;
  intentHints: IntentHintExtractor;
  inputGuardrails: InputGuardrail[];
  outputGuardrails: OutputGuardrail[];
  model: LanguageModel;
  /** Model attempts per turn before falling back to a staff hand-off. */
  maxModelAttempts?: number;
  historyLimit?: number;
}

/**
 * Orchestrates one conversational turn. It only coordinates collaborators;
 * every rule lives in its own class (Single Responsibility), and new
 * guardrails are added by registration, not by editing this class
 * (Open/Closed).
 */
export class TurnService {
  private readonly maxModelAttempts: number;
  private readonly historyLimit: number;

  constructor(private readonly deps: TurnServiceDeps) {
    this.maxModelAttempts = deps.maxModelAttempts ?? 2;
    this.historyLimit = deps.historyLimit ?? 6;
  }

  async handle(request: TurnRequest): Promise<TurnResult> {
    const venue = await this.deps.venues.findByCode(request.venueCode);
    if (!venue) throw new VenueNotFoundError(request.venueCode);

    const session = this.loadSession(request.sessionId, venue.code);
    const { masked } = this.deps.masker.mask(request.text);

    this.deps.languagePolicy.apply(session, this.deps.detector.detect(masked));

    const { reply, source } = await this.decide(session, venue, masked, request.sttConfidence);

    this.record(session, masked, reply);
    return { reply, source, sessionLanguage: session.language, maskedText: masked };
  }

  endSession(sessionId: string): boolean {
    return this.deps.sessions.delete(sessionId);
  }

  private async decide(
    session: Session,
    venue: Venue,
    text: string,
    confidence?: number,
  ): Promise<{ reply: AgentReply; source: ReplySource }> {
    const guardCtx: GuardrailContext = { venue, language: session.language, text };

    // Safety first: an emergency or an OTP mention must win even if audio was unclear.
    for (const guard of this.deps.inputGuardrails) {
      const reply = guard.check(guardCtx);
      if (reply) return { reply, source: 'guardrail' };
    }

    const clarification = this.deps.clarificationPolicy.evaluate(session, venue, text, confidence);
    if (clarification) return { reply: clarification, source: 'policy' };

    const modelReply = await this.askModel(session, venue, text);
    if (!modelReply) return { reply: this.handoffReply(session, venue), source: 'fallback' };

    const safe = this.deps.outputGuardrails.reduce((r, g) => g.filter(r, guardCtx), modelReply);
    return { reply: this.enrich(safe, venue), source: 'llm' };
  }

  private async askModel(session: Session, venue: Venue, text: string): Promise<AgentReply | null> {
    const context = {
      venue,
      language: session.language,
      script: session.script,
      history: session.history.slice(-this.historyLimit),
      userText: text,
      intentHints: this.deps.intentHints.extract(text, venue),
    };

    for (let attempt = 1; attempt <= this.maxModelAttempts; attempt++) {
      try {
        const parsed = parseAgentReply(await this.deps.model.generate(context));
        if (parsed) return parsed;
      } catch {
        // Provider error or refusal: treated like an invalid reply.
      }
    }
    return null;
  }

  private handoffReply(session: Session, venue: Venue): AgentReply {
    return {
      lang: session.language,
      action: 'handoff',
      handoff: { task: 'Needs staff help', check: 'Assistant could not answer', language: session.language },
      ...phrase('handoff', session.language, session.script, { counter: venue.staffCounter }),
    };
  }

  /** Attach venue data the UI needs for certain actions. */
  private enrich(reply: AgentReply, venue: Venue): AgentReply {
    if (reply.action === 'route') return { ...reply, routes: venue.routes };
    return reply;
  }

  private loadSession(id: string, venueCode: string): Session {
    const existing = this.deps.sessions.get(id);
    if (existing && existing.venueCode === venueCode) return existing;
    return createSession(id, venueCode);
  }

  private record(session: Session, userText: string, reply: AgentReply): void {
    session.history.push({ role: 'user', text: userText }, { role: 'agent', text: reply.reply });
    session.history = session.history.slice(-this.historyLimit * 2);
    this.deps.sessions.save(session);
  }
}
