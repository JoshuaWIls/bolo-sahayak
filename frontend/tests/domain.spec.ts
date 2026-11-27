import { describe, expect, it } from 'vitest';
import { displayMasked, maskPii } from '../src/domain/piiMasker';
import { initialVoiceState, voiceReducer, type VoiceEvent, type VoiceState } from '../src/domain/voiceMachine';

const run = (events: VoiceEvent[], start: VoiceState = initialVoiceState) => events.reduce(voiceReducer, start);

describe('voice state machine', () => {
  it('runs the happy path idle → listening → processing → speaking → idle', () => {
    expect(run([{ type: 'MIC_TAPPED' }]).status).toBe('listening');
    expect(run([{ type: 'MIC_TAPPED' }, { type: 'HEARD' }]).status).toBe('processing');
    expect(run([{ type: 'MIC_TAPPED' }, { type: 'HEARD' }, { type: 'REPLY_READY' }]).status).toBe('speaking');
    expect(
      run([{ type: 'MIC_TAPPED' }, { type: 'HEARD' }, { type: 'REPLY_READY' }, { type: 'SPEECH_ENDED' }]).status,
    ).toBe('idle');
  });

  it('barge-in: tapping the mic while speaking starts listening', () => {
    const speaking = run([{ type: 'MIC_TAPPED' }, { type: 'HEARD' }, { type: 'REPLY_READY' }]);
    const next = voiceReducer(speaking, { type: 'MIC_TAPPED' });
    expect(next.status).toBe('listening');
    // A late "speech ended" from the cancelled audio must not stop listening.
    expect(voiceReducer(next, { type: 'SPEECH_ENDED' }).status).toBe('listening');
  });

  it('ignores mic taps while processing', () => {
    const processing = run([{ type: 'MIC_TAPPED' }, { type: 'HEARD' }]);
    expect(voiceReducer(processing, { type: 'MIC_TAPPED' })).toBe(processing);
  });

  it('returns to idle when nothing was heard', () => {
    expect(run([{ type: 'MIC_TAPPED' }, { type: 'NOTHING_HEARD' }]).status).toBe('idle');
  });
});

describe('on-device PII masking', () => {
  it('masks before sending and shows only the last 4 digits on screen', () => {
    const { masked, redactions } = maskPii('mera account number 12345678901 hai');
    expect(masked).toBe('mera account number [ACCOUNT] hai');
    expect(displayMasked(masked, redactions)).toBe('mera account number XXXX8901 hai');
  });

  it('classifies Aadhaar and phone numbers', () => {
    expect(maskPii('1234 5678 9012').masked).toBe('[AADHAAR]');
    expect(maskPii('9876543210').masked).toBe('[PHONE]');
    expect(maskPii('token 47 room 112').masked).toBe('token 47 room 112');
  });
});
