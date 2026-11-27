import path from 'node:path';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { buildContainer } from '../src/container';
import type { AgentContext, LanguageModel } from '../src/domain/ports';
import { MockLanguageModel } from '../src/infrastructure/llm/MockLanguageModel';
import { createApp } from '../src/interfaces/http/createApp';

const config = loadConfig({
  LLM_PROVIDER: 'mock',
  VENUES_DIR: path.resolve(import.meta.dirname, '../data/venues'),
});

const BANK = 'BLR-JNR-DEP-02';
const HOSPITAL = 'HOSP-OPD-01';
const BUS = 'BUS-JN4B-N';

/** Wraps a model so tests can see whether (and with what) it was called. */
function spyModel(inner: LanguageModel = new MockLanguageModel()) {
  const generate = vi.fn((ctx: AgentContext) => inner.generate(ctx));
  return { model: { generate } satisfies LanguageModel, generate };
}

function setup(model?: LanguageModel) {
  const container = buildContainer(config, model ? { model } : {});
  return createApp(container);
}

let counter = 0;
const newSession = () => `test-session-${++counter}-${Date.now()}`;

async function turn(app: ReturnType<typeof setup>, body: Record<string, unknown>) {
  const res = await request(app).post('/api/turn').send(body);
  expect(res.status).toBe(200);
  return res.body;
}

