import type { LanguageCode } from '../../domain/types';
import { containsAny } from '../guardrails/keywords';

/**
 * Spots an explicit request for a reply language, e.g. "Hindi mein bolo",
 * "in Kannada please", "हिंदी में", "ಕನ್ನಡದಲ್ಲಿ". An explicit request switches
 * the session immediately — it must never wait for the 2-utterance rule.
 */
const REQUESTS: Record<LanguageCode, readonly string[]> = {
  hi: [
    'hindi', 'hindi mein', 'hindi me', 'hindi main', 'in hindi',
    'हिंदी', 'हिन्दी', 'ಹಿಂದಿ',
  ],
  kn: [
    'kannada', 'kannadadalli', 'in kannada', 'kannada mein', 'kannada me',
    'कन्नड़', 'कन्नड', 'ಕನ್ನಡ', 'ಕನ್ನಡದಲ್ಲಿ',
  ],
  en: ['english', 'in english', 'english mein', 'english me', 'इंग्लिश', 'अंग्रेज़ी', 'अंग्रेजी', 'ಇಂಗ್ಲಿಷ್'],
};

/** Words that make a bare language name an actual request ("Hindi mein bolo", "speak Kannada"). */
const REQUEST_CUES = [
  'mein', 'me', 'main', 'in', 'bolo', 'boliye', 'baat', 'chahiye', 'chahie', 'chaiye', 'speak', 'talk',
  'reply', 'response', 'please', 'language', 'bhasha', 'mai',
  'में', 'बोलो', 'बोलिए', 'चाहिए', 'बात', 'भाषा',
  'ದಲ್ಲಿ', 'ಮಾತನಾಡಿ', 'ಹೇಳಿ', 'ಬೇಕು', 'ಭಾಷೆ',
];

export class LanguageRequestDetector {
  detect(text: string): LanguageCode | null {
    const matches = (Object.keys(REQUESTS) as LanguageCode[]).filter((lang) => containsAny(text, REQUESTS[lang]));
    if (matches.length !== 1) return null; // none, or ambiguous ("Hindi or English?")
    const lang = matches[0]!;
    const words = text.trim().split(/\s+/);
    // A one/two-word utterance like "Hindi" or "ಕನ್ನಡದಲ್ಲಿ" is a request on its own.
    if (words.length <= 2 || containsAny(text, REQUEST_CUES) || /ದಲ್ಲಿ/.test(text)) return lang;
    return null;
  }
}
