import { containsAny } from '../../application/guardrails/keywords';
import type { AgentContext, LanguageModel } from '../../domain/ports';
import type { AgentReply, LanguageCode, ScriptStyle, Venue } from '../../domain/types';

type Variant = { hi: string; hiLatin: string; kn: string; en: string };

/** How the assistant introduces where it works. */
const PLACE_NAMES: Record<Venue['type'], Variant> = {
  bank: { hi: 'इस बैंक', hiLatin: 'is bank', kn: 'ಈ ಬ್ಯಾಂಕಿನ', en: 'bank' },
  hospital: { hi: 'इस अस्पताल', hiLatin: 'is hospital', kn: 'ಈ ಆಸ್ಪತ್ರೆಯ', en: 'hospital' },
  bus: { hi: 'इस बस स्टॉप', hiLatin: 'is bus stop', kn: 'ಈ ಬಸ್ ನಿಲ್ದಾಣದ', en: 'bus stop' },
};

/** Department names for hospital directions (keys match venue.directions). */
const DEPARTMENTS: Record<string, { terms: string[]; name: Variant }> = {
  emergency: {
    terms: ['emergency', 'casualty', 'इमरजेंसी', 'ಎಮರ್ಜೆನ್ಸಿ'],
    name: { hi: 'इमरजेंसी', hiLatin: 'Emergency', kn: 'ಎಮರ್ಜೆನ್ಸಿ', en: 'Emergency' },
  },
  pharmacy: {
    terms: ['pharmacy', 'medicine', 'dawai', 'dawa', 'दवाई', 'दवा', 'दवाखाना', 'ಔಷಧ', 'ಔಷಧಾಲಯ'],
    name: { hi: 'दवाखाना', hiLatin: 'Pharmacy', kn: 'ಔಷಧಾಲಯ', en: 'the pharmacy' },
  },
  lab: {
    terms: ['lab', 'blood test', 'test', 'jaanch', 'जाँच', 'जांच', 'ಲ್ಯಾಬ್', 'ರಕ್ತ ಪರೀಕ್ಷೆ'],
    name: { hi: 'खून जाँच लैब', hiLatin: 'Lab', kn: 'ಲ್ಯಾಬ್', en: 'the blood test lab' },
  },
  registration: {
    terms: ['registration', 'register', 'new card', 'panjikaran', 'पंजीकरण', 'रजिस्ट्रेशन', 'ನೋಂದಣಿ'],
    name: { hi: 'पंजीकरण काउंटर', hiLatin: 'Registration counter', kn: 'ನೋಂದಣಿ ಕೌಂಟರ್', en: 'registration' },
  },
  orthopaedics: {
    terms: ['orthopaedics', 'orthopedics', 'ortho', 'bone', 'haddi', 'हड्डी', 'ಮೂಳೆ'],
    name: { hi: 'हड्डी रोग विभाग', hiLatin: 'Orthopaedics', kn: 'Orthopaedics', en: 'Orthopaedics' },
  },
};

/**
 * Deterministic, keyword-driven stand-in for a real model so the whole app
 * can be demoed and tested without API keys (MOCK mode). It answers only
 * from venue data — it never invents facts.
 */
export class MockLanguageModel implements LanguageModel {
  async generate(ctx: AgentContext): Promise<unknown> {
    const text = `${ctx.userText} ${ctx.intentHints.join(' ')}`;
    if (this.wantsStaff(ctx.userText)) return this.staff(ctx);

    switch (ctx.venue.type) {
      case 'bank':
        return this.bank(ctx, text);
      case 'hospital':
        return this.hospital(ctx, text);
      case 'bus':
        return this.bus(ctx, text);
    }
  }

