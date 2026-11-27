import type { LanguageCode, ScriptStyle } from '../domain/types';

/**
 * Fixed, pre-approved phrases used by guardrails and policies.
 * These never go through the language model, so they can't be altered by it.
 */
type Phrase = { hi: string; hiLatin: string; kn: string; en: string };

const PHRASES = {
  otpRefusal: {
    hi: 'रुकिए! OTP, PIN या पासवर्ड किसी को मत बताइए — मुझे भी नहीं।',
    hiLatin: 'Rukiye! OTP, PIN ya password kisi ko mat bataiye — mujhe bhi nahin.',
    kn: 'ನಿಲ್ಲಿ! OTP, PIN ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಯಾರಿಗೂ ಹೇಳಬೇಡಿ — ನನಗೂ ಬೇಡ.',
    en: 'Stop! Never share your OTP, PIN or password with anyone — not even me.',
  },
  emergency: {
    hi: 'अभी तुरंत इमरजेंसी जाइए या 108 पर कॉल कीजिए।',
    hiLatin: 'Abhi turant Emergency jaiye ya 108 par call kijiye.',
    kn: 'ತಕ್ಷಣ ಎಮರ್ಜೆನ್ಸಿಗೆ ಹೋಗಿ ಅಥವಾ 108 ಗೆ ಕರೆ ಮಾಡಿ.',
    en: 'Go to Emergency right now or call 108.',
  },
  fraud: {
    hi: 'यह धोखा हो सकता है। कुछ मत बताइए, 1930 पर कॉल कीजिए और ब्रांच मैनेजर से मिलिए।',
    hiLatin: 'Yeh dhokha ho sakta hai. Kuch mat bataiye, 1930 par call kijiye aur branch manager se miliye.',
    kn: 'ಇದು ಮೋಸ ಆಗಿರಬಹುದು. ಏನೂ ಹೇಳಬೇಡಿ, 1930 ಗೆ ಕರೆ ಮಾಡಿ ಮತ್ತು ಶಾಖಾ ವ್ಯವಸ್ಥಾಪಕರನ್ನು ಭೇಟಿ ಮಾಡಿ.',
    en: 'This may be a fraud. Share nothing, call 1930 and meet the branch manager.',
  },
  notHeard: {
    hi: 'मैं ठीक से सुन नहीं पाया। फ़ोन पास रखकर फिर बोलिए।',
    hiLatin: 'Main theek se sun nahin paaya. Phone paas rakhkar phir boliye.',
    kn: 'ನನಗೆ ಸರಿಯಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಫೋನ್ ಹತ್ತಿರ ಹಿಡಿದು ಮತ್ತೆ ಹೇಳಿ.',
    en: "I couldn't hear you clearly. Hold the phone closer and speak again.",
  },
  confirm: {
    hi: 'क्या आपने कहा: "{text}"? हाँ या नहीं?',
    hiLatin: 'Kya aapne kaha: "{text}"? Haan ya nahin?',
    kn: 'ನೀವು ಹೇಳಿದ್ದು: "{text}"? ಹೌದು ಅಥವಾ ಇಲ್ಲ?',
    en: 'Did you say: "{text}"? Yes or no?',
  },
  fallback: {
    hi: 'माफ़ कीजिए, समझ नहीं पाया। नीचे से चुनिए या {tollFree} पर मुफ़्त कॉल कीजिए।',
    hiLatin: 'Maaf kijiye, samajh nahin paaya. Neeche se chuniye ya {tollFree} par free call kijiye.',
    kn: 'ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ಕೆಳಗಿನಿಂದ ಆಯ್ಕೆ ಮಾಡಿ ಅಥವಾ {tollFree} ಗೆ ಉಚಿತ ಕರೆ ಮಾಡಿ.',
    en: "Sorry, I didn't understand. Pick an option below or call {tollFree} free.",
  },
  handoff: {
    hi: 'मैं आपको स्टाफ़ के पास भेज रहा हूँ। यह स्क्रीन {counter} पर दिखाइए।',
    hiLatin: 'Main aapko staff ke paas bhej raha hoon. Yeh screen {counter} par dikhaiye.',
    kn: 'ನಾನು ನಿಮ್ಮನ್ನು ಸಿಬ್ಬಂದಿಗೆ ಕಳುಹಿಸುತ್ತಿದ್ದೇನೆ. ಈ ಪರದೆಯನ್ನು {counter} ನಲ್ಲಿ ತೋರಿಸಿ.',
    en: "I'm sending you to staff. Show this screen at {counter}.",
  },
} satisfies Record<string, Phrase>;

export type PhraseKey = keyof typeof PHRASES;

export function phrase(
  key: PhraseKey,
  lang: LanguageCode,
  script: ScriptStyle,
  vars: Record<string, string> = {},
): { reply: string; replyEnglish: string } {
  const p: Phrase = PHRASES[key];
  const chosen = lang === 'hi' ? (script === 'native' ? p.hi : p.hiLatin) : p[lang];
  return { reply: fill(chosen, vars), replyEnglish: fill(p.en, vars) };
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}
