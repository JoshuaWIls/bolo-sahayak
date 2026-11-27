import type { MaskResult, Redaction, TextMasker } from '../../domain/ports';

/**
 * Masks Indian identifiers before any text leaves the device / reaches a model.
 *   12 digits                     → [AADHAAR]
 *   10 digits starting 6–9 (+91)  → [PHONE]
 *   9–11 or 13–18 digits          → [ACCOUNT]
 * Digits may be separated by spaces or hyphens ("1234 5678 9012").
 */
export class PiiMasker implements TextMasker {
  private static readonly DIGIT_RUN = /(\+91[\s-]?)?\d(?:[\s-]?\d){8,17}/g;

  mask(text: string): MaskResult {
    const redactions: Redaction[] = [];

    const masked = text.replace(PiiMasker.DIGIT_RUN, (match, intlPrefix?: string) => {
      const digits = match.replace(/\D/g, '');
      const local = intlPrefix ? digits.slice(2) : digits;
      const kind = PiiMasker.classify(local, Boolean(intlPrefix));
      if (!kind) return match;
      redactions.push({ kind, last4: local.slice(-4) });
      return `[${kind}]`;
    });

    return { masked, redactions };
  }

  private static classify(digits: string, hasIntlPrefix: boolean): Redaction['kind'] | null {
    const n = digits.length;
    if (n === 10 && /^[6-9]/.test(digits)) return 'PHONE';
    if (hasIntlPrefix) return n === 10 ? 'PHONE' : null;
    if (n === 12) return 'AADHAAR';
    if (n >= 9 && n <= 18) return 'ACCOUNT';
    return null;
  }
}