describe('Bolo Sahayak acceptance tests', () => {
  it('1. Hindi deposit request → Hindi reply, camera action', async () => {
    const app = setup();
    const body = await turn(app, { sessionId: newSession(), venueCode: BANK, text: 'मुझे पैसे जमा करने हैं' });
    expect(body.reply.lang).toBe('hi');
    expect(body.reply.action).toBe('camera');
    expect(body.reply.reply).toMatch(/[ऀ-ॿ]/);
  });

  it('2. Kannada-English OPD question → Kannada reply with a room number', async () => {
    const app = setup();
    const body = await turn(app, { sessionId: newSession(), venueCode: HOSPITAL, text: 'OPD slip ಇದೆ, ಎಲ್ಲಿಗೆ ಹೋಗ್ಬೇಕು?' });
    expect(body.reply.lang).toBe('kn');
    expect(body.reply.reply).toMatch(/[ಀ-೿]/);
    expect(body.reply.reply).toMatch(/Room \d+/);
  });

  it('3. Hinglish bus question → route action with Hinglish reply', async () => {
    const app = setup();
    const body = await turn(app, { sessionId: newSession(), venueCode: BUS, text: 'Majestic ke liye kaunsi bus?' });
    expect(body.reply.action).toBe('route');
    expect(body.reply.reply).toMatch(/ke liye 14B/);
    expect(body.reply.routes.length).toBeGreaterThan(0);
  });

  it('4. OTP mention → fixed refusal, model never called', async () => {
    const { model, generate } = spyModel();
    const app = setup(model);
    const body = await turn(app, { sessionId: newSession(), venueCode: BANK, text: 'OTP aaya hai, bataun?' });
    expect(body.source).toBe('guardrail');
    expect(body.reply.reply).toMatch(/OTP/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('5. 11-digit account number → masked as [ACCOUNT] before the model sees it', async () => {
    const { model, generate } = spyModel();
    const app = setup(model);
    const body = await turn(app, {
      sessionId: newSession(),
      venueCode: BANK,
      text: 'mera account number 12345678901 hai',
    });
    expect(body.maskedText).toContain('[ACCOUNT]');
    expect(body.maskedText).not.toContain('12345678901');
    const seen = generate.mock.calls[0]![0].userText;
    expect(seen).toContain('[ACCOUNT]');
    expect(seen).not.toMatch(/\d{9,}/);
  });

  it('6. Emergency words → emergency banner, model never called', async () => {
    const { model, generate } = spyModel();
    const app = setup(model);
    const body = await turn(app, { sessionId: newSession(), venueCode: HOSPITAL, text: 'सीने में दर्द हो रहा है' });
    expect(body.reply.action).toBe('emergency');
    expect(body.reply.replyEnglish).toMatch(/108/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('7. Low-confidence transcript → confirm with yes/no', async () => {
    const app = setup();
    const body = await turn(app, {
      sessionId: newSession(),
      venueCode: BANK,
      text: 'paise jama',
      sttConfidence: 0.4,
    });
    expect(body.reply.action).toBe('confirm');
  });

  it('8. Two failed turns in a row → pictogram fallback with toll-free number', async () => {
    const app = setup();
    const sessionId = newSession();
    await turn(app, { sessionId, venueCode: BANK, text: 'mmm', sttConfidence: 0.3 });
    const body = await turn(app, { sessionId, venueCode: BANK, text: 'hmm', sttConfidence: 0.2 });
    expect(body.reply.action).toBe('fallback');
    expect(body.reply.replyEnglish).toContain('1800');
  });

  it('9. Session language switches only after 2 consecutive utterances', async () => {
    const app = setup();
    const sessionId = newSession();
    const first = await turn(app, { sessionId, venueCode: BANK, text: 'मुझे पैसे जमा करने हैं' });
    expect(first.sessionLanguage).toBe('hi');
    const second = await turn(app, { sessionId, venueCode: BANK, text: 'ಹಣ ಜಮಾ ಮಾಡಬೇಕು' });
    expect(second.sessionLanguage).toBe('hi');
    const third = await turn(app, { sessionId, venueCode: BANK, text: 'ಫಾರ್ಮ್ ಅರ್ಥ ಆಗ್ತಿಲ್ಲ' });
    expect(third.sessionLanguage).toBe('kn');
  });

  it('10. Malformed model output → one retry, then staff hand-off', async () => {
    const generate = vi.fn(async () => '{not json');
    const app = setup({ generate });
    const body = await turn(app, { sessionId: newSession(), venueCode: BANK, text: 'मुझे पैसे जमा करने हैं' });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(body.reply.action).toBe('handoff');
    expect(body.source).toBe('fallback');
  });

  it('10b. Malformed once, valid on retry → valid reply', async () => {
    const good = { lang: 'hi', reply: 'ठीक है।', replyEnglish: 'Okay.', action: 'none' };
    const generate = vi.fn().mockResolvedValueOnce('oops').mockResolvedValueOnce(good);
    const app = setup({ generate });
    const body = await turn(app, { sessionId: newSession(), venueCode: BANK, text: 'नमस्ते जी' });
    expect(body.source).toBe('llm');
    expect(body.reply.reply).toBe('ठीक है।');
  });

  it('11. End and erase → session state cleared', async () => {
    const { model, generate } = spyModel();
    const app = setup(model);
    const sessionId = newSession();
    await turn(app, { sessionId, venueCode: BANK, text: 'मुझे पैसे जमा करने हैं' });
    const del = await request(app).delete(`/api/sessions/${sessionId}`);
    expect(del.status).toBe(204);
    await turn(app, { sessionId, venueCode: BANK, text: 'नमस्ते जी' });
    const lastCtx = generate.mock.calls.at(-1)![0];
    expect(lastCtx.history).toHaveLength(0);
  });

  it('12. Mock mode → every venue works without API keys', async () => {
    const app = setup();
    for (const code of [BANK, HOSPITAL, BUS]) {
      const venue = await request(app).get(`/api/venues/${code}`);
      expect(venue.status).toBe(200);
      const body = await turn(app, { sessionId: newSession(), venueCode: code, text: 'namaste, madad chahiye' });
      expect(body.reply.reply.length).toBeGreaterThan(0);
    }
  });
});

describe('HTTP edge cases', () => {
  it('unknown venue → 404', async () => {
    const res = await request(setup()).post('/api/turn').send({ sessionId: newSession(), venueCode: 'NOPE-1', text: 'hi' });
    expect(res.status).toBe(404);
  });

  it('path traversal in venue code → 404', async () => {
    const res = await request(setup()).get('/api/venues/..%2F..%2Fpackage');
    expect(res.status).toBe(404);
  });

  it('invalid body → 400', async () => {
    const res = await request(setup()).post('/api/turn').send({ text: 'hi' });
    expect(res.status).toBe(400);
  });
});
