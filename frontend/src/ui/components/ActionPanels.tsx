import { telHref } from '../../domain/phone';
import type { AgentReply, LanguageCode, VenueInfo } from '../../domain/types';
import { bi } from '../i18n';
import { AlertIcon, CameraIcon } from './Icons';

/**
 * One small component per agent action (Open/Closed: add an action by adding
 * a panel and a line in ActionPanel, nothing else changes).
 */

export function EmergencyBanner({ reply }: { reply: AgentReply }) {
  return (
    <a className="emergency" href="tel:108" role="alert">
      <AlertIcon />
      <span>
        <strong>{reply.reply}</strong>
        <br />
        <small>{reply.replyEnglish}</small>
      </span>
    </a>
  );
}

export function ConfirmButtons({ lang, onAnswer }: { lang: LanguageCode; onAnswer(yes: boolean, label: string): void }) {
  return (
    <div className="grid-2">
      <button type="button" className="btn btn-primary" onClick={() => onAnswer(true, bi('yes', lang))}>{bi('yes', lang)}</button>
      <button type="button" className="btn" onClick={() => onAnswer(false, bi('no', lang))}>{bi('no', lang)}</button>
    </div>
  );
}

export function FallbackTasks({ venue, lang, onPick }: { venue: VenueInfo; lang: LanguageCode; onPick(text: string): void }) {
  return (
    <div className="stack">
      <div className="grid-2">
        {venue.tasks.map((task) => (
          <button key={task.id} type="button" className="btn task" onClick={() => onPick(task.label.en)}>
            <span>{task.label[lang]}</span>
            {lang !== 'en' && <small>{task.label.en}</small>}
          </button>
        ))}
      </div>
      <a className="btn" href={telHref(venue.tollFree)} aria-disabled={!telHref(venue.tollFree)}>{bi('callFree', lang)} · {venue.tollFree}</a>
    </div>
  );
}

export function RouteCard({ reply, lang }: { reply: AgentReply; lang: LanguageCode }) {
  if (!reply.routes?.length) return null;
  const routes = [...reply.routes].sort((a, b) => a.etaMinutes - b.etaMinutes);
  // Fares are placeholders like "[FARE]" until a real feed is connected — hide those.
  const showFare = routes.some((r) => r.fare && !r.fare.startsWith('['));
  return (
    <div className="card">
      <div className="card-title">{bi('nextBuses', lang)}</div>
      {routes.map((r) => (
        <div className={`route-row ${showFare ? 'with-fare' : ''}`} key={r.route}>
          <strong>{r.route}</strong>
          <span>{r.destination}</span>
          <span>{r.etaMinutes} min</span>
          {showFare && <span>{r.fare}</span>}
        </div>
      ))}
    </div>
  );
}

/** Shown when the assistant asks for a photo: one big button straight to the camera. */
export function CameraPrompt({ lang, label, onOpen }: { lang: LanguageCode; label: string; onOpen(): void }) {
  return (
    <div className="stack">
      <button type="button" className="btn btn-primary" onClick={onOpen}>
        <CameraIcon /> {label}
      </button>
      <small className="muted center">{bi('photoPrivacy', lang)}</small>
    </div>
  );
}
