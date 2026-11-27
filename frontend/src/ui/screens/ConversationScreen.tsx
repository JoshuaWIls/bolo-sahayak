import { useState, type FormEvent } from 'react';
import type { VoiceAssistant } from '../../application/useVoiceAssistant';
import type { LanguageCode, VenueInfo } from '../../domain/types';
import {
  CameraNotice,
  ConfirmButtons,
  EmergencyBanner,
  FallbackTasks,
  RouteCard,
} from '../components/ActionPanels';
import { VerifiedHeader } from '../components/Header';
import { CameraIcon } from '../components/Icons';
import { MicButton } from '../components/MicButton';
import { bi, t } from '../i18n';

const LANGS: { code: LanguageCode; label: string }[] = [
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'en', label: 'English' },
];

interface Props {
  venue: VenueInfo;
  assistant: VoiceAssistant;
  onShowHandoff(): void;
}

export function ConversationScreen({ venue, assistant, onShowHandoff }: Props) {
  const { voice, messages, lastReply, language, slow } = assistant;
  const [typed, setTyped] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const action = lastReply?.action;

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    void assistant.send(typed.trim());
    setTyped('');
  };

  return (
    <div className="screen">
      <VerifiedHeader
        right={
          <select
            className="lang"
            aria-label="Language"
            value={language}
            onChange={(e) => assistant.setLanguage(e.target.value as LanguageCode)}
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        }
      />

      {action === 'emergency' && lastReply && <EmergencyBanner reply={lastReply} />}

      <main className="content chat" aria-live="polite">
        {messages.length === 0 && <p className="muted center">{bi('tapToSpeak', language)}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.role}`}>
            <div>{m.text}</div>
            {m.english && m.english !== m.text && <small>{m.english}</small>}
          </div>
        ))}
        {voice.status === 'listening' && voice.interim && <div className="bubble bubble-user interim">{voice.interim}</div>}
        {voice.error && <div className="notice">{voice.error === 'network' ? bi('network', language) : voice.error}</div>}

        {action === 'confirm' && <ConfirmButtons lang={language} onAnswer={assistant.confirm} />}
        {action === 'fallback' && <FallbackTasks venue={venue} lang={language} onPick={(text) => void assistant.send(text)} />}
        {action === 'route' && lastReply && <RouteCard reply={lastReply} />}
        {action === 'handoff' && (
          <button type="button" className="btn btn-primary" onClick={onShowHandoff}>Show card for staff</button>
        )}
        {(action === 'camera' || showCamera) && <CameraNotice lang={language} />}
      </main>

      <div className="quick-actions">
        <button type="button" className="btn" onClick={() => setShowCamera(true)}><CameraIcon /> {t('showForm', language)}</button>
        <button type="button" className="btn" onClick={assistant.repeat} disabled={!lastReply}>{t('repeat', language)}</button>
        <button type="button" className={`btn ${slow ? 'btn-on' : ''}`} aria-pressed={slow} onClick={() => assistant.setSlow(!slow)}>{t('slower', language)}</button>
        <button type="button" className="btn" onClick={() => void assistant.send('I want to talk to staff')}>{t('staff', language)}</button>
      </div>

      <footer className="mic-bar">
        <MicButton status={voice.status} lang={language} onTap={assistant.tapMic} />
        <form className="type-form" onSubmit={submitTyped}>
          <label className="sr-only" htmlFor="typed">{bi('typeInstead', language)}</label>
          <input
            id="typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={assistant.speechSupported ? bi('typeInstead', language) : 'Voice not supported here — type'}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary">{t('send', language)}</button>
        </form>
      </footer>
    </div>
  );
}
