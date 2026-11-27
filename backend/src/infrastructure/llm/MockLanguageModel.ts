import { containsAny } from '../../application/guardrails/keywords';
import type { AgentContext, LanguageModel } from '../../domain/ports';
import type { AgentReply, LanguageCode, ScriptStyle } from '../../domain/types';

type Variant = { hi: string; hiLatin: string; kn: string; en: string };

/**
 * Deterministic, keyword-driven stand-in for a real model so the whole app
 * can be demoed and tested without API keys (MOCK mode). It answers only
 * from venue data — it never invents facts.
 */
export class MockLanguageModel implements LanguageModel {
  async generate(ctx: AgentContext): Promise<unknown> {
    const text = `${ctx.userText} ${ctx.intentHints.join(' ')}`;

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
    if (containsAny(text, ['opd', 'slip', 'room', 'doctor', 'kahan', 'कहाँ', 'ಎಲ್ಲಿ', 'elli'])) {
      const where = ctx.venue.directions.orthopaedics ?? Object.values(ctx.venue.directions)[0] ?? '';
      return this.reply(ctx, 'none', {
        hi: `आप हड्डी रोग विभाग जाइए — ${where}। हो गया?`,
        hiLatin: `Aap Orthopaedics jaiye — ${where}. Ho gaya?`,
        kn: `ನೀವು Orthopaedics ಗೆ ಹೋಗಿ — ${where}. ಆಯ್ತಾ?`,
        en: `Go to Orthopaedics — ${where}. Done?`,
      });
    }
    return this.generic(ctx);
  }

  private bus(ctx: AgentContext, text: string): AgentReply {
    const route = ctx.venue.routes.find((r) => containsAny(text, [r.destination]));
    if (route || containsAny(text, ['bus', 'route', 'बस', 'ಬಸ್'])) {
      const r = route ?? ctx.venue.routes[0];
      if (!r) return this.generic(ctx);
      return this.reply(ctx, 'route', {
        hi: `${r.destination} के लिए ${r.route} लीजिए — ${r.etaMinutes} मिनट में आ रही है।`,
        hiLatin: `${r.destination} ke liye ${r.route} lijiye — ${r.etaMinutes} minute mein aa rahi hai.`,
        kn: `${r.destination} ಗೆ ${r.route} ಹತ್ತಿ — ${r.etaMinutes} ನಿಮಿಷದಲ್ಲಿ ಬರುತ್ತದೆ.`,
        en: `For ${r.destination} take ${r.route}, arriving in ${r.etaMinutes} minutes.`,
      });
    }
    return this.generic(ctx);
  }

  private generic(ctx: AgentContext): AgentReply {
    if (containsAny(ctx.userText, ['staff', 'स्टाफ़', 'ಸಿಬ್ಬಂದಿ', 'human', 'insaan'])) {
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
    const tasks = ctx.venue.tasks.map((t) => t.label);
    const list = (k: keyof (typeof tasks)[number]) => tasks.map((t) => t[k]).join(', ');
    return this.reply(ctx, 'none', {
      hi: `मैं इनमें मदद कर सकता हूँ: ${list('hi')}। आपको क्या चाहिए?`,
      hiLatin: `Main inmein madad kar sakta hoon: ${list('en')}. Aapko kya chahiye?`,
      kn: `ನಾನು ಇವುಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಹುದು: ${list('kn')}. ನಿಮಗೆ ಏನು ಬೇಕು?`,
      en: `I can help with: ${list('en')}. What do you need?`,
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