  private bank(ctx: AgentContext, text: string): AgentReply {
    const { directions } = ctx.venue;
    if (containsAny(text, ['kyc', 'केवाईसी', 'address change', 'pata badalna']) && directions.kyc) {
      return this.reply(ctx, 'none', {
        hi: `KYC के लिए ${directions.kyc} जाइए। आधार कार्ड की कॉपी साथ रखिए। हो गया?`,
        hiLatin: `KYC ke liye ${directions.kyc} jaiye. Aadhaar card ki copy saath rakhiye. Ho gaya?`,
        kn: `KYC ಗಾಗಿ ${directions.kyc} ಗೆ ಹೋಗಿ. ಆಧಾರ್ ಕಾರ್ಡ್ ಪ್ರತಿ ಜೊತೆಗಿರಲಿ. ಆಯ್ತಾ?`,
        en: `For KYC go to ${directions.kyc}. Keep a copy of your Aadhaar card. Done?`,
      });
    }
    if (containsAny(text, ['pension', 'life certificate', 'jeevan', 'जीवन प्रमाण', 'ಜೀವನ ಪ್ರಮಾಣ'])) {
      return {
        ...this.reply(ctx, 'handoff', {
          hi: `जीवन प्रमाण पत्र के लिए यह स्क्रीन ${ctx.venue.staffCounter} पर दिखाइए। पेंशन बुक और आधार साथ रखिए।`,
          hiLatin: `Jeevan pramaan ke liye yeh screen ${ctx.venue.staffCounter} par dikhaiye. Pension book aur Aadhaar saath rakhiye.`,
          kn: `ಜೀವನ ಪ್ರಮಾಣ ಪತ್ರಕ್ಕಾಗಿ ಈ ಪರದೆಯನ್ನು ${ctx.venue.staffCounter} ನಲ್ಲಿ ತೋರಿಸಿ. ಪಿಂಚಣಿ ಪುಸ್ತಕ ಮತ್ತು ಆಧಾರ್ ಜೊತೆಗಿರಲಿ.`,
          en: `For the life certificate show this screen at ${ctx.venue.staffCounter}. Keep your pension book and Aadhaar with you.`,
        }),
        handoff: { task: 'Life certificate (pension)', check: 'Verify pensioner identity', language: ctx.language },
      };
    }
    if (containsAny(text, ['withdraw', 'nikalna', 'nikaalna', 'निकालना', 'निकालने', 'ತೆಗೆಯ'])) {
      return this.reply(ctx, 'camera', {
        hi: 'पैसे निकालने के लिए निकासी पर्ची भरनी है। पर्ची की ओर कैमरा कीजिए, मैं हर खाना समझाऊँगा।',
        hiLatin: 'Paise nikaalne ke liye withdrawal slip bharni hai. Slip ki taraf camera kijiye, main har khaana samjhaunga.',
        kn: 'ಹಣ ತೆಗೆಯಲು withdrawal slip ತುಂಬಬೇಕು. ಸ್ಲಿಪ್ ಕಡೆ ಕ್ಯಾಮೆರಾ ಹಿಡಿಯಿರಿ, ಪ್ರತಿ ಬಾಕ್ಸ್ ವಿವರಿಸುತ್ತೇನೆ.',
        en: "To withdraw cash you fill a withdrawal slip. Point the camera at the slip and I'll explain each box.",
      });
    }
    if (containsAny(text, ['deposit', 'jama', 'जमा', 'ಜಮಾ', 'form', 'फ़ॉर्म', 'फॉर्म', 'slip', 'parchi'])) {
      return this.reply(ctx, 'camera', {
        hi: 'ज़रूर। फ़ॉर्म की ओर कैमरा कीजिए, मैं हर खाना पढ़कर समझाऊँगा।',
        hiLatin: 'Zaroor. Form ki taraf camera kijiye, main har khaana padhkar samjhaunga.',
        kn: 'ಖಂಡಿತ. ಫಾರ್ಮ್ ಕಡೆ ಕ್ಯಾಮೆರಾ ಹಿಡಿಯಿರಿ, ಪ್ರತಿ ಬಾಕ್ಸ್ ಓದಿ ವಿವರಿಸುತ್ತೇನೆ.',
        en: "Sure. Point the camera at the form and I'll explain each box.",
      });
    }
    return this.generic(ctx);
  }

