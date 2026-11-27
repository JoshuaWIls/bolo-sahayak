/**
 * Keyword matching that works for Latin and Indic scripts.
 * Latin terms are matched on word boundaries; Indic terms as substrings
 * (JS word boundaries don't understand Devanagari/Kannada).
 */
import { loanwordGloss, normaliseIndic } from './loanwords';

export function containsAny(text: string, terms: readonly string[]): boolean {
  const base = normaliseIndic(text.toLowerCase());
  // Append English glosses of loanwords ("हॉस्पिटल" → "hospital") so Latin terms match them too.
  const lower = `${base} ${loanwordGloss(base)}`;
  return terms.some((term) => {
    const t = normaliseIndic(term.toLowerCase());
    if (/^[\x00-\x7F]+$/.test(t)) {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(lower);
    }
    return lower.includes(t);
  });
}
