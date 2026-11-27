import type { ConversationTurn, LanguageCode, ScriptStyle } from './types';

export interface Session {
  id: string;
  venueCode: string;
  language: LanguageCode;
  script: ScriptStyle;
  /** A language seen in the latest utterance(s) that differs from `language`. */
  pendingLanguage?: { lang: LanguageCode; count: number };
  consecutiveFailures: number;
  history: ConversationTurn[];
}

export function createSession(id: string, venueCode: string): Session {
  return {
    id,
    venueCode,
    language: 'hi',
    script: 'native',
    consecutiveFailures: 0,
    history: [],
  };
}
