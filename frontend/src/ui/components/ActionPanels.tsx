import type { AgentReply, LanguageCode, VenueInfo } from '../../domain/types';
import { bi } from '../i18n';
import { AlertIcon } from './Icons';

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

export function ConfirmButtons({ lang, onAnswer }: { lang: LanguageCode; onAnswer(yes: boolean): void }) {
  return (
    <div className="grid-2">
      <button type="button" className="btn btn-primary" onClick={() => onAnswer(true)}>{bi('yes', lang)}</button>
      <button type="button" className="btn" onClick={() => onAnswer(false)}>{bi('no', lang)}</button>
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
      <a className="btn" href={`tel:${venue.tollFree.replace(/[^\d+]/g, '')}`}>Call free · {venue.tollFree}</a>
    </div>
  );
}

export function RouteCard({ reply }: { reply: AgentReply }) {
  if (!reply.routes?.length) return null;
  return (
    <div className="card">
      <div className="card-title">Next buses</div>
      {reply.routes.map((r) => (
        <div className="route-row" key={r.route}>
          <strong>{r.route}</strong>
          <span>{r.destination}</span>
          <span>{r.etaMinutes} min</span>
        </div>
      ))}
    </div>
  );
}

export function CameraNotice({ lang }: { lang: LanguageCode }) {
  return <div className="notice">{bi('cameraSoon', lang)}</div>;
}