  private hospital(ctx: AgentContext, text: string): AgentReply {
    if (containsAny(text, ['read', 'report', 'padhna', 'padho', 'पढ़', 'ಓದ'])) {
      return this.reply(ctx, 'camera', {
        hi: 'पर्ची की ओर कैमरा कीजिए, मैं पढ़कर बताऊँगा कि कहाँ जाना है।',
        hiLatin: 'Parchi ki taraf camera kijiye, main padhkar bataunga ki kahaan jaana hai.',
        kn: 'ಚೀಟಿಯ ಕಡೆ ಕ್ಯಾಮೆರಾ ಹಿಡಿಯಿರಿ, ಓದಿ ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು ಎಂದು ಹೇಳುತ್ತೇನೆ.',
        en: "Point the camera at the slip and I'll read where you need to go.",
      });
    }

    const dept = this.department(ctx.venue, text);
    const generalAsk = containsAny(text, ['opd', 'slip', 'room', 'doctor', 'kahan', 'kahaan', 'कहाँ', 'कहां', 'ಎಲ್ಲಿ', 'elli', 'where']);
    // Demo assumption: an OPD slip with no department named is for Orthopaedics.
    const key = dept ?? (generalAsk ? 'orthopaedics' : null);
    const where = key ? ctx.venue.directions[key] : undefined;
    if (key && where) {
      const n = DEPARTMENTS[key]!.name;
      return this.reply(ctx, 'none', {
        hi: `आप ${n.hi} जाइए — ${where}। हो गया?`,
        hiLatin: `Aap ${n.hiLatin} jaiye — ${where}. Ho gaya?`,
        kn: `ನೀವು ${n.kn} ಗೆ ಹೋಗಿ — ${where}. ಆಯ್ತಾ?`,
        en: `Go to ${n.en} — ${where}. Done?`,
      });
    }
    return this.generic(ctx);
  }

  private bus(ctx: AgentContext, text: string): AgentReply {
    const { routes } = ctx.venue;
    if (containsAny(text, ['board', 'read', 'padhna', 'पढ़', 'ಓದ'])) {
      return this.reply(ctx, 'camera', {
        hi: 'बोर्ड की ओर कैमरा कीजिए, मैं पढ़कर बताऊँगा।',
        hiLatin: 'Board ki taraf camera kijiye, main padhkar bataunga.',
        kn: 'ಬೋರ್ಡ್ ಕಡೆ ಕ್ಯಾಮೆರಾ ಹಿಡಿಯಿರಿ, ಓದಿ ಹೇಳುತ್ತೇನೆ.',
        en: "Point the camera at the board and I'll read it for you.",
      });
    }

    const matching = routes
      .filter((r) => containsAny(text, [r.destination]))
      .sort((a, b) => a.etaMinutes - b.etaMinutes);
    const r = matching[0];
    if (r) {
      return this.reply(ctx, 'route', {
        hi: `${r.destination} के लिए ${r.route} लीजिए — ${r.etaMinutes} मिनट में आ रही है।`,
        hiLatin: `${r.destination} ke liye ${r.route} lijiye — ${r.etaMinutes} minute mein aa rahi hai.`,
        kn: `${r.destination} ಗೆ ${r.route} ಹತ್ತಿ — ${r.etaMinutes} ನಿಮಿಷದಲ್ಲಿ ಬರುತ್ತದೆ.`,
        en: `For ${r.destination} take ${r.route}, arriving in ${r.etaMinutes} minutes.`,
      });
    }

    const busAsk = ['bus', 'route', 'next', 'agli', 'kab', 'which', 'kaunsi', 'बस', 'अगली', 'ಬಸ್', 'ಮುಂದಿನ', 'ಯಾವ'];
    if (routes.length && containsAny(text, busAsk)) {
      // We don't know where they're going (or it isn't served here): list what IS
      // served instead of guessing a route.
      const places = [...new Set(routes.map((x) => x.destination))].join(', ');
      return this.reply(ctx, 'route', {
        hi: `यहाँ से बसें ${places} जाती हैं। आपको कहाँ जाना है? दूसरी जगह के लिए ${ctx.venue.tollFree} पर कॉल कीजिए।`,
        hiLatin: `Yahaan se buses ${places} jaati hain. Aapko kahaan jaana hai? Doosri jagah ke liye ${ctx.venue.tollFree} par call kijiye.`,
        kn: `ಇಲ್ಲಿಂದ ಬಸ್‌ಗಳು ${places} ಗೆ ಹೋಗುತ್ತವೆ. ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು? ಬೇರೆ ಸ್ಥಳಕ್ಕೆ ${ctx.venue.tollFree} ಗೆ ಕರೆ ಮಾಡಿ.`,
        en: `Buses from here go to ${places}. Where do you want to go? For other places call ${ctx.venue.tollFree}.`,
      });
    }
    return this.generic(ctx);
  }

