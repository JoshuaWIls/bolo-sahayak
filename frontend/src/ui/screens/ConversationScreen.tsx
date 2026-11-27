import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { VoiceAssistant } from '../../application/useVoiceAssistant';
import type { VenueInfo } from '../../domain/types';
import {
  CameraPrompt,
  ConfirmButtons,
  EmergencyBanner,
  FallbackTasks,
  RouteCard,
} from '../components/ActionPanels';
import { VerifiedHeader } from '../components/Header';
import { CameraIcon } from '../components/Icons';
import { LanguageChips } from '../components/LanguageChips';
import { MicButton } from '../components/MicButton';
import { bi, cameraLabelKey, errorKey, t } from '../i18n';

interface Props {
  venue: VenueInfo;
  assistant: VoiceAssistant;
  onShowHandoff(): void;
}

export function ConversationScreen({ venue, assistant, onShowHandoff }: Props) {
  const { voice, messages, lastReply, language, slow } = assistant;
  const [typed, setTyped] = useState('');
  const cameraInput = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const action = lastReply?.action;
  const busy = voice.status === 'processing';
  const cameraLabel = t(cameraLabelKey(venue.type), language);

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || busy) return;
    void assistant.send(typed.trim());
    setTyped('');
  };

  const openCamera = () => cameraInput.current?.click();
  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same photo be picked again
    if (file) void assistant.sendPhoto(file);
  };

  // Keep the newest message (and its buttons) in view.
  useEffect(() => {
    chatEnd.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [messages.length, voice.status, voice.interim, action]);

  const errorText = voice.error ? (errorKey(voice.error) ? bi(errorKey(voice.error)!, language) : voice.error) : null;

  return (
    <div className="screen screen-fixed">
      <VerifiedHeader right={<LanguageChips value={language} onChange={assistant.setLanguage} />} />

      {assistant.emergency && <EmergencyBanner reply={assistant.emergency} />}

      <main className="content chat" aria-live="polite">
        {messages.length === 0 && <p className="muted center">{bi('tapToSpeak', language)}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.role}`}>
            {m.photo ? (
              <div className="photo-msg"><CameraIcon /> {t('photoSent', language)}</div>
            ) : (
              <div>{m.text}</div>
            )}
            {m.english && m.english !== m.text && <small>{m.english}</small>}
          </div>
        ))}
        {voice.status === 'listening' && voice.interim && <div className="bubble bubble-user interim">{voice.interim}</div>}
        {busy && <div className="bubble bubble-agent typing" aria-label={t('thinking', language)}><span /><span /><span /></div>}
        {errorText && (
          <div className="notice notice-row" role="status">
            <span>{errorText}</span>
            {voice.error === 'network' && assistant.canRetry && (
              <button type="button" className="btn btn-small" onClick={assistant.retry}>{bi('retry', language)}</button>
            )}
          </div>
        )}

        {!busy && action === 'confirm' && <ConfirmButtons lang={language} onAnswer={assistant.confirm} />}
        {!busy && action === 'fallback' && (
          <FallbackTasks venue={venue} lang={language} onPick={(text) => void assistant.send(text, { viaButton: true })} />
        )}
        {action === 'route' && lastReply && <RouteCard reply={lastReply} lang={language} />}
        {!busy && action === 'handoff' && (
          <button type="button" className="btn btn-primary" onClick={onShowHandoff}>{bi('showCard', language)}</button>
        )}
        {!busy && action === 'camera' && <CameraPrompt lang={language} label={bi('openCamera', language)} onOpen={openCamera} />}
        <div ref={chatEnd} aria-hidden="true" />
      </main>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onPhoto}
      />

      <div className="quick-actions">
        <button type="button" className="btn" onClick={openCamera} disabled={busy}><CameraIcon /> {cameraLabel}</button>
        <button type="button" className="btn" onClick={assistant.repeat} disabled={!lastReply || busy}>{t('repeat', language)}</button>
        <button type="button" className={`btn ${slow ? 'btn-on' : ''}`} aria-pressed={slow} onClick={() => assistant.setSlow(!slow)}>{t('slower', language)}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => void assistant.send('I want to talk to staff', { viaButton: true })}>{t('staff', language)}</button>
      </div>

      <footer className="mic-bar">
        <MicButton status={voice.status} lang={language} onTap={assistant.tapMic} />
        <form className="type-form" onSubmit={submitTyped}>
          <label className="sr-only" htmlFor="typed">{bi('typeInstead', language)}</label>
          <input
            id="typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={assistant.speechSupported ? t('typeInstead', language) : t('voiceUnsupported', language)}
            maxLength={500}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>{t('send', language)}</button>
        </form>
      </footer>
    </div>
  );
}
