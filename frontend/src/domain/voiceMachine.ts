/**
 * The voice loop as a pure state machine:
 *   idle → listening → processing → speaking → idle
 * Tapping the mic while speaking interrupts (barge-in) and starts listening.
 * Pure function = trivially unit-testable, no browser APIs here.
 */
export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceState {
  status: VoiceStatus;
  interim: string;
  error?: string;
}

export type VoiceEvent =
  | { type: 'MIC_TAPPED' }
  | { type: 'INTERIM'; text: string }
  | { type: 'HEARD' }
  | { type: 'NOTHING_HEARD' }
  | { type: 'REPLY_READY' }
  | { type: 'SPEECH_ENDED' }
  | { type: 'FAILED'; message: string }
  | { type: 'RESET' };

export const initialVoiceState: VoiceState = { status: 'idle', interim: '' };

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case 'MIC_TAPPED':
      // From idle or speaking (barge-in) → listen. While listening, the hook asks
      // the recogniser to stop; we stay "listening" until it reports HEARD or
      // NOTHING_HEARD, so the UI can never get stuck in "processing".
      if (state.status === 'listening' || state.status === 'processing') return state;
      return { status: 'listening', interim: '' };
    case 'INTERIM':
      return state.status === 'listening' ? { ...state, interim: event.text } : state;
    case 'HEARD':
      return { status: 'processing', interim: state.interim };
    case 'NOTHING_HEARD':
      // Only meaningful while listening: a late event from a cancelled
      // recogniser must not interrupt a reply that is being fetched or spoken.
      return state.status === 'listening' ? { status: 'idle', interim: '' } : state;
    case 'REPLY_READY':
      // From processing (a new reply) or idle ("Repeat"). The UI must show
      // "speaking" whenever audio plays, so a mic tap interrupts it instead of
      // listening to the assistant's own voice.
      return state.status === 'processing' || state.status === 'idle' ? { status: 'speaking', interim: '' } : state;
    case 'SPEECH_ENDED':
      return state.status === 'speaking' ? { status: 'idle', interim: '' } : state;
    case 'FAILED':
      return { status: 'idle', interim: '', error: event.message };
    case 'RESET':
      return initialVoiceState;
  }
}
