import type { DocumentContext, DocumentReader } from '../../domain/ports';
import type { AgentReply, LanguageCode, ScriptStyle } from '../../domain/types';

type Variant = { hi: string; hiLatin: string; kn: string; en: string };

/**
 * Offline stand-in for a vision model (MOCK mode). It cannot really see the
 * photo, so it gives the first step for the paper people usually show at
 * each kind of venue, using only venue data.
 */
export class MockDocumentReader implements DocumentReader {
  async read(ctx: DocumentContext): Promise<unknown> {
    if (!ctx.image.base64) return null;
    const { venue } = ctx;

    if (venue.type === 'bank') {
      return this.reply(ctx, 'none', {
        hi: 'यह पैसे जमा करने की पर्ची है। पहले ऊपर दाईं ओर आज की तारीख लिखिए। हो गया?',
        hiLatin: 'Yeh paise jama karne ki parchi hai. Pehle upar daayin taraf aaj ki taareekh likhiye. Ho gaya?',
        kn: 'ಇದು ಹಣ ಜಮಾ ಚೀಟಿ. ಮೊದಲು ಮೇಲೆ ಬಲಭಾಗದಲ್ಲಿ ಇಂದಿನ ದಿನಾಂಕ ಬರೆಯಿರಿ. ಆಯ್ತಾ?',
        en: "This is a cash deposit slip. First write today's date at the top right. Done?",
      });
    }

    if (venue.type === 'hospital') {
      const where = venue.directions.orthopaedics ?? Object.values(venue.directions)[0] ?? '';
      return this.reply(ctx, 'none', {
        hi: `यह OPD पर्ची है। इसमें हड्डी रोग विभाग लिखा है — ${where}। हो गया?`,
        hiLatin: `Yeh OPD parchi hai. Ismein Orthopaedics likha hai — ${where}. Ho gaya?`,
        kn: `ಇದು OPD ಚೀಟಿ. ಇದರಲ್ಲಿ Orthopaedics ಎಂದು ಇದೆ — ${where}. ಆಯ್ತಾ?`,
        en: `This is an OPD slip. It says Orthopaedics — ${where}. Done?`,
      });
    }

    const list = venue.routes.map((r) => `${r.route} → ${r.destination}`).join(', ');
    return this.reply(ctx, 'route', {
      hi: `बोर्ड पर ये बसें हैं: ${list}। आपको कहाँ जाना है?`,
      hiLatin: `Board par yeh buses hain: ${list}. Aapko kahaan jaana hai?`,
      kn: `ಬೋರ್ಡ್‌ನಲ್ಲಿ ಈ ಬಸ್‌ಗಳಿವೆ: ${list}. ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು?`,
      en: `The board shows: ${list}. Where do you want to go?`,
    });
  }

  private reply(ctx: DocumentContext, action: AgentReply['action'], v: Variant): AgentReply {
    return { lang: ctx.language, action, reply: pick(v, ctx.language, ctx.script), replyEnglish: v.en };
  }
}

function pick(v: Variant, lang: LanguageCode, script: ScriptStyle): string {
  if (lang === 'hi') return script === 'latin' ? v.hiLatin : v.hi;
  return v[lang];
}
