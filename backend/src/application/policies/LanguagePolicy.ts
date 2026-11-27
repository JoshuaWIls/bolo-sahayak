import type { Session } from '../../domain/session';
import type { DetectedLanguage } from '../../domain/types';

/**
 * Decides the session's reply language.
 * The first utterance sets it; afterwards it only switches once the user has
 * spoken a different language in N consecutive utterances, so one
 * misdetected sentence in a noisy place doesn't flip the conversation.
 */
export class LanguagePolicy {
  constructor(private readonly switchAfter = 2) {}

  apply(session: Session, detected: DetectedLanguage): void {
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
}
