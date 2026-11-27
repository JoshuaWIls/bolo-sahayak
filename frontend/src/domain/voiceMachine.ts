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
  | { type: 'FAILED'; message: string };

export const initialVoiceState: VoiceState = { status: 'idle', interim: '' };

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case 'MIC_TAPPED':
      // From idle or speaking (barge-in) → listen. While listening → stop.
      if (state.status === 'listening') return { status: 'processing', interim: state.interim };
      if (state.status === 'processing') return state;
      return { status: 'listening', interim: '' };
    case 'INTERIM':
      return state.status === 'listening' ? { ...state, interim: event.text } : state;
    case 'HEARD':
      return { status: 'processing', interim: state.interim };
    case 'NOTHING_HEARD':
      return { status: 'idle', interim: '' };
    case 'REPLY_READY':
      return state.status === 'processing' ? { status: 'speaking', interim: '' } : state;
    case 'SPEECH_ENDED':
      return state.status === 'speaking' ? { status: 'idle', interim: '' } : state;
    case 'FAILED':
      return { status: 'idle', interim: '', error: event.message };
  }
}
