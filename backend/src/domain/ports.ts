/**
 * Ports (interfaces) the application layer depends on.
 * Infrastructure provides implementations; the application never imports them
 * directly (Dependency Inversion). Each port is small and single-purpose
 * (Interface Segregation).
 */
import type { Session } from './session';
import type {
  AgentReply,
  ConversationTurn,
  DetectedLanguage,
  LanguageCode,
  ScriptStyle,
  Venue,
} from './types';

export interface VenueRepository {
  findByCode(code: string): Promise<Venue | null>;
}

export interface SessionStore {
  get(id: string): Session | undefined;
  save(session: Session): void;
  delete(id: string): boolean;
}

export interface LanguageDetector {
  detect(text: string): DetectedLanguage;
}

export type RedactionKind = 'AADHAAR' | 'ACCOUNT' | 'PHONE';

export interface Redaction {
  kind: RedactionKind;
  /** Last four digits, kept only for on-screen display (e.g. "XXXX8901"). */
  last4: string;
}

export interface MaskResult {
  masked: string;
  redactions: Redaction[];
}

export interface TextMasker {
  mask(text: string): MaskResult;
}

/** Everything a language model needs to answer one turn. */
export interface AgentContext {
  venue: Venue;
  language: LanguageCode;
  script: ScriptStyle;
  history: ConversationTurn[];
  userText: string;
  /** Canonical intent words derived from venue synonyms, e.g. ["deposit"]. */
  intentHints: string[];
}

/**
 * Returns the model's raw, UNVALIDATED output. Validation is the
 * application's job so every provider is held to the same contract.
 */
export interface LanguageModel {
  generate(context: AgentContext): Promise<unknown>;
}

/** Context shared by guardrails. */
export interface GuardrailContext {
  venue: Venue;
  language: LanguageCode;
  text: string;
}

/**
 * Runs before the model. Returning a reply short-circuits the turn
 * (the model is never called).
 */
export interface InputGuardrail {
  readonly name: string;
  check(context: GuardrailContext): AgentReply | null;
}

/** Runs after the model and may replace an unsafe reply. */
export interface OutputGuardrail {
  readonly name: string;
  filter(reply: AgentReply, context: GuardrailContext): AgentReply;
}
