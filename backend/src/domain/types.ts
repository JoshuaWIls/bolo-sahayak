/**
 * Core domain types. Pure data — no framework or provider imports.
 */

export type LanguageCode = 'hi' | 'kn' | 'en';
export type ScriptStyle = 'native' | 'latin' | 'mixed';

export interface DetectedLanguage {
  lang: LanguageCode;
  script: ScriptStyle;
}

export type VenueType = 'bank' | 'hospital' | 'bus';

export interface LocalizedLabel {
  hi: string;
  kn: string;
  en: string;
}

export interface VenueTask {
  id: string;
  label: LocalizedLabel;
  icon: string;
}

export interface BusRoute {
  route: string;
  destination: string;
  etaMinutes: number;
  fare: string;
}

export interface Venue {
  code: string;
  type: VenueType;
  name: string;
  location: string;
  tollFree: string;
  staffCounter: string;
  tasks: VenueTask[];
  directions: Record<string, string>;
  routes: BusRoute[];
  /** Colloquial term → canonical intent word, e.g. "paisa daalna" → "deposit". */
  synonyms: Record<string, string>;
  sttHints: string[];
}

export type AgentAction =
  | 'none'
  | 'camera'
  | 'handoff'
  | 'emergency'
  | 'route'
  | 'confirm'
  | 'fallback';

export interface Handoff {
  task: string;
  check: string;
  language: string;
}

export interface AgentReply {
  lang: LanguageCode;
  reply: string;
  replyEnglish: string;
  action: AgentAction;
  handoff?: Handoff;
  routes?: BusRoute[];
}

export type ReplySource = 'guardrail' | 'policy' | 'llm' | 'fallback';

export interface ConversationTurn {
  role: 'user' | 'agent';
  text: string;
}

export interface TurnRequest {
  sessionId: string;
  venueCode: string;
  text: string;
  /** 0..1 confidence reported by the speech recogniser, if known. */
  sttConfidence?: number;
}

export interface TurnResult {
  reply: AgentReply;
  source: ReplySource;
  sessionLanguage: LanguageCode;
  maskedText: string;
}
