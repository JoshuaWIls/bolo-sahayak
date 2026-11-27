/**
 * Ports the UI depends on. Browser speech, a cloud speech API or a test
 * double can be swapped in without changing any component.
 */
import type { DocumentImage, LanguageCode, TurnResult, VenueInfo } from '../domain/types';

export interface RecognitionResult {
  transcript: string;
  /** 0..1, when the recogniser reports it. */
  confidence?: number;
}

export interface RecognitionCallbacks {
  onInterim(text: string): void;
  onFinal(result: RecognitionResult): void;
  onNothingHeard(): void;
  onError(message: string): void;
}

export interface SpeechRecognizer {
  readonly isSupported: boolean;
  start(lang: LanguageCode, callbacks: RecognitionCallbacks): void;
  /** Stop listening and deliver what was heard so far. */
  stop(): void;
  /** Stop listening and discard everything — no callbacks fire afterwards. */
  cancel(): void;
}

export interface SpeechSynthesizer {
  readonly isSupported: boolean;
  speak(text: string, lang: LanguageCode, options: { slow: boolean; onEnd: () => void }): void;
  cancel(): void;
}

export interface AssistantApi {
  getVenue(code: string): Promise<VenueInfo>;
  sendTurn(input: {
    sessionId: string;
    venueCode: string;
    text: string;
    sttConfidence?: number;
    preferredLanguage?: LanguageCode;
  }): Promise<TurnResult>;
  readDocument(input: {
    sessionId: string;
    venueCode: string;
    image: DocumentImage;
    preferredLanguage?: LanguageCode;
  }): Promise<TurnResult>;
  endSession(sessionId: string): Promise<void>;
}
