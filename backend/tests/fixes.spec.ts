import path from 'node:path';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { CredentialGuardrail } from '../src/application/guardrails/inputGuardrails';
import { OutputSafetyFilter } from '../src/application/guardrails/OutputSafetyFilter';
import { LanguageRequestDetector } from '../src/application/policies/LanguageRequestDetector';
import { loadConfig } from '../src/config';
import { buildContainer } from '../src/container';
import type { DocumentReader, LanguageModel } from '../src/domain/ports';
import { createSession } from '../src/domain/session';
import type { Venue } from '../src/domain/types';
import { ScriptLanguageDetector } from '../src/infrastructure/language/ScriptLanguageDetector';
import { InMemorySessionStore } from '../src/infrastructure/session/InMemorySessionStore';
import { createApp } from '../src/interfaces/http/createApp';

const config = loadConfig({ LLM_PROVIDER: 'mock', VENUES_DIR: path.resolve(import.meta.dirname, '../data/venues') });
const BANK = 'BLR-JNR-DEP-02';
const HOSPITAL = 'HOSP-OPD-01';
const BUS = 'BUS-JN4B-N';
/** A tiny but valid-looking base64 payload (content is irrelevant to the mock). */
const IMAGE = { mediaType: 'image/jpeg', base64: 'A'.repeat(200) };

let n = 0;
const sid = () => `fix-session-${++n}-${Date.now()}`;

function setup(overrides: Parameters<typeof buildContainer>[1] = {}) {
  return createApp(buildContainer(config, overrides));
}

async function turn(app: ReturnType<typeof setup>, body: Record<string, unknown>) {
  const res = await request(app).post('/api/turn').send(body);
  expect(res.status).toBe(200);
  return res.body;
}

describe('language: explicit requests and menu choice', () => {
  it('"mere ko Hindi mein chahie" switches an English session to Hindi immediately', async () => {
    const app = setup();
    const sessionId = sid();
    const first = await turn(app, { sessionId, venueCode: BUS, text: 'Whitefield bus' });
    expect(first.sessionLanguage).toBe('en');
    const second = await turn(app, { sessionId, venueCode: BUS, text: 'response mere ko Hindi mein chahie' });
    expect(second.sessionLanguage).toBe('hi');
    expect(second.source).toBe('policy');
    expect(second.reply.lang).toBe('hi');
    expect(second.reply.replyEnglish).toMatch(/speak Hindi now/);
    expect(second.reply.reply).toMatch(/[ऀ-ॿ]/); // proper Devanagari, not romanised
  });

  it('"ಕನ್ನಡದಲ್ಲಿ ಹೇಳಿ" switches to Kannada; the next English question still gets Kannada', async () => {
    const app = setup();
    const sessionId = sid();
    await turn(app, { sessionId, venueCode: BUS, text: 'which bus to Majestic' });
    const switched = await turn(app, { sessionId, venueCode: BUS, text: 'ಕನ್ನಡದಲ್ಲಿ ಹೇಳಿ' });
    expect(switched.sessionLanguage).toBe('kn');
    const next = await turn(app, { sessionId, venueCode: BUS, text: 'Majestic bus' });
    expect(next.sessionLanguage).toBe('kn');
    expect(next.reply.reply).toMatch(/[ಀ-೿]/);
  });

  it('a request inside a real question switches language AND answers the question', async () => {
    const app = setup();
    const body = await turn(app, { sessionId: sid(), venueCode: BUS, text: 'please tell me in Hindi which bus goes to Majestic today' });
    expect(body.sessionLanguage).toBe('hi');
    expect(body.reply.action).toBe('route');
  });

  it('preferredLanguage (menu / button) beats detection of English button text', async () => {
    const app = setup();
    const body = await turn(app, { sessionId: sid(), venueCode: BANK, text: 'I want to talk to staff', preferredLanguage: 'kn' });
    expect(body.sessionLanguage).toBe('kn');
    expect(body.reply.reply).toMatch(/[ಀ-೿]/);
  });

  it('detector: Hinglish with "chahie/mere/ko" is Hindi; "where is the main gate" stays English', () => {
    const d = new ScriptLanguageDetector();
    expect(d.detect('response mere ko Hindi mein chahie').lang).toBe('hi');
    expect(d.detect('where is the main gate').lang).toBe('en');
  });

  it('request detector ignores a passing mention of a language', () => {
    const r = new LanguageRequestDetector();
    expect(r.detect('Hindi')).toBe('hi');
    expect(r.detect('English mein bolo')).toBe('en');
    expect(r.detect('my son studies the english textbook every evening')).toBeNull();
    expect(r.detect('Hindi or English?')).toBeNull();
  });
});

