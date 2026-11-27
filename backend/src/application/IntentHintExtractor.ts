import type { Venue } from '../domain/types';
import { containsAny } from './guardrails/keywords';

/**
 * Maps colloquial / dialect phrases to canonical intent words using the
 * venue's synonym table, e.g. "paisa daalna" → "deposit".
 */
export class IntentHintExtractor {
  extract(text: string, venue: Venue): string[] {
    const hints = new Set<string>();
    for (const [phrase, intent] of Object.entries(venue.synonyms)) {
      if (containsAny(text, [phrase])) hints.add(intent);
    }
    return [...hints];
  }
}
