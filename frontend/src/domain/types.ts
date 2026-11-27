/** Types shared with the API contract (see backend/src/domain/types.ts). */

export type LanguageCode = 'hi' | 'kn' | 'en';

export type AgentAction =
  | 'none'
  | 'camera'
  | 'handoff'
  | 'emergency'
  | 'route'
  | 'confirm'
  | 'fallback';

export interface BusRoute {
  route: string;
  destination: string;
  etaMinutes: number;
  fare: string;
}

export interface AgentReply {
  lang: LanguageCode;
  reply: string;
  replyEnglish: string;
  action: AgentAction;
  handoff?: { task: string; check: string; language: string };
  routes?: BusRoute[];
}

export interface TurnResult {
  reply: AgentReply;
  source: 'guardrail' | 'policy' | 'llm' | 'fallback';
  sessionLanguage: LanguageCode;
  maskedText: string;
}

export interface VenueTask {
  id: string;
  icon: string;
  label: { hi: string; kn: string; en: string };
}

export interface VenueInfo {
  code: string;
  type: 'bank' | 'hospital' | 'bus';
  name: string;
  location: string;
  tollFree: string;
  staffCounter: string;
  tasks: VenueTask[];
}

export type Redaction = { kind: 'AADHAAR' | 'ACCOUNT' | 'PHONE'; last4: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  english?: string;
}