describe('safety fixes', () => {
  it('Kannada emergency in a Hindi session is answered in Kannada', async () => {
    const app = setup();
    const sessionId = sid();
    await turn(app, { sessionId, venueCode: HOSPITAL, text: 'OPD kahan hai' });
    const body = await turn(app, { sessionId, venueCode: HOSPITAL, text: 'ಎದೆ ನೋವು' });
    expect(body.reply.action).toBe('emergency');
    expect(body.reply.lang).toBe('kn');
    expect(body.reply.reply).toMatch(/[ಀ-೿]/);
  });

  it('postal "PIN code" is not treated as a secret PIN; a real PIN still is', () => {
    const g = new CredentialGuardrail();
    const ctx = { venue: {} as Venue, language: 'hi' as const, script: 'latin' as const };
    expect(g.check({ ...ctx, text: 'KYC form mein pin code kya likhun' })).toBeNull();
    expect(g.check({ ...ctx, text: 'पिन कोड कहाँ लिखूँ' })).toBeNull();
    expect(g.check({ ...ctx, text: 'ATM PIN bhool gaya' })).not.toBeNull();
  });

  it('output filter: "do not worry" in one sentence does not excuse asking for the OTP in another', () => {
    const f = new OutputSafetyFilter();
    const ctx = { venue: { staffCounter: 'Counter 3' } as Venue, language: 'en' as const, script: 'latin' as const, text: '' };
    const bad = { lang: 'en' as const, action: 'none' as const, reply: 'Do not worry. Tell me the OTP you got.', replyEnglish: 'Do not worry. Tell me the OTP you got.' };
    expect(f.filter(bad, ctx).action).toBe('handoff');
  });

  it('blocked reply keeps the user\'s script (romanised Hindi stays romanised)', () => {
    const f = new OutputSafetyFilter();
    const ctx = { venue: { staffCounter: 'Counter 3' } as Venue, language: 'hi' as const, script: 'latin' as const, text: '' };
    const bad = { lang: 'hi' as const, action: 'none' as const, reply: 'OTP bataiye', replyEnglish: 'Tell me the OTP' };
    expect(f.filter(bad, ctx).reply).toMatch(/^Main aapko staff/);
  });
});

describe('mock answers only from venue data', () => {
  it('unknown destination → lists served places instead of inventing a route', async () => {
    const body = await turn(setup(), { sessionId: sid(), venueCode: BUS, text: 'which bus to Shivajinagar' });
    expect(body.reply.action).toBe('route');
    expect(body.reply.replyEnglish).toMatch(/Majestic, Whitefield/);
    expect(body.reply.replyEnglish).not.toMatch(/take 14B/);
  });

  it('hospital: "pharmacy kahan hai" → pharmacy, not Orthopaedics', async () => {
    const body = await turn(setup(), { sessionId: sid(), venueCode: HOSPITAL, text: 'pharmacy kahan hai' });
    expect(body.reply.replyEnglish).toMatch(/Pharmacy, ground floor/);
  });

  it('bank: KYC → KYC counter', async () => {
    const body = await turn(setup(), { sessionId: sid(), venueCode: BANK, text: 'Update KYC', preferredLanguage: 'en' });
    expect(body.reply.replyEnglish).toMatch(/Counter 5/);
  });
});

