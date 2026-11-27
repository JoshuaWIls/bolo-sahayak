import type { Session } from '../../domain/session';
import type { AgentReply, Venue } from '../../domain/types';
import { phrase } from '../messages';

/**
 * Handles turns we can't trust: empty/very short audio or low recogniser
 * confidence. First it asks the user to confirm; after `maxFailures`
 * consecutive problems it falls back to pictogram buttons + toll-free call.
 */
export class ClarificationPolicy {
  constructor(
    private readonly minConfidence = 0.6,
    private readonly maxFailures = 2,
  ) {}

  evaluate(session: Session, venue: Venue, text: string, confidence?: number): AgentReply | null {
    const tooShort = text.trim().length < 2;
    const lowConfidence = confidence !== undefined && confidence < this.minConfidence;
    if (!tooShort && !lowConfidence) {
      session.consecutiveFailures = 0;
      return null;
    }

    session.consecutiveFailures += 1;
    const { language: lang, script } = session;

    if (session.consecutiveFailures >= this.maxFailures) {
      return { lang, action: 'fallback', ...phrase('fallback', lang, script, { tollFree: venue.tollFree }) };
    }
    if (tooShort) {
      return { lang, action: 'none', ...phrase('notHeard', lang, script) };
    }
    return { lang, action: 'confirm', ...phrase('confirm', lang, script, { text: text.trim() }) };
  }
}
