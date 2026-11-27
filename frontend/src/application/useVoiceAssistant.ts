import { useCallback, useReducer, useRef, useState } from 'react';
import { displayMasked, maskPii } from '../domain/piiMasker';
import type { AgentReply, ChatMessage, LanguageCode, Redaction, VenueInfo } from '../domain/types';
import { initialVoiceState, voiceReducer } from '../domain/voiceMachine';
import { useServices } from './services';

const newId = () => crypto.randomUUID();

/**
 * Wires the pure voice state machine to the speech and API ports.
 * Components only call the returned actions; they never touch browser APIs.
 */
export function useVoiceAssistant(venue: VenueInfo) {
  const { api, recognizer, synthesizer } = useServices();
  const [voice, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastReply, setLastReply] = useState<AgentReply | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('hi');
  const [slow, setSlow] = useState(false);

  const sessionId = useRef(newId());
  /** Last-4 digits of redacted numbers — kept on this device only, for display. */
  const redactions = useRef<Redaction[]>([]);
  const lastMaskedText = useRef('');

  const speak = useCallback(
    (reply: AgentReply) => {
      dispatch({ type: 'REPLY_READY' });
      synthesizer.speak(reply.reply, reply.lang, {
        slow,
        onEnd: () => dispatch({ type: 'SPEECH_ENDED' }),
      });
    },
    [synthesizer, slow],
  );

  const send = useCallback(
    async (rawText: string, confidence?: number) => {
      const { masked, redactions: found } = maskPii(rawText);
      redactions.current.push(...found);
      lastMaskedText.current = masked;

      setMessages((m) => [...m, { id: newId(), role: 'user', text: displayMasked(masked, found) }]);
      dispatch({ type: 'HEARD' });

      try {
        const result = await api.sendTurn({
          sessionId: sessionId.current,
          venueCode: venue.code,
          text: masked,
          sttConfidence: confidence,
        });
        setLanguage(result.sessionLanguage);
        setLastReply(result.reply);
        setMessages((m) => [
          ...m,
          { id: newId(), role: 'agent', text: result.reply.reply, english: result.reply.replyEnglish },
        ]);
        speak(result.reply);
      } catch {
        dispatch({ type: 'FAILED', message: `network` });
      }
    },
    [api, venue.code, speak],
  );

  const tapMic = useCallback(() => {
    if (voice.status === 'speaking') synthesizer.cancel();
    if (voice.status === 'listening') {
      recognizer.stop();
      return;
    }
    if (voice.status === 'processing') return;

    dispatch({ type: 'MIC_TAPPED' });
    recognizer.start(language, {
      onInterim: (text) => dispatch({ type: 'INTERIM', text }),
      onFinal: ({ transcript, confidence }) => void send(transcript, confidence),
      onNothingHeard: () => dispatch({ type: 'NOTHING_HEARD' }),
      onError: (message) => dispatch({ type: 'FAILED', message }),
    });
  }, [voice.status, recognizer, synthesizer, language, send]);

  const confirm = useCallback(
    (yes: boolean) => {
      if (yes) void send(lastMaskedText.current, 1);
      else tapMic();
    },
    [send, tapMic],
  );

  const repeat = useCallback(() => {
    if (lastReply) speak(lastReply);
  }, [lastReply, speak]);

  const endSession = useCallback(async () => {
    synthesizer.cancel();
    recognizer.stop();
    await api.endSession(sessionId.current).catch(() => undefined);
    sessionId.current = newId();
    redactions.current = [];
    lastMaskedText.current = '';
    setMessages([]);
    setLastReply(null);
  }, [api, recognizer, synthesizer]);

  return {
    voice,
    messages,
    lastReply,
    language,
    setLanguage,
    slow,
    setSlow,
    redactions: redactions.current,
    speechSupported: recognizer.isSupported,
    tapMic,
    send,
    confirm,
    repeat,
    endSession,
  };
}

export type VoiceAssistant = ReturnType<typeof useVoiceAssistant>;
