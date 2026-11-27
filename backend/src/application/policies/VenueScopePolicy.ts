import type { Session } from '../../domain/session';
import type { AgentReply, Venue } from '../../domain/types';
import { containsAny } from '../guardrails/keywords';
import { phrase } from '../messages';

type Place = { terms: readonly string[]; name: { hi: string; kn: string; en: string } };

/**
 * Places people ask about that a help point does NOT serve. Each QR poster
 * belongs to one venue; asking the hospital point about the post office must
 * get an honest "not here" — not a list of hospital tasks.
 */
const PLACES: Record<string, Place> = {
  bank: {
    terms: ['bank', 'atm', 'passbook', 'cheque', 'बैंक', 'एटीएम', 'पासबुक', 'ಬ್ಯಾಂಕ್', 'ಎಟಿಎಂ'],
    name: { hi: 'बैंक', kn: 'ಬ್ಯಾಂಕ್', en: 'the bank' },
  },
  hospital: {
    terms: ['hospital', 'doctor', 'opd', 'clinic', 'aspatal', 'अस्पताल', 'डॉक्टर', 'ಆಸ್ಪತ್ರೆ', 'ವೈದ್ಯ'],
    name: { hi: 'अस्पताल', kn: 'ಆಸ್ಪತ್ರೆ', en: 'the hospital' },
  },
  bus: {
    terms: ['bus stop', 'bus stand', 'bus depot', 'बस स्टॉप', 'बस अड्डा', 'ಬಸ್ ನಿಲ್ದಾಣ'],
    name: { hi: 'बस स्टॉप', kn: 'ಬಸ್ ನಿಲ್ದಾಣ', en: 'the bus stop' },
  },
  postOffice: {
    terms: [
      'post office', 'postoffice', 'speed post', 'india post', 'parcel', 'money order', 'dak ghar', 'daakghar', 'dakghar',
      'पोस्ट ऑफिस', 'पोस्ट ऑफ़िस', 'पोस्टऑफिस', 'डाकघर', 'डाक घर', 'स्पीड पोस्ट', 'मनी ऑर्डर',
      'ಅಂಚೆ', 'ಪೋಸ್ಟ್ ಆಫೀಸ್', 'ಅಂಚೆ ಕಚೇರಿ',
    ],
    name: { hi: 'डाकघर', kn: 'ಅಂಚೆ ಕಚೇರಿ', en: 'the post office' },
  },
  railway: {
    terms: ['railway', 'train', 'irctc', 'platform', 'रेलवे', 'ट्रेन', 'रेल', 'ರೈಲು', 'ರೈಲ್ವೆ'],
    name: { hi: 'रेलवे स्टेशन', kn: 'ರೈಲು ನಿಲ್ದಾಣ', en: 'the railway station' },
  },
  police: {
    terms: ['police', 'fir', 'thana', 'पुलिस', 'थाना', 'ಪೊಲೀಸ್', 'ಠಾಣೆ'],
    name: { hi: 'पुलिस थाना', kn: 'ಪೊಲೀಸ್ ಠಾಣೆ', en: 'the police station' },
  },
  ration: {
    terms: ['ration', 'ration card', 'राशन', 'ರೇಷನ್', 'ಪಡಿತರ'],
    name: { hi: 'राशन दुकान', kn: 'ಪಡಿತರ ಅಂಗಡಿ', en: 'the ration shop' },
  },
  passport: {
    terms: ['passport', 'पासपोर्ट', 'ಪಾಸ್‌ಪೋರ್ಟ್', 'ಪಾಸ್ಪೋರ್ಟ್'],
    name: { hi: 'पासपोर्ट ऑफिस', kn: 'ಪಾಸ್‌ಪೋರ್ಟ್ ಕಚೇರಿ', en: 'the passport office' },
  },
};

export class VenueScopePolicy {
  /** Returns an honest "not at this help point" reply, or null if the question fits this venue. */
  evaluate(session: Session, venue: Venue, text: string, intentHints: string[]): AgentReply | null {
    const other = Object.entries(PLACES).find(
      ([type, place]) => type !== venue.type && containsAny(text, place.terms),
    );
    if (!other) return null;
    if (this.mentionsThisVenue(venue, text, intentHints)) return null; // e.g. "bank ka form" at the bank

    const { language: lang, script } = session;
    const place = other[1].name;
    const tasks = venue.tasks.map((t) => (lang === 'en' || script === 'latin' ? t.label.en : t.label[lang])).join(', ');
    return {
      lang,
      action: 'fallback',
      ...phrase('outOfScope', lang, script, {
        place: lang === 'en' || script === 'latin' ? place.en.replace(/^the /, '') : place[lang],
        placeEn: place.en,
        venue: venue.name,
        tasks,
        tasksEn: venue.tasks.map((t) => t.label.en).join(', '),
      }),
    };
  }

  private mentionsThisVenue(venue: Venue, text: string, intentHints: string[]): boolean {
    if (intentHints.length > 0) return true;
    const own = PLACES[venue.type]?.terms ?? [];
    const taskWords = venue.tasks.flatMap((t) => [t.label.en, t.label.hi, t.label.kn]);
    const directionWords = Object.keys(venue.directions);
    return containsAny(text, [...own, ...taskWords, ...directionWords]);
  }
}
