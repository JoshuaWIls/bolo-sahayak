import type { LanguageCode } from '../domain/types';

/** UI labels. Every control shows the user's language plus English. */
const STRINGS = {
  tapToSpeak: { hi: 'बोलिए', kn: 'ಮಾತನಾಡಿ', en: 'Tap and speak' },
  listening: { hi: 'सुन रहे हैं…', kn: 'ಕೇಳುತ್ತಿದ್ದೇನೆ…', en: 'Listening…' },
  thinking: { hi: 'सोच रहे हैं…', kn: 'ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ…', en: 'Thinking…' },
  speaking: { hi: 'बोल रहे हैं — रोकने के लिए दबाएँ', kn: 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ — ನಿಲ್ಲಿಸಲು ಒತ್ತಿ', en: 'Speaking — tap to interrupt' },
  showForm: { hi: 'फ़ॉर्म दिखाइए', kn: 'ಫಾರ್ಮ್ ತೋರಿಸಿ', en: 'Show form' },
  repeat: { hi: 'फिर से', kn: 'ಮತ್ತೆ', en: 'Repeat' },
  slower: { hi: 'धीरे', kn: 'ನಿಧಾನ', en: 'Slower' },
  staff: { hi: 'स्टाफ़ से बात', kn: 'ಸಿಬ್ಬಂದಿ', en: 'Talk to staff' },
  yes: { hi: 'हाँ', kn: 'ಹೌದು', en: 'Yes' },
  no: { hi: 'नहीं', kn: 'ಇಲ್ಲ', en: 'No' },
  typeInstead: { hi: 'लिखकर पूछें', kn: 'ಟೈಪ್ ಮಾಡಿ', en: 'Type instead' },
  send: { hi: 'भेजें', kn: 'ಕಳುಹಿಸಿ', en: 'Send' },
  endErase: { hi: 'खत्म करें और मिटाएँ', kn: 'ಮುಗಿಸಿ ಮತ್ತು ಅಳಿಸಿ', en: 'End and erase' },
  promise: {
    hi: 'मैं कभी आपका OTP, PIN, पासवर्ड या पैसे नहीं माँगूँगा।',
    kn: 'ನಾನು ಎಂದಿಗೂ ನಿಮ್ಮ OTP, PIN, ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಹಣ ಕೇಳುವುದಿಲ್ಲ.',
    en: 'I will never ask for your OTP, PIN, password or money.',
  },
  network: {
    hi: 'नेटवर्क धीमा है। फिर कोशिश करें या मुफ़्त कॉल करें।',
    kn: 'ನೆಟ್‌ವರ್ಕ್ ನಿಧಾನವಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಉಚಿತ ಕರೆ ಮಾಡಿ.',
    en: 'Network is slow. Try again or call free.',
  },
  cameraSoon: {
    hi: 'कैमरे से फ़ॉर्म पढ़ना जल्द आ रहा है। अभी स्टाफ़ से मदद लें।',
    kn: 'ಕ್ಯಾಮೆರಾದಿಂದ ಫಾರ್ಮ್ ಓದುವುದು ಶೀಘ್ರದಲ್ಲೇ. ಈಗ ಸಿಬ್ಬಂದಿಯ ಸಹಾಯ ಪಡೆಯಿರಿ.',
    en: 'Reading forms with the camera is coming soon. Please ask staff for now.',
  },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: LanguageCode): string {
  return STRINGS[key][lang];
}

/** "बोलिए · Tap and speak" — local language first, English second (once). */
export function bi(key: StringKey, lang: LanguageCode): string {
  return lang === 'en' ? STRINGS[key].en : `${STRINGS[key][lang]} · ${STRINGS[key].en}`;
}
