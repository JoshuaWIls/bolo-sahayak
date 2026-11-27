import { useEffect, useState } from 'react';
import { useServices } from '../application/services';
import { useVoiceAssistant } from '../application/useVoiceAssistant';
import type { VenueInfo } from '../domain/types';
import { HttpError } from '../infrastructure/HttpAssistantApi';
import { ConversationScreen } from './screens/ConversationScreen';
import { HandoffScreen } from './screens/HandoffScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

type Screen = 'welcome' | 'conversation' | 'handoff';

export function VenueApp({ code }: { code: string }) {
  const { api } = useServices();
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [error, setError] = useState<'not-found' | 'network' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    api.getVenue(code).then(setVenue, (e: unknown) =>
      setError(e instanceof HttpError && e.status === 404 ? 'not-found' : 'network'),
    );
  }, [api, code, attempt]);

  if (error === 'not-found') {
    return (
      <main className="content" role="alert">
        <p>यह मदद केंद्र नहीं मिला। पोस्टर पर दिए नंबर पर कॉल करें।</p>
        <p>ಈ ಸಹಾಯ ಕೇಂದ್ರ ಸಿಗಲಿಲ್ಲ. ಪೋಸ್ಟರ್‌ನಲ್ಲಿರುವ ಸಂಖ್ಯೆಗೆ ಕರೆ ಮಾಡಿ.</p>
        <p>This help point was not found. Please call the number on the poster.</p>
      </main>
    );
  }
  if (error === 'network') {
    return (
      <main className="content" role="alert">
        <p>नेटवर्क धीमा है · ನೆಟ್‌ವರ್ಕ್ ನಿಧಾನವಾಗಿದೆ · Network is slow.</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          फिर कोशिश करें · ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ · Try again
        </button>
      </main>
    );
  }
  if (!venue) return <p className="content muted">Loading…</p>;
  return <VenueFlow venue={venue} />;
}

function VenueFlow({ venue }: { venue: VenueInfo }) {
  const assistant = useVoiceAssistant(venue);
  const [screen, setScreen] = useState<Screen>('welcome');

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        venue={venue}
        language={assistant.language}
        onLanguage={assistant.setLanguage}
        onStart={() => {
          setScreen('conversation');
          if (assistant.speechSupported) assistant.tapMic();
        }}
      />
    );
  }

  if (screen === 'handoff' && assistant.lastReply) {
    return (
      <HandoffScreen
        venue={venue}
        reply={assistant.lastReply}
        redactions={assistant.redactions}
        onBack={() => setScreen('conversation')}
        onSpeak={() => {
          setScreen('conversation');
          if (assistant.speechSupported) assistant.tapMic();
        }}
        onEnd={async () => {
          await assistant.endSession();
          setScreen('welcome');
        }}
      />
    );
  }

  return <ConversationScreen venue={venue} assistant={assistant} onShowHandoff={() => setScreen('handoff')} />;
}
