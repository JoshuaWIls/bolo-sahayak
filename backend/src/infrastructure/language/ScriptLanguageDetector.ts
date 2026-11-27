import type { LanguageDetector } from '../../domain/ports';
import type { DetectedLanguage } from '../../domain/types';

const DEVANAGARI = /[ऀ-ॿ]/;
const KANNADA = /[ಀ-೿]/;
const LATIN_WORD = /[a-z]{2,}/i;

/** Common words in romanised Hindi (Hinglish). */
const HINDI_ROMAN = [
  'hai', 'hain', 'kya', 'mujhe', 'mera', 'meri', 'ke', 'liye', 'kaunsi', 'kahan', 'kaise',
  'nahin', 'nahi', 'bataun', 'batao', 'aaya', 'chahiye', 'karna', 'karne', 'paisa', 'paise',
  'jama', 'kitna', 'kab', 'ji', 'bhai', 'theek', 'haan',
];

/** Common words in romanised Kannada (Kanglish). */
const KANNADA_ROMAN = [
  'ide', 'beku', 'elli', 'hogbeku', 'illa', 'yaava', 'yenu', 'hege', 'swalpa', 'gottilla',
  'banni', 'houdu', 'saar', 'madi', 'kodi',
];

/**
 * Lightweight, offline language detection by Unicode script plus a small
 * romanised-word list. Good enough for routing; a cloud detector can replace
 * it behind the same port.
 */
export class ScriptLanguageDetector implements LanguageDetector {
  detect(raw: string): DetectedLanguage {
    const text = raw.replace(/\[[A-Z]+\]/g, ' ');
    const hasLatin = LATIN_WORD.test(text);

    if (KANNADA.test(text)) return { lang: 'kn', script: hasLatin ? 'mixed' : 'native' };
    if (DEVANAGARI.test(text)) return { lang: 'hi', script: hasLatin ? 'mixed' : 'native' };

    const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
    const hi = words.filter((w) => HINDI_ROMAN.includes(w)).length;
    const kn = words.filter((w) => KANNADA_ROMAN.includes(w)).length;

    if (hi === 0 && kn === 0) return { lang: 'en', script: 'latin' };
    return { lang: kn > hi ? 'kn' : 'hi', script: 'latin' };
  }
}
