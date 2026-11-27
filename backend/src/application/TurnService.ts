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
import type {
  AgentReply,
  DetectedLanguage,
  ReplySource,
  TurnRequest,
  TurnResult,
  Venue,
} from '../domain/types';
import type { IntentHintExtractor } from './IntentHintExtractor';
import { phrase } from './messages';
import type { ClarificationPolicy } from './policies/ClarificationPolicy';
import type { LanguagePolicy } from './policies/LanguagePolicy';
import type { LanguageRequestDetector } from './policies/LanguageRequestDetector';
import type { VenueScopePolicy } from './policies/VenueScopePolicy';
import { parseAgentReply } from './replySchema';

export interface TurnServiceDeps {
  venues: VenueRepository;
  sessions: SessionStore;
  masker: TextMasker;
  detector: LanguageDetector;
  languagePolicy: LanguagePolicy;
  languageRequests: LanguageRequestDetector;
  clarificationPolicy: ClarificationPolicy;
  scopePolicy: VenueScopePolicy;
  intentHints: IntentHintExtractor;
  inputGuardrails: InputGuardrail[];
  outputGuardrails: OutputGuardrail[];
  model: LanguageModel;
  /** Model attempts per turn before falling back to a staff hand-off. */
  maxModelAttempts?: number;
  historyLimit?: number;
}

const LANGUAGE_NAMES = { hi: 'Hindi', kn: 'Kannada', en: 'English' } as const;

/** A pure "switch to Hindi" request is short; longer utterances carry a real question too. */
const LANGUAGE_ONLY_MAX_WORDS = 6;

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

    const detected = this.deps.detector.detect(masked);
    const requested = this.deps.languageRequests.detect(masked);
    this.deps.languagePolicy.apply(session, {
      detected,
      preferred: request.preferredLanguage,
      requested,
    });

    const { reply, source } = await this.decide(session, venue, masked, detected, {
      confidence: request.sttConfidence,
      languageOnly: Boolean(requested) && masked.trim().split(/\s+/).length <= LANGUAGE_ONLY_MAX_WORDS,
    });

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
    detected: DetectedLanguage,
    turn: { confidence?: number; languageOnly: boolean },
  ): Promise<{ reply: AgentReply; source: ReplySource }> {
    const guardCtx: GuardrailContext = {
      venue,
      language: session.language,
      script: session.script,
      text,
    };

    // Safety first: an emergency or an OTP mention must win even if audio was unclear.
    // The warning is given in the language of THIS utterance when its script makes
    // that unambiguous (someone shouting "ಎದೆ ನೋವು" must not get a Hindi reply).
    const safetyCtx: GuardrailContext =
      detected.script === 'latin' ? guardCtx : { ...guardCtx, language: detected.lang, script: detected.script };
    for (const guard of this.deps.inputGuardrails) {
      const reply = guard.check(safetyCtx);
      if (reply) return { reply, source: 'guardrail' };
    }

    if (turn.languageOnly) {
      session.consecutiveFailures = 0;
      return {
        reply: {
          lang: session.language,
          action: 'none',
          ...phrase('languageSwitched', session.language, session.script, {
            languageName: LANGUAGE_NAMES[session.language],
          }),
        },
        source: 'policy',
      };
    }

    const clarification = this.deps.clarificationPolicy.evaluate(session, venue, text, turn.confidence);
    if (clarification) return { reply: clarification, source: 'policy' };

    // Each QR belongs to one venue: a post-office question at the hospital gets an
    // honest "not here", not a list of hospital tasks.
    const outOfScope = this.deps.scopePolicy.evaluate(session, venue, text, this.deps.intentHints.extract(text, venue));
    if (outOfScope) return { reply: outOfScope, source: 'policy' };

    const modelReply = await this.askModel(session, venue, text);
    if (!modelReply) return { reply: handoffReply(session, venue), source: 'fallback' };

    const safe = this.deps.outputGuardrails.reduce((r, g) => g.filter(r, guardCtx), modelReply);
    return { reply: enrich(safe, venue), source: 'llm' };
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

export function handoffReply(session: Session, venue: Venue): AgentReply {
  return {
    lang: session.language,
    action: 'handoff',
    handoff: { task: 'Needs staff help', check: 'Assistant could not answer', language: session.language },
    ...phrase('handoff', session.language, session.script, { counter: venue.staffCounter }),
  };
}

/** Attach venue data the UI needs for certain actions. */
export function enrich(reply: AgentReply, venue: Venue): AgentReply {
  if (reply.action === 'route') return { ...reply, routes: venue.routes };
  return reply;
}
