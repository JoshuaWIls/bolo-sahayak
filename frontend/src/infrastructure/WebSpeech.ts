import type { LanguageCode } from '../domain/types';
import type { RecognitionCallbacks, SpeechRecognizer, SpeechSynthesizer } from '../ports';

const LOCALES: Record<LanguageCode, string> = { hi: 'hi-IN', kn: 'kn-IN', en: 'en-IN' };

/* Minimal typings: the Web Speech recognition API is not in TypeScript's DOM lib. */
interface RecognitionAlternative { transcript: string; confidence: number }
interface RecognitionResultItem { isFinal: boolean; 0: RecognitionAlternative }
interface RecognitionEventLike { results: ArrayLike<RecognitionResultItem> }
interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => BrowserRecognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Browser speech-to-text (Chrome on Android supports hi-IN, kn-IN, en-IN). */
export class WebSpeechRecognizer implements SpeechRecognizer {
  private active?: BrowserRecognition;

  get isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(recognitionCtor());
  }

  start(lang: LanguageCode, cb: RecognitionCallbacks): void {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      cb.onError('Speech recognition is not supported in this browser.');
      return;
    }
    this.cancel();

    const rec = new Ctor();
    rec.lang = LOCALES[lang];
    rec.interimResults = true;
    rec.continuous = false; // stops on silence — the browser's own voice activity detection

    let finalText = '';
    let confidence: number | undefined;

    rec.onresult = (event) => {
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]!;
        const alt = result[0];
        if (result.isFinal) {
          finalText += alt.transcript;
          // Some browsers report 0 when unknown; treat that as "not reported".
          confidence = alt.confidence > 0 ? alt.confidence : undefined;
        } else {
          interim += alt.transcript;
        }
      }
      cb.onInterim(finalText + interim);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      cb.onError(friendlyError(e.error));
    };
    rec.onend = () => {
      if (this.active === rec) this.active = undefined;
      if (finalText.trim()) cb.onFinal({ transcript: finalText.trim(), confidence });
      else cb.onNothingHeard();
    };

    this.active = rec;
    rec.start();
  }

  stop(): void {
    this.active?.stop();
  }

  cancel(): void {
    const rec = this.active;
    if (!rec) return;
    this.active = undefined;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.abort();
  }
}

function friendlyError(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'mic-blocked';
  // Chrome sends audio to Google for recognition; this is NOT our server being slow.
  if (code === 'network') return 'speech-network';
  if (code === 'audio-capture') return 'no-mic';
  return code;
}

/**
 * Upper bound for how long an utterance can take. Chrome sometimes never
 * fires onend/onerror (missing voice, utterance garbage-collected, tab
 * backgrounded) — without this the UI would be stuck in "speaking".
 */
export function speechWatchdogMs(text: string, slow: boolean): number {
  return 4000 + text.length * (slow ? 130 : 95);
}

/** Browser text-to-speech. */
export class WebSpeechSynthesizer implements SpeechSynthesizer {
  /** Held so Chrome can't garbage-collect the utterance (which drops its onend). */
  private current?: SpeechSynthesisUtterance;
  private watchdog?: ReturnType<typeof setTimeout>;

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string, lang: LanguageCode, { slow, onEnd }: { slow: boolean; onEnd: () => void }): void {
    if (!this.isSupported) {
      onEnd();
      return;
    }
    this.cancel();

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(this.watchdog);
      if (this.current === utterance) this.current = undefined;
      onEnd();
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALES[lang];
    utterance.rate = slow ? 0.8 : 1;
    const voice = findVoice(LOCALES[lang]);
    if (voice) utterance.voice = voice;
    utterance.onend = finish;
    utterance.onerror = finish;

    this.current = utterance;
    this.watchdog = setTimeout(finish, speechWatchdogMs(text, slow));
    window.speechSynthesis.resume(); // un-stick a synth paused by backgrounding
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (!this.isSupported) return;
    clearTimeout(this.watchdog);
    this.current = undefined;
    window.speechSynthesis.cancel();
  }
}

/** Android reports "hi_IN", desktop "hi-IN": compare loosely. */
function findVoice(locale: string): SpeechSynthesisVoice | undefined {
  const want = locale.toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.replace('_', '-').toLowerCase() === want) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(want.slice(0, 2)))
  );
}
