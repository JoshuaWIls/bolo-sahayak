import type { LanguageCode } from '../domain/types';

/** UI labels. Every control shows the user's language plus English. */
const STRINGS = {
  tapToSpeak: { hi: 'बोलिए', kn: 'ಮಾತನಾಡಿ', en: 'Tap and speak' },
  listening: { hi: 'सुन रहे हैं…', kn: 'ಕೇಳುತ್ತಿದ್ದೇನೆ…', en: 'Listening…' },
  thinking: { hi: 'सोच रहे हैं…', kn: 'ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ…', en: 'Thinking…' },
  speaking: { hi: 'बोल रहे हैं — रोकने के लिए दबाएँ', kn: 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ — ನಿಲ್ಲಿಸಲು ಒತ್ತಿ', en: 'Speaking — tap to interrupt' },
  showForm: { hi: 'फ़ॉर्म दिखाइए', kn: 'ಫಾರ್ಮ್ ತೋರಿಸಿ', en: 'Show form' },
  showSlip: { hi: 'पर्ची दिखाइए', kn: 'ಚೀಟಿ ತೋರಿಸಿ', en: 'Show slip' },
  readBoard: { hi: 'बोर्ड पढ़िए', kn: 'ಬೋರ್ಡ್ ಓದಿ', en: 'Read board' },
  openCamera: { hi: 'कैमरा खोलिए', kn: 'ಕ್ಯಾಮೆರಾ ತೆರೆಯಿರಿ', en: 'Open camera' },
  photoSent: { hi: 'फ़ोटो भेजी', kn: 'ಫೋಟೋ ಕಳುಹಿಸಲಾಗಿದೆ', en: 'Photo sent' },
  photoPrivacy: {
    hi: 'फ़ोटो कहीं सेव नहीं होती। नंबर छिपा दिए जाते हैं।',
    kn: 'ಫೋಟೋ ಎಲ್ಲೂ ಉಳಿಸಲಾಗುವುದಿಲ್ಲ. ಸಂಖ್ಯೆಗಳನ್ನು ಮರೆಮಾಡಲಾಗುತ್ತದೆ.',
    en: 'Photos are never saved. Numbers are hidden.',
  },
  photoFailed: {
    hi: 'यह फ़ोटो खुल नहीं पाई। कैमरे से दोबारा फ़ोटो लीजिए।',
    kn: 'ಈ ಫೋಟೋ ತೆರೆಯಲಿಲ್ಲ. ಕ್ಯಾಮೆರಾದಿಂದ ಮತ್ತೆ ಫೋಟೋ ತೆಗೆಯಿರಿ.',
    en: "This photo couldn't be opened. Take the photo again with the camera.",
  },
  retry: { hi: 'फिर भेजें', kn: 'ಮತ್ತೆ ಕಳುಹಿಸಿ', en: 'Retry' },
  speakAgain: { hi: 'फिर से बोलिए', kn: 'ಮತ್ತೆ ಮಾತನಾಡಿ', en: 'Speak again' },
  back: { hi: 'बातचीत पर वापस', kn: 'ಸಂಭಾಷಣೆಗೆ ಹಿಂತಿರುಗಿ', en: 'Back to conversation' },
  showCard: { hi: 'स्टाफ़ के लिए कार्ड', kn: 'ಸಿಬ್ಬಂದಿಗೆ ಕಾರ್ಡ್', en: 'Show card for staff' },
  nextBuses: { hi: 'अगली बसें', kn: 'ಮುಂದಿನ ಬಸ್‌ಗಳು', en: 'Next buses' },
  callFree: { hi: 'मुफ़्त कॉल', kn: 'ಉಚಿತ ಕರೆ', en: 'Call free' },
  micBlocked: {
    hi: 'माइक की अनुमति नहीं है। नीचे लिखकर पूछें।',
    kn: 'ಮೈಕ್ ಅನುಮತಿ ಇಲ್ಲ. ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ.',
    en: 'The microphone is blocked. Type your question below.',
  },
  noMic: {
    hi: 'माइक नहीं मिला। नीचे लिखकर पूछें।',
    kn: 'ಮೈಕ್ ಸಿಗಲಿಲ್ಲ. ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ.',
    en: 'No microphone found. Type your question below.',
  },
  voiceUnsupported: {
    hi: 'इस ब्राउज़र में आवाज़ नहीं चलती — लिखिए',
    kn: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇಲ್ಲ — ಟೈಪ್ ಮಾಡಿ',
    en: 'Voice not supported here — type',
  },
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
  voiceOffline: {
    hi: 'आवाज़ पहचानने के लिए इंटरनेट चाहिए। नीचे लिखकर पूछिए।',
    kn: 'ಧ್ವನಿ ಗುರುತಿಸಲು ಇಂಟರ್ನೆಟ್ ಬೇಕು. ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ ಕೇಳಿ.',
    en: 'Voice needs internet. Type your question below instead.',
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

/** Label for the camera button, matched to what people hold at each venue. */
export function cameraLabelKey(type: 'bank' | 'hospital' | 'bus'): StringKey {
  return type === 'bus' ? 'readBoard' : type === 'hospital' ? 'showSlip' : 'showForm';
}

/** Error codes from the voice hook → a message in the user's language. */
export function errorKey(code: string): StringKey | null {
  if (code === 'network') return 'network';
  if (code === 'speech-network') return 'voiceOffline';
  if (code === 'mic-blocked') return 'micBlocked';
  if (code === 'no-mic') return 'noMic';
  if (code === 'photo') return 'photoFailed';
  return null;
}