describe('HTTP hardening', () => {
  it('malformed JSON → 400 invalid_json (was 500)', async () => {
    const res = await request(setup()).post('/api/turn').set('content-type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_json');
  });

  it('oversized turn body → 413', async () => {
    const res = await request(setup()).post('/api/turn').send({ sessionId: sid(), venueCode: BANK, text: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
  });

  it('unknown API path → JSON 404', async () => {
    const res = await request(setup()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

describe('POST /api/document (Show form)', () => {
  it('explains the photo in the session language (mock)', async () => {
    const app = setup();
    const sessionId = sid();
    await turn(app, { sessionId, venueCode: BANK, text: 'मुझे पैसे जमा करने हैं' });
    const res = await request(app).post('/api/document').send({ sessionId, venueCode: BANK, image: IMAGE });
    expect(res.status).toBe(200);
    expect(res.body.reply.lang).toBe('hi');
    expect(res.body.reply.reply).toMatch(/[ऀ-ॿ]/);
    expect(res.body.maskedText).toBe('[PHOTO]');
  });

  it('bus board photo → route action with routes attached', async () => {
    const res = await request(setup()).post('/api/document').send({ sessionId: sid(), venueCode: BUS, image: IMAGE, preferredLanguage: 'en' });
    expect(res.body.reply.action).toBe('route');
    expect(res.body.reply.routes.length).toBeGreaterThan(0);
  });

  it('masks account numbers the reader copies off the paper', async () => {
    const reader: DocumentReader = {
      read: async () => ({ lang: 'en', action: 'none', reply: 'Your account 12345678901 is filled in.', replyEnglish: 'Your account 12345678901 is filled in.' }),
    };
    const res = await request(setup({ reader })).post('/api/document').send({ sessionId: sid(), venueCode: BANK, image: IMAGE, preferredLanguage: 'en' });
    expect(res.body.reply.reply).toContain('[ACCOUNT]');
    expect(JSON.stringify(res.body)).not.toContain('12345678901');
  });

  it('reader failing twice → ask for a clearer photo', async () => {
    const read = vi.fn(async () => { throw new Error('boom'); });
    const res = await request(setup({ reader: { read } })).post('/api/document').send({ sessionId: sid(), venueCode: BANK, image: IMAGE, preferredLanguage: 'en' });
    expect(read).toHaveBeenCalledTimes(2);
    expect(res.body.source).toBe('fallback');
    expect(res.body.reply.action).toBe('camera');
  });

  it('rejects data-URL prefixes and non-image types without echoing the image', async () => {
    const app = setup();
    const res = await request(app).post('/api/document').send({
      sessionId: sid(), venueCode: BANK, image: { mediaType: 'image/gif', base64: `data:image/gif;base64,${'A'.repeat(200)}` },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('AAAA');
  });

  it('the photo turn is visible to the next model call as [PHOTO], never as image data', async () => {
    const generate = vi.fn<LanguageModel['generate']>(async () => ({ lang: 'en', action: 'none', reply: 'Ok.', replyEnglish: 'Ok.' }));
    const app = setup({ model: { generate } });
    const sessionId = sid();
    await request(app).post('/api/document').send({ sessionId, venueCode: BANK, image: IMAGE, preferredLanguage: 'en' });
    await turn(app, { sessionId, venueCode: BANK, text: 'what next' });
    const history = generate.mock.calls[0]![0].history;
    expect(history[0]).toEqual({ role: 'user', text: '[PHOTO]' });
  });
});

describe('InMemorySessionStore', () => {
  it('sweeps expired sessions instead of keeping them forever', () => {
    let now = 0;
    const store = new InMemorySessionStore(1000, () => now, 100, 10);
    store.save(createSession('a', 'v'));
    now = 5000;
    store.save(createSession('b', 'v'));
    expect(store.size).toBe(1);
  });

  it('evicts the least recently used session beyond the cap', () => {
    let now = 0;
    const store = new InMemorySessionStore(60_000, () => now++, 2);
    store.save(createSession('a', 'v'));
    store.save(createSession('b', 'v'));
    store.save(createSession('a', 'v')); // touch a
    store.save(createSession('c', 'v'));
    expect(store.get('b')).toBeUndefined();
    expect(store.get('a')).toBeDefined();
  });
});

describe('venue scope: questions about another place', () => {
  it('post office question at the hospital → honest "not here", model never called', async () => {
    const generate = vi.fn<LanguageModel['generate']>();
    const app = setup({ model: { generate } });
    const body = await turn(app, {
      sessionId: sid(),
      venueCode: HOSPITAL,
      text: 'यह बहुत दिक्कत है मेरे को इधर क्या करना है पोस्ट ऑफिस में',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(body.source).toBe('policy');
    expect(body.reply.action).toBe('fallback');
    expect(body.reply.reply).toContain('डाकघर');
    expect(body.reply.replyEnglish).toMatch(/can't help with the post office/);
    expect(body.reply.replyEnglish).not.toMatch(/Go to Orthopaedics/);
  });

  it('works in English and Kannada too', async () => {
    const app = setup();
    const en = await turn(app, { sessionId: sid(), venueCode: BUS, text: 'where is the railway station', preferredLanguage: 'en' });
    expect(en.reply.reply).toMatch(/can't help with the railway station/);
    const kn = await turn(app, { sessionId: sid(), venueCode: BANK, text: 'ಅಂಚೆ ಕಚೇರಿ ಎಲ್ಲಿ' });
    expect(kn.reply.lang).toBe('kn');
    expect(kn.reply.reply).toContain('ಅಂಚೆ ಕಚೇರಿ');
  });

  it('does not block questions that also name this venue\'s own tasks', async () => {
    const app = setup();
    const body = await turn(app, { sessionId: sid(), venueCode: HOSPITAL, text: 'police ne bheja, pharmacy kahan hai' });
    expect(body.reply.replyEnglish).toMatch(/Pharmacy, ground floor/);
  });

  it('own-venue words are never out of scope (bank at the bank)', async () => {
    const body = await turn(setup(), { sessionId: sid(), venueCode: BANK, text: 'bank mein paise jama karne hain' });
    expect(body.reply.action).toBe('camera');
  });
});

describe('speech-recognised loanwords (English words in Indic script)', () => {
  it('matches "हॉस्पिटल ओपीडी" as hospital/opd and normalises nukta', async () => {
    const { containsAny } = await import('../src/application/guardrails/keywords');
    expect(containsAny('ठीक है मेरे को हॉस्पिटल ओपीडी में', ['hospital'])).toBe(true);
    expect(containsAny('ठीक है मेरे को हॉस्पिटल ओपीडी में', ['opd'])).toBe(true);
    expect(containsAny('फ़ॉर्म भरना है', ['फॉर्म'])).toBe(true);
    expect(containsAny('ಫಾರ್ಮ್ ತುಂಬಬೇಕು', ['form'])).toBe(true);
    expect(containsAny('बस इतना बताओ', ['hospital', 'opd'])).toBe(false);
  });

  it('at the bank, "मेरे को हॉस्पिटल ओपीडी में" gets the not-here reply, not bank tasks', async () => {
    const app = setup();
    const res = await request(app)
      .post('/api/turn')
      .send({ sessionId: 'loanword-1', venueCode: 'BLR-JNR-DEP-02', text: 'ठीक है मेरे को हॉस्पिटल ओपीडी में' });
    expect(res.status).toBe(200);
    expect(res.body.reply.action).toBe('fallback');
    expect(res.body.reply.reply).toContain('अस्पताल');
  });

  it('understands Hindi-script English task words at the bank and hospital', async () => {
    const app = setup();
    const kyc = await request(app).post('/api/turn').send({ sessionId: 'loanword-2', venueCode: 'BLR-JNR-DEP-02', text: 'मुझे केवाईसी करवाना है' });
    expect(kyc.body.reply.reply).toContain('KYC');
    const opd = await request(app).post('/api/turn').send({ sessionId: 'loanword-3', venueCode: 'HOSP-OPD-01', text: 'ओपीडी किधर है' });
    expect(opd.body.reply.action).toBe('none');
    const bus = await request(app).post('/api/turn').send({ sessionId: 'loanword-4', venueCode: 'BUS-JN4B-N', text: 'व्हाइटफील्ड के लिए कौन सी बस' });
    expect(bus.body.reply.reply).toContain('21A');
  });

  it('answers "what are you doing" with who it is plus the task list', async () => {
    const app = setup();
    const res = await request(app).post('/api/turn').send({ sessionId: 'loanword-5', venueCode: 'BLR-JNR-DEP-02', text: 'आप क्या कर रहे हो अभी' });
    expect(res.body.reply.reply).toContain('सहायक');
  });
});

describe('free OpenAI-compatible providers (Gemini / Groq / Ollama)', () => {
  const okReply = { lang: 'hi', reply: 'KYC के लिए Counter 5 जाइए। हो गया?', replyEnglish: 'Go to Counter 5 for KYC. Done?', action: 'none' };

  function fakeFetch(body: unknown, status = 200) {
    return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    );
  }

  it('loads presets and reports a missing key by env-var name', async () => {
    const { loadConfig: load, configProblem } = await import('../src/config');
    const gemini = load({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' });
    expect(gemini.openai?.baseUrl).toContain('generativelanguage.googleapis.com');
    expect(gemini.model).toBe('gemini-flash-latest');
    expect(configProblem(gemini, {})).toBeNull();
    expect(configProblem(load({ LLM_PROVIDER: 'groq' }), {})).toContain('GROQ_API_KEY');
    expect(configProblem(load({ LLM_PROVIDER: 'ollama' }), {})).toBeNull();
    expect(load({ LLM_PROVIDER: 'groq', GROQ_API_KEY: 'k', LLM_MODEL: 'x' }).model).toBe('x');
    expect(() => load({ LLM_PROVIDER: 'nope' })).toThrow();
  });

  it('sends JSON mode + bearer key and parses fenced JSON replies', async () => {
    const { OpenAICompatibleModel } = await import('../src/infrastructure/llm/OpenAICompatibleModel');
    const { PromptBuilder } = await import('../src/infrastructure/llm/PromptBuilder');
    const fetchMock = fakeFetch({ choices: [{ message: { content: '```json\n' + JSON.stringify(okReply) + '\n```' } }] });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const app = setup({ model: new OpenAICompatibleModel(new PromptBuilder(), { baseUrl: 'https://llm.test/v1/', apiKey: 'secret', model: 'm1' }) });
      const body = await turn(app, { sessionId: sid(), venueCode: 'BLR-JNR-DEP-02', text: 'mujhe kyc update karna hai' });
      expect(body.reply.reply).toContain('Counter 5');
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(String(url)).toBe('https://llm.test/v1/chat/completions');
      expect((init!.headers as Record<string, string>).authorization).toBe('Bearer secret');
      const sent = JSON.parse(String(init!.body));
      expect(sent.model).toBe('m1');
      expect(sent.response_format).toEqual({ type: 'json_object' });
      expect(sent.messages[0].content).toContain('OUTPUT FORMAT');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends photos as a data URL to the vision model', async () => {
    const { OpenAICompatibleModel } = await import('../src/infrastructure/llm/OpenAICompatibleModel');
    const { PromptBuilder } = await import('../src/infrastructure/llm/PromptBuilder');
    const fetchMock = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ...okReply, action: 'camera' }) } }] });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const m = new OpenAICompatibleModel(new PromptBuilder(), { baseUrl: 'https://llm.test/v1', model: 'text', visionModel: 'vision' });
      const res = await request(setup({ reader: m })).post('/api/document').send({ sessionId: sid(), venueCode: 'BLR-JNR-DEP-02', image: IMAGE });
      expect(res.status).toBe(200);
      const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
      expect(sent.model).toBe('vision');
      expect(sent.messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to the demo model on a rate limit or junk reply, without leaking the key', async () => {
    const { FallbackLanguageModel, OpenAICompatibleModel } = await import('../src/infrastructure/llm/OpenAICompatibleModel');
    const { PromptBuilder } = await import('../src/infrastructure/llm/PromptBuilder');
    const { MockLanguageModel } = await import('../src/infrastructure/llm/MockLanguageModel');
    const logs: string[] = [];
    const model = new FallbackLanguageModel(
      new OpenAICompatibleModel(new PromptBuilder(), { baseUrl: 'https://llm.test/v1', apiKey: 'secret', model: 'm1' }),
      new MockLanguageModel(),
      (m) => logs.push(m),
    );
    for (const [body, status] of [[{ error: { message: 'quota exceeded' } }, 429], ['{"choices":[{"message":{"content":"not json"}}]}', 200]] as const) {
      vi.stubGlobal('fetch', fakeFetch(body, status));
      try {
        const res = await turn(setup({ model }), { sessionId: sid(), venueCode: 'BLR-JNR-DEP-02', text: 'mujhe kyc update karna hai' });
        expect(res.reply.reply).toContain('KYC'); // answered by the demo model, not a staff hand-off
      } finally {
        vi.unstubAllGlobals();
      }
    }
    expect(logs.join('\n')).toContain('429');
    expect(logs.join('\n')).not.toContain('secret');
  });
});

describe('small local model replies (Ollama)', () => {
  it('fills missing action/lang/replyEnglish but never invents a reply', async () => {
    const { fillDefaults } = await import('../src/infrastructure/llm/OpenAICompatibleModel');
    const { parseAgentReply } = await import('../src/application/replySchema');
    const filled = fillDefaults({ lang: 'hi', reply: 'माफ़ कीजिए, मैं केवल इस बैंक में मदद कर सकता हूँ।', replyEnglish: 'Sorry.' }, 'hi');
    expect(parseAgentReply(filled)).toMatchObject({ action: 'none', lang: 'hi' });
    expect(parseAgentReply(fillDefaults({ reply: 'Go to Counter 5.', action: 'weird' }, 'en'))).toMatchObject({ action: 'none', lang: 'en', replyEnglish: 'Go to Counter 5.' });
    expect(parseAgentReply(fillDefaults({ lang: 'hi', action: 'none' }, 'hi'))).toBeNull();
  });

  it('defaults to gemma3:4b with a longer timeout and no key', async () => {
    const { loadConfig: load, configProblem } = await import('../src/config');
    const c = load({ LLM_PROVIDER: 'ollama' });
    expect(c.model).toBe('gemma3:4b');
    expect(c.openai?.timeoutMs).toBe(15_000);
    expect(configProblem(c, {})).toBeNull();
  });
});

describe('local model warm-up', () => {
  it('opening a help page starts loading the model', async () => {
    const warmUp = vi.fn();
    const app = createApp({ ...buildContainer(config), warmUp });
    await request(app).get('/api/venues/BLR-JNR-DEP-02').expect(200);
    await request(app).get('/api/venues/NOPE-0000').expect(404);
    expect(warmUp).toHaveBeenCalledTimes(1);
  });
});
