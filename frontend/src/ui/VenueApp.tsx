import { useEffect, useState } from 'react';
import { useServices } from '../application/services';
import { useVoiceAssistant } from '../application/useVoiceAssistant';
import type { VenueInfo } from '../domain/types';
import { ConversationScreen } from './screens/ConversationScreen';
import { HandoffScreen } from './screens/HandoffScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

type Screen = 'welcome' | 'conversation' | 'handoff';

export function VenueApp({ code }: { code: string }) {
  const { api } = useServices();
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getVenue(code).then(setVenue, () => setError(true));
  }, [api, code]);

  if (error) return <p className="content">This help point was not found. Please call the number on the poster.</p>;
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
        onEnd={async () => {
          await assistant.endSession();
          setScreen('welcome');
        }}
      />
    );
  }

  return <ConversationScreen venue={venue} assistant={assistant} onShowHandoff={() => setScreen('handoff')} />;
}