  private department(venue: Venue, text: string): string | null {
    for (const [key, d] of Object.entries(DEPARTMENTS)) {
      if (venue.directions[key] && (containsAny(text, d.terms) || containsAny(text, [key]))) return key;
    }
    return null;
  }

  private wantsStaff(text: string): boolean {
    return containsAny(text, ['staff', 'स्टाफ़', 'स्टाफ', 'ಸಿಬ್ಬಂದಿ', 'human', 'insaan', 'manager', 'मैनेजर']);
  }

  private staff(ctx: AgentContext): AgentReply {
    return {
      ...this.reply(ctx, 'handoff', {
        hi: `ठीक है। यह स्क्रीन ${ctx.venue.staffCounter} पर दिखाइए।`,
        hiLatin: `Theek hai. Yeh screen ${ctx.venue.staffCounter} par dikhaiye.`,
        kn: `ಸರಿ. ಈ ಪರದೆಯನ್ನು ${ctx.venue.staffCounter} ನಲ್ಲಿ ತೋರಿಸಿ.`,
        en: `Okay. Show this screen at ${ctx.venue.staffCounter}.`,
      }),
      handoff: { task: 'Asked for staff', check: 'Assist customer', language: ctx.language },
    };
  }

  private generic(ctx: AgentContext): AgentReply {
    const tasks = ctx.venue.tasks.map((t) => t.label);
    const list = (k: keyof (typeof tasks)[number]) => tasks.map((t) => t[k]).join(', ');
    const p = PLACE_NAMES[ctx.venue.type];
    return this.reply(ctx, 'fallback', {
      hi: `मैं ${p.hi} का सहायक हूँ। मैं इनमें मदद कर सकता हूँ: ${list('hi')}। नीचे से चुनिए या बोलिए।`,
      hiLatin: `Main ${p.hiLatin} ka sahayak hoon. Main inmein madad kar sakta hoon: ${list('en')}. Neeche se chuniye ya boliye.`,
      kn: `ನಾನು ${p.kn} ಸಹಾಯಕ. ನಾನು ಇವುಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಹುದು: ${list('kn')}. ಕೆಳಗಿನಿಂದ ಆಯ್ಕೆ ಮಾಡಿ ಅಥವಾ ಹೇಳಿ.`,
      en: `I'm the help assistant for this ${p.en}. I can help with: ${list('en')}. Pick one below or say it.`,
    });
  }

  private reply(ctx: AgentContext, action: AgentReply['action'], v: Variant): AgentReply {
    return { lang: ctx.language, action, reply: pick(v, ctx.language, ctx.script), replyEnglish: v.en };
  }
}

function pick(v: Variant, lang: LanguageCode, script: ScriptStyle): string {
  if (lang === 'hi') return script === 'latin' ? v.hiLatin : v.hi;
  return v[lang];
}
