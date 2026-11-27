import { describe, expect, it } from 'vitest';
import { OutputSafetyFilter } from '../src/application/guardrails/OutputSafetyFilter';
import { PiiMasker } from '../src/application/guardrails/PiiMasker';
import { LanguagePolicy } from '../src/application/policies/LanguagePolicy';
import { createSession } from '../src/domain/session';
import type { Venue } from '../src/domain/types';
import { ScriptLanguageDetector } from '../src/infrastructure/language/ScriptLanguageDetector';

describe('PiiMasker', () => {
  const masker = new PiiMasker();

  it.each([
    ['aadhaar 1234 5678 9012', 'aadhaar [AADHAAR]', 'AADHAAR', '9012'],
    ['call 9876543210', 'call [PHONE]', 'PHONE', '3210'],
    ['call +91 98765 43210', 'call [PHONE]', 'PHONE', '3210'],
    ['acct 12345678901', 'acct [ACCOUNT]', 'ACCOUNT', '8901'],
    ['acct 1234567890', 'acct [ACCOUNT]', 'ACCOUNT', '7890'],
    ['acct 123456789012345', 'acct [ACCOUNT]', 'ACCOUNT', '2345'],
  ])('%s', (input, expected, kind, last4) => {
    const result = masker.mask(input);
    expect(result.masked).toBe(expected);
    expect(result.redactions).toEqual([{ kind, last4 }]);
  });

  it('leaves short numbers (room, token, route) alone', () => {
    expect(masker.mask('room 112, token 47, OTP 482913').masked).toBe('room 112, token 47, OTP 482913');
  });
});

describe('ScriptLanguageDetector', () => {
  const d = new ScriptLanguageDetector();
  it('detects scripts and romanised speech', () => {
    expect(d.detect('मुझे पैसे जमा करने हैं')).toEqual({ lang: 'hi', script: 'native' });
    expect(d.detect('OPD slip ಇದೆ')).toEqual({ lang: 'kn', script: 'mixed' });
    expect(d.detect('Majestic ke liye kaunsi bus?')).toEqual({ lang: 'hi', script: 'latin' });
    expect(d.detect('where is the lab')).toEqual({ lang: 'en', script: 'latin' });
  });
});

describe('LanguagePolicy', () => {
  it('resets a pending switch when the user returns to the session language', () => {
    const policy = new LanguagePolicy(2);
    const s = createSession('s', 'v');
    policy.apply(s, { lang: 'hi', script: 'native' });
    s.history.push({ role: 'user', text: 'x' });
    policy.apply(s, { lang: 'kn', script: 'native' });
    policy.apply(s, { lang: 'hi', script: 'native' });
    policy.apply(s, { lang: 'kn', script: 'native' });
    expect(s.language).toBe('hi');
  });
});

describe('OutputSafetyFilter', () => {
  const venue = { staffCounter: 'Counter 3' } as Venue;
  const filter = new OutputSafetyFilter();
  const ctx = { venue, language: 'en' as const, text: '' };

  it('blocks a reply that asks for an OTP', () => {
    const out = filter.filter({ lang: 'en', action: 'none', reply: 'Please tell me the OTP.', replyEnglish: 'Please tell me the OTP.' }, ctx);
    expect(out.action).toBe('handoff');
  });

  it('allows a warning not to share the OTP', () => {
    const reply = { lang: 'en' as const, action: 'none' as const, reply: 'Never share your OTP.', replyEnglish: 'Never share your OTP.' };
    expect(filter.filter(reply, ctx)).toBe(reply);
  });
});
