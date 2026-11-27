import type { LanguageDetector } from '../../domain/ports';
import type { DetectedLanguage } from '../../domain/types';

const DEVANAGARI = /[ऀ-ॿ]/;
const KANNADA = /[ಀ-೿]/;
const LATIN_WORD = /[a-z]{2,}/i;

/** Common words in romanised Hindi (Hinglish). */
const HINDI_ROMAN = [
  'hai', 'hain', 'kya', 'mujhe', 'mera', 'meri', 'mere', 'ke', 'ka', 'ki', 'ko', 'liye', 'kaunsi',
  'kaun', 'kahan', 'kahaan', 'kaise', 'nahin', 'nahi', 'bataun', 'batao', 'bataiye', 'aaya',
  'chahiye', 'chahie', 'chaiye', 'karna', 'karne', 'karo', 'kijiye', 'paisa', 'paise', 'jama',
  'kitna', 'kitne', 'kab', 'ji', 'bhai', 'theek', 'thik', 'haan', 'mein', 'main', 'hum', 'aap',
  'bolo', 'boliye', 'samajh', 'nikalna', 'daalna', 'jaana', 'jana', 'agli', 'gaye', 'gaya',
  'ho', 'raha', 'rahi', 'tha', 'aur', 'bhi', 'abhi',
];

/** Common words in romanised Kannada (Kanglish). */
const KANNADA_ROMAN = [
  'ide', 'beku', 'elli', 'hogbeku', 'illa', 'yaava', 'yenu', 'hege', 'swalpa', 'gottilla',
  'banni', 'houdu', 'saar', 'madi', 'kodi',
];

/** Common English function words, so "where is the main gate" stays English. */
const ENGLISH_COMMON = [
  'the', 'is', 'are', 'where', 'what', 'when', 'which', 'how', 'i', 'want', 'to', 'a', 'an', 'my',
  'please', 'can', 'you', 'for', 'need', 'help', 'with', 'of', 'do', 'does', 'this', 'that',
  'it', 'me', 'should', 'go', 'take', 'there', 'here', 'next',
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

    const en = words.filter((w) => ENGLISH_COMMON.includes(w)).length;

    if (hi === 0 && kn === 0) return { lang: 'en', script: 'latin' };
    if (en > hi + kn) return { lang: 'en', script: 'latin' };
    return { lang: kn > hi ? 'kn' : 'hi', script: 'latin' };
  }
}
