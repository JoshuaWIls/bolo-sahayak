import type { LanguageCode } from '../../domain/types';
import type { VoiceStatus } from '../../domain/voiceMachine';
import { bi } from '../i18n';
import { MicIcon } from './Icons';

interface Props {
  status: VoiceStatus;
  lang: LanguageCode;
  size?: 'large' | 'small';
  onTap(): void;
}

const LABEL = { idle: 'tapToSpeak', listening: 'listening', processing: 'thinking', speaking: 'speaking' } as const;

export function MicButton({ status, lang, size = 'small', onTap }: Props) {
  return (
    <button
      type="button"
      className={`mic mic-${size} mic-${status}`}
      onClick={onTap}
      disabled={status === 'processing'}
      aria-label={bi(LABEL[status], lang)}
    >
      <MicIcon size={size === 'large' ? 64 : 30} />
    </button>
  );
}
