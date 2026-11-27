import type { Session } from '../../domain/session';
import type { DetectedLanguage, LanguageCode } from '../../domain/types';

export interface LanguageSignals {
  detected: DetectedLanguage;
  /** The user picked a language in the menu or tapped a button in that language. */
  preferred?: LanguageCode;
  /** The user asked for a language out loud ("Hindi mein bolo"). */
  requested?: LanguageCode | null;
}

/**
 * Decides the session's reply language.
 * - An explicit choice (menu/button) or a spoken request wins immediately.
 * - Otherwise the first utterance sets it, and afterwards it only switches
 *   once the user has spoken a different language in N consecutive
 *   utterances, so one misdetected sentence in a noisy place doesn't flip
 *   the conversation.
 */
export class LanguagePolicy {
  constructor(private readonly switchAfter = 2) {}

  apply(session: Session, signals: LanguageSignals | DetectedLanguage): void {
    const { detected, preferred, requested } = 'detected' in signals ? signals : { detected: signals };

    if (requested) {
      // "Hindi mein bolo" means proper Hindi — native script, which also reads
      // aloud far better than romanised text.
      session.language = requested;
      session.script = requested === 'en' ? 'latin' : 'native';
      session.pendingLanguage = undefined;
      return;
    }

    const explicit = preferred;
    if (explicit) {
      session.script = this.scriptFor(explicit, detected, session);
      session.language = explicit;
      session.pendingLanguage = undefined;
      return;
    }

    if (session.history.length === 0) {
      session.language = detected.lang;
      session.script = detected.script;
      session.pendingLanguage = undefined;
      return;
    }

    if (detected.lang === session.language) {
      session.script = detected.script;
      session.pendingLanguage = undefined;
      return;
    }

    const count =
      session.pendingLanguage?.lang === detected.lang ? session.pendingLanguage.count + 1 : 1;

    if (count >= this.switchAfter) {
      session.language = detected.lang;
      session.script = detected.script;
      session.pendingLanguage = undefined;
    } else {
      session.pendingLanguage = { lang: detected.lang, count };
    }
  }

  /**
   * Romanised Hindi ("Hindi mein chahie") should get a romanised reply, but a
   * switch made from English text or a button press gets the native script.
   */
  private scriptFor(lang: LanguageCode, detected: DetectedLanguage, session: Session) {
    if (detected.lang === lang) return detected.script;
    if (session.language === lang) return session.script;
    return lang === 'en' ? 'latin' : 'native';
  }
}
