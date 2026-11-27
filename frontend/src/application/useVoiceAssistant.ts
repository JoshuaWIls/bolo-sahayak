import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { displayMasked, maskPii } from '../domain/piiMasker';
import type { AgentReply, ChatMessage, LanguageCode, Redaction, TurnResult, VenueInfo } from '../domain/types';
import { initialVoiceState, voiceReducer } from '../domain/voiceMachine';
import { prepareImage } from '../infrastructure/imageCapture';
import { useServices } from './services';

const newId = () => crypto.randomUUID();

export interface SendOptions {
  confidence?: number;
  /** Text came from a button (canned, usually English) — answer in the UI language. */
  viaButton?: boolean;
  /** What the user's chat bubble shows: other text (e.g. "Yes"), or false for none (a retry). */
  display?: string | false;
}

/** Matches the API limit; longer input is cut rather than rejected. */
export const MAX_TEXT_LENGTH = 1000;

/**
 * Wires the pure voice state machine to the speech and API ports.
 * Components only call the returned actions; they never touch browser APIs.
 */
export function useVoiceAssistant(venue: VenueInfo) {
  const { api, recognizer, synthesizer } = useServices();
  const [voice, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastReply, setLastReply] = useState<AgentReply | null>(null);
  const [language, setLanguageState] = useState<LanguageCode>('hi');
  const [slow, setSlow] = useState(false);
  /** Kept until "End and erase": an emergency warning must not scroll away. */
  const [emergency, setEmergency] = useState<AgentReply | null>(null);
  /** The last text that failed to send, so the user can retry without retyping. */
  const [failedText, setFailedText] = useState<{ text: string; options: SendOptions } | null>(null);

  const sessionId = useRef(newId());
  /** Last-4 digits of redacted numbers — kept on this device only, for display. */
  const redactions = useRef<Redaction[]>([]);
  const lastMaskedText = useRef('');
  /** True once the user picks a language in the menu: the server must follow it. */
  const languageChosen = useRef(false);
  /** Each utterance gets a token so a late "ended" from cancelled audio is ignored. */
  const speechToken = useRef(0);
  const status = useRef(voice.status);
  useEffect(() => {
    status.current = voice.status;
  }, [voice.status]);

  const stopSpeaking = useCallback(() => {
    speechToken.current++;
    synthesizer.cancel();
  }, [synthesizer]);

  const speak = useCallback(
    (reply: AgentReply) => {
      const token = ++speechToken.current;
      dispatch({ type: 'REPLY_READY' });
      synthesizer.speak(reply.reply, reply.lang, {
        slow,
        onEnd: () => {
          if (token === speechToken.current) dispatch({ type: 'SPEECH_ENDED' });
        },
      });
    },
    [synthesizer, slow],
  );

  const showResult = useCallback(
    (result: TurnResult) => {
      setLanguageState(result.sessionLanguage);
      setLastReply(result.reply);
      if (result.reply.action === 'emergency') setEmergency(result.reply);
      setMessages((m) => [
        ...m,
        { id: newId(), role: 'agent', text: result.reply.reply, english: result.reply.replyEnglish },
      ]);
      speak(result.reply);
    },
    [speak],
  );

  /** Interrupt whatever the mic or speaker is doing before a new request. */
  const interrupt = useCallback(() => {
    if (status.current === 'listening') recognizer.cancel();
    stopSpeaking();
  }, [recognizer, stopSpeaking]);

  const send = useCallback(
    async (rawText: string, options: SendOptions = {}) => {
      interrupt();
      const { masked, redactions: found } = maskPii(rawText.slice(0, MAX_TEXT_LENGTH));
      redactions.current.push(...found);
      lastMaskedText.current = masked;
      setFailedText(null);

      if (options.display !== false) {
        const text = options.display ?? displayMasked(masked, found);
        setMessages((m) => [...m, { id: newId(), role: 'user', text }]);
      }
      dispatch({ type: 'HEARD' });

      try {
        const result = await api.sendTurn({
          sessionId: sessionId.current,
          venueCode: venue.code,
          text: masked,
          sttConfidence: options.confidence,
          preferredLanguage: options.viaButton || languageChosen.current ? language : undefined,
        });
        showResult(result);
      } catch {
        setFailedText({ text: masked, options });
        dispatch({ type: 'FAILED', message: 'network' });
      }
    },
    [api, venue.code, language, interrupt, showResult],
  );

  /** Resend the message that failed, without adding a second chat bubble. */
  const retry = useCallback(() => {
    if (failedText) void send(failedText.text, { ...failedText.options, display: false });
  }, [failedText, send]);

  const sendPhoto = useCallback(
    async (file: File) => {
      interrupt();
      setMessages((m) => [...m, { id: newId(), role: 'user', text: '', photo: true }]);
      dispatch({ type: 'HEARD' });
      let image;
      try {
        image = await prepareImage(file);
      } catch {
        dispatch({ type: 'FAILED', message: 'photo' }); // e.g. an image format this phone can't decode
        return;
      }
      try {
        const result = await api.readDocument({
          sessionId: sessionId.current,
          venueCode: venue.code,
          image,
          preferredLanguage: language,
        });
        showResult(result);
      } catch {
        dispatch({ type: 'FAILED', message: 'network' });
      }
    },
    [api, venue.code, language, interrupt, showResult],
  );

  const tapMic = useCallback(() => {
    if (voice.status === 'processing') return;
    if (voice.status === 'listening') {
      recognizer.stop(); // delivers what was heard → HEARD or NOTHING_HEARD
      return;
    }
    // Barge-in. Always silence the speaker before listening, whatever the UI
    // state says — otherwise the mic transcribes the assistant's own voice.
    stopSpeaking();

    dispatch({ type: 'MIC_TAPPED' });
    recognizer.start(language, {
      onInterim: (text) => dispatch({ type: 'INTERIM', text }),
      onFinal: ({ transcript, confidence }) => void send(transcript, { confidence }),
      onNothingHeard: () => dispatch({ type: 'NOTHING_HEARD' }),
      onError: (message) => dispatch({ type: 'FAILED', message }),
    });
  }, [voice.status, recognizer, stopSpeaking, language, send]);

  const confirm = useCallback(
    (yes: boolean, label?: string) => {
      // "Yes" re-sends the heard text as confirmed; the bubble shows "Yes", not a duplicate.
      if (yes) void send(lastMaskedText.current, { confidence: 1, display: label });
      else tapMic();
    },
    [send, tapMic],
  );

  const repeat = useCallback(() => {
    if (lastReply) speak(lastReply);
  }, [lastReply, speak]);

  const chooseLanguage = useCallback(
    (lang: LanguageCode) => {
      languageChosen.current = true;
      setLanguageState(lang);
      if (status.current === 'listening') {
        recognizer.cancel();
        dispatch({ type: 'RESET' });
      }
    },
    [recognizer],
  );

  const endSession = useCallback(async () => {
    stopSpeaking();
    recognizer.cancel();
    dispatch({ type: 'RESET' });
    await api.endSession(sessionId.current).catch(() => undefined);
    sessionId.current = newId();
    redactions.current = [];
    lastMaskedText.current = '';
    languageChosen.current = false;
    setMessages([]);
    setLastReply(null);
    setEmergency(null);
    setFailedText(null);
  }, [api, recognizer, stopSpeaking]);

  return {
    voice,
    messages,
    lastReply,
    emergency,
    canRetry: failedText !== null,
    retry,
    language,
    setLanguage: chooseLanguage,
    slow,
    setSlow,
    redactions: redactions.current,
    speechSupported: recognizer.isSupported,
    tapMic,
    send,
    sendPhoto,
    confirm,
    repeat,
    endSession,
  };
}

export type VoiceAssistant = ReturnType<typeof useVoiceAssistant>;
