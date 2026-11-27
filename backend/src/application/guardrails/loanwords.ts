/**
 * Phone speech recognisers set to Hindi or Kannada write English words in the
 * local script: "hospital" arrives as "हॉस्पिटल", "OPD" as "ओपीडी", "form" as
 * "ಫಾರ್ಮ್". People in India mix these words in constantly, so every keyword
 * list would miss them. This table maps those spellings back to the English
 * word so one Latin keyword covers all three scripts.
 *
 * Keys are the English words used in keyword lists; values are common
 * Devanagari and Kannada spellings (nukta-free — see normaliseIndic).
 */
const LOANWORDS: Record<string, readonly string[]> = {
  // places
  hospital: ['हॉस्पिटल', 'हास्पिटल', 'हॉस्पीटल', 'होस्पिटल', 'ಹಾಸ್ಪಿಟಲ್', 'ಹಾಸ್ಪಿಟಲ'],
  opd: ['ओपीडी', 'ओ पी डी', 'ओपिडी', 'ಒಪಿಡಿ', 'ಓಪಿಡಿ', 'ಒ ಪಿ ಡಿ'],
  doctor: ['डॉक्टर', 'डाक्टर', 'डॉक्टर्स', 'ಡಾಕ್ಟರ್', 'ಡಾಕ್ಟರ'],
  clinic: ['क्लिनिक', 'ಕ್ಲಿನಿಕ್'],
  bank: ['बैंक', 'बेंक', 'ಬ್ಯಾಂಕ್', 'ಬ್ಯಾಂಕು'],
  atm: ['एटीएम', 'ए टी एम', 'ಎಟಿಎಂ'],
  'bus stop': ['बस स्टॉप', 'बस स्टाप', 'बस स्टैंड', 'ಬಸ್ ಸ್ಟಾಪ್', 'ಬಸ್ ಸ್ಟ್ಯಾಂಡ್'],
  'post office': ['पोस्ट ऑफिस', 'पोस्ट आफिस', 'ಪೋಸ್ಟ್ ಆಫೀಸ್', 'ಪೋಸ್ಟ್ ಆಫೀಸು'],
  police: ['पुलिस', 'पोलिस', 'ಪೊಲೀಸ್'],
  railway: ['रेलवे', 'ರೈಲ್ವೆ'],
  train: ['ट्रेन', 'ಟ್ರೈನ್', 'ಟ್ರೇನ್'],
  passport: ['पासपोर्ट', 'ಪಾಸ್ಪೋರ್ಟ್'],
  ration: ['राशन', 'ರೇಷನ್'],
  // bank tasks
  kyc: ['केवाईसी', 'के वाई सी', 'ಕೆವೈಸಿ', 'ಕೆ ವೈ ಸಿ'],
  form: ['फॉर्म', 'फार्म', 'फोर्म', 'ಫಾರ್ಮ್', 'ಫಾರಂ'],
  slip: ['स्लिप', 'ಸ್ಲಿಪ್'],
  withdraw: ['विड्रॉ', 'विड्रा', 'विथड्रॉ', 'विदड्रॉ', 'ವಿತ್ಡ್ರಾ', 'ವಿಡ್ರಾ'],
  deposit: ['डिपॉजिट', 'डिपाजिट', 'डिपोजिट', 'ಡೆಪಾಸಿಟ್', 'ಡಿಪಾಸಿಟ್'],
  pension: ['पेंशन', 'पेन्शन', 'ಪೆನ್ಷನ್'],
  'life certificate': ['लाइफ सर्टिफिकेट', 'ಲೈಫ್ ಸರ್ಟಿಫಿಕೇಟ್'],
  cash: ['कैश', 'ಕ್ಯಾಶ್'],
  passbook: ['पासबुक', 'ಪಾಸ್ಬುಕ್'],
  // hospital
  emergency: ['इमरजेंसी', 'इमर्जेंसी', 'एमरजेंसी', 'ಎಮರ್ಜೆನ್ಸಿ'],
  pharmacy: ['फार्मेसी', 'फार्मसी', 'ಫಾರ್ಮಸಿ', 'ಫಾರ್ಮಸಿ'],
  medicine: ['मेडिसिन', 'ಮೆಡಿಸಿನ್'],
  lab: ['लैब', 'लेब', 'ಲ್ಯಾಬ್'],
  test: ['टेस्ट', 'ಟೆಸ್ಟ್'],
  'blood test': ['ब्लड टेस्ट', 'ಬ್ಲಡ್ ಟೆಸ್ಟ್'],
  registration: ['रजिस्ट्रेशन', 'रेजिस्ट्रेशन', 'ರಿಜಿಸ್ಟ್ರೇಶನ್'],
  report: ['रिपोर्ट', 'ರಿಪೋರ್ಟ್'],
  ortho: ['ऑर्थो', 'आर्थो', 'ಆರ್ಥೋ'],
  bone: ['बोन', 'ಬೋನ್'],
  room: ['रूम', 'ರೂಮ್'],
  token: ['टोकन', 'ಟೋಕನ್'],
  // bus
  bus: ['बस', 'ಬಸ್'],
  route: ['रूट', 'ರೂಟ್'],
  next: ['नेक्स्ट', 'ನೆಕ್ಸ್ಟ್'],
  board: ['बोर्ड', 'ಬೋರ್ಡ್'],
  majestic: ['मैजेस्टिक', 'मजेस्टिक', 'ಮೆಜೆಸ್ಟಿಕ್', 'ಮೆಜಸ್ಟಿಕ್'],
  whitefield: ['व्हाइटफील्ड', 'वाइटफील्ड', 'व्हाइट फील्ड', 'ವೈಟ್ಫೀಲ್ಡ್', 'ವೈಟ್ ಫೀಲ್ಡ್'],
  // general
  where: ['व्हेयर', 'वेयर', 'ವೇರ್'],
  read: ['रीड', 'ರೀಡ್'],
  help: ['हेल्प', 'ಹೆಲ್ಪ್'],
  staff: ['स्टाफ', 'ಸ್ಟಾಫ್'],
  manager: ['मैनेजर', 'मेनेजर', 'ಮ್ಯಾನೇಜರ್'],
  // safety (emergency / fraud wording often comes in English)
  'chest pain': ['चेस्ट पेन', 'ಚೆಸ್ಟ್ ಪೇನ್'],
  'heart attack': ['हार्ट अटैक', 'ಹಾರ್ಟ್ ಅಟ್ಯಾಕ್'],
  bleeding: ['ब्लीडिंग', 'ಬ್ಲೀಡಿಂಗ್'],
  'account block': ['अकाउंट ब्लॉक', 'खाता ब्लॉक', 'ಅಕೌಂಟ್ ಬ್ಲಾಕ್'],
  fraud: ['फ्रॉड', 'ಫ್ರಾಡ್'],
  scam: ['स्कैम', 'ಸ್ಕ್ಯಾಮ್'],
  password: ['पासवर्ड', 'ಪಾಸ್ವರ್ಡ್'],
  otp: ['ओटीपी', 'ಒಟಿಪಿ', 'ಓಟಿಪಿ'],
  cvv: ['सीवीवी', 'ಸಿವಿವಿ'],
};

/**
 * Removes spelling noise that speech engines vary on: nukta (फ़/फ, ज़/ज),
 * chandrabindu vs anusvara, and zero-width joiners in Kannada.
 */
export function normaliseIndic(text: string): string {
  return text
    .normalize('NFD')
    .replace(/़/g, '') // Devanagari nukta
    .replace(/ँ/g, 'ं') // chandrabindu → anusvara
    .replace(/[​-‍]/g, '') // zero-width space / (non-)joiners
    .normalize('NFC');
}

const TABLE: ReadonlyArray<readonly [string, string]> = Object.entries(LOANWORDS).flatMap(([en, spellings]) =>
  spellings.map((s) => [normaliseIndic(s), en] as const),
);

/** English equivalents of the loanwords found in already-normalised text, space-separated. */
export function loanwordGloss(normalised: string): string {
  const found = new Set<string>();
  for (const [spelling, en] of TABLE) if (normalised.includes(spelling)) found.add(en);
  return [...found].join(' ');
}
