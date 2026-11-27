import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { telHref } from '../src/domain/phone';
import { HttpAssistantApi, HttpError } from '../src/infrastructure/HttpAssistantApi';
import { speechWatchdogMs, WebSpeechSynthesizer } from '../src/infrastructure/WebSpeech';
import { initialVoiceState, voiceReducer, type VoiceEvent, type VoiceState } from '../src/domain/voiceMachine';
import { bi, cameraLabelKey, errorKey } from '../src/ui/i18n';

const run = (events: VoiceEvent[], start: VoiceState = initialVoiceState) => events.reduce(voiceReducer, start);

describe('voice state machine fixes', () => {
  it('a late "nothing heard" from a cancelled mic does not interrupt a typed question', () => {
    // mic on → user types instead → HEARD → stale NOTHING_HEARD arrives
    const state = run([{ type: 'MIC_TAPPED' }, { type: 'HEARD' }, { type: 'NOTHING_HEARD' }]);
    expect(state.status).toBe('processing');
    expect(voiceReducer(state, { type: 'REPLY_READY' }).status).toBe('speaking');
  });

  it('tapping the mic to stop listening never gets stuck in processing when nothing was heard', () => {
    const state = run([{ type: 'MIC_TAPPED' }, { type: 'MIC_TAPPED' }, { type: 'NOTHING_HEARD' }]);
    expect(state.status).toBe('idle');
  });

  it('tapping to stop, then hearing speech → processing', () => {
    expect(run([{ type: 'MIC_TAPPED' }, { type: 'MIC_TAPPED' }, { type: 'HEARD' }]).status).toBe('processing');
  });

  it('RESET clears errors and returns to idle (End and erase)', () => {
    const failed = run([{ type: 'MIC_TAPPED' }, { type: 'FAILED', message: 'network' }]);
    expect(failed.error).toBe('network');
    expect(voiceReducer(failed, { type: 'RESET' })).toEqual(initialVoiceState);
  });
});

describe('UI strings', () => {
  it('camera button matches the venue', () => {
    expect(bi(cameraLabelKey('bus'), 'en')).toBe('Read board');
    expect(bi(cameraLabelKey('hospital'), 'en')).toBe('Show slip');
    expect(bi(cameraLabelKey('bank'), 'hi')).toBe('फ़ॉर्म दिखाइए · Show form');
  });

  it('mic errors are explained in the user language', () => {
    expect(errorKey('mic-blocked')).toBe('micBlocked');
    expect(errorKey('network')).toBe('network');
    expect(errorKey('weird')).toBeNull();
  });
});


describe('sweep: Repeat must show "speaking" so a mic tap interrupts it', () => {
  it('REPLY_READY from idle (Repeat) → speaking', () => {
    expect(voiceReducer(initialVoiceState, { type: 'REPLY_READY' }).status).toBe('speaking');
  });
  it('REPLY_READY never hijacks listening', () => {
    const listening = voiceReducer(initialVoiceState, { type: 'MIC_TAPPED' });
    expect(voiceReducer(listening, { type: 'REPLY_READY' }).status).toBe('listening');
  });
});

describe('sweep: speech can never trap the UI in "speaking"', () => {
  type FakeUtterance = { text: string; onend?: () => void; onerror?: () => void; lang?: string; rate?: number };
  let spoken: FakeUtterance[];

  beforeEach(() => {
    vi.useFakeTimers();
    spoken = [];
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak: (u: FakeUtterance) => spoken.push(u), // never fires onend — the Chrome bug
        cancel: vi.fn(),
        resume: vi.fn(),
        getVoices: () => [{ lang: 'hi_IN' }],
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls onEnd once via the watchdog when the browser never reports the end', () => {
    const onEnd = vi.fn();
    new WebSpeechSynthesizer().speak('नमस्ते', 'hi', { slow: false, onEnd });
    vi.advanceTimersByTime(speechWatchdogMs('नमस्ते', false) + 1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    spoken[0]!.onend?.(); // a very late real end must not fire twice
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('matches Android-style voice locales (hi_IN)', () => {
    new WebSpeechSynthesizer().speak('x', 'hi', { slow: false, onEnd: () => undefined });
    expect((spoken[0] as unknown as { voice?: { lang: string } }).voice?.lang).toBe('hi_IN');
  });

  it('watchdog allows longer for slow speech', () => {
    expect(speechWatchdogMs('a'.repeat(100), true)).toBeGreaterThan(speechWatchdogMs('a'.repeat(100), false));
  });
});

describe('sweep: misc', () => {
  it('placeholder toll-free numbers are not dialable (would dial "1800")', () => {
    expect(telHref('1800-XXX-XXXX')).toBeUndefined();
    expect(telHref('1800-425-1234')).toBe('tel:18004251234');
    expect(telHref('108')).toBe('tel:108');
  });

  it('HTTP 404 is distinguishable from a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const err = await new HttpAssistantApi().getVenue('NOPE').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(404);
    vi.unstubAllGlobals();
  });

  it('photo decode failures get their own message', () => {
    expect(errorKey('photo')).toBe('photoFailed');
  });
});
