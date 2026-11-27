import type { Redaction } from './types';

/**
 * On-device masking: runs BEFORE any text leaves the phone.
 * Same rules as the backend's PiiMasker (which re-checks defensively):
 *   12 digits → [AADHAAR], 10 digits starting 6–9 → [PHONE],
 *   other 9–18 digit runs → [ACCOUNT].
 */
const DIGIT_RUN = /(\+91[\s-]?)?\d(?:[\s-]?\d){8,17}/g;

export function maskPii(text: string): { masked: string; redactions: Redaction[] } {
  const redactions: Redaction[] = [];
  const masked = text.replace(DIGIT_RUN, (match, intlPrefix?: string) => {
    const digits = match.replace(/\D/g, '');
    const local = intlPrefix ? digits.slice(2) : digits;
    const kind = classify(local, Boolean(intlPrefix));
    if (!kind) return match;
    redactions.push({ kind, last4: local.slice(-4) });
    return `[${kind}]`;
  });
  return { masked, redactions };
}

function classify(digits: string, intl: boolean): Redaction['kind'] | null {
  const n = digits.length;
  if (n === 10 && /^[6-9]/.test(digits)) return 'PHONE';
  if (intl) return n === 10 ? 'PHONE' : null;
  if (n === 12) return 'AADHAAR';
  if (n >= 9 && n <= 18) return 'ACCOUNT';
  return null;
}

/** For display only: "[ACCOUNT]" → "XXXX8901", using redactions kept on the device. */
export function displayMasked(masked: string, redactions: Redaction[]): string {
  let i = 0;
  return masked.replace(/\[(AADHAAR|ACCOUNT|PHONE)\]/g, (token) => {
    const r = redactions[i++];
    return r ? `XXXX${r.last4}` : token;
  });
}
