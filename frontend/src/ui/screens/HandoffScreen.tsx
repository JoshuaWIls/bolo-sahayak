import type { AgentReply, Redaction, VenueInfo } from '../../domain/types';
import { VerifiedHeader } from '../components/Header';
import { MicIcon } from '../components/Icons';
import { bi } from '../i18n';

const LANGUAGE_NAMES: Record<string, string> = { hi: 'Hindi', kn: 'Kannada', en: 'English' };

interface Props {
  venue: VenueInfo;
  reply: AgentReply;
  redactions: Redaction[];
  onEnd(): void;
  onBack(): void;
  /** Go back to the conversation and start listening straight away. */
  onSpeak(): void;
}

/** A card the user shows at the counter: English for staff, own language for the user. */
export function HandoffScreen({ venue, reply, redactions, onEnd, onBack, onSpeak }: Props) {
  const account = redactions.find((r) => r.kind === 'ACCOUNT');
  const lang = reply.lang;

  return (
    <div className="screen">
      <VerifiedHeader />
      <main className="content">
        <div>
          <h2>{reply.reply}</h2>
          <p className="muted">{reply.replyEnglish}</p>
        </div>

        <section className="staff-card" aria-label="Summary for staff">
          <div className="staff-head">FOR STAFF · {venue.staffCounter}</div>
          <dl>
            <dt>Task</dt><dd>{reply.handoff?.task ?? 'Needs help'}</dd>
            <dt>Please check</dt><dd>{reply.handoff?.check ?? '—'}</dd>
            {account && (<><dt>Account</dt><dd className="mono">XXXX{account.last4}</dd></>)}
            <dt>Speaks</dt><dd>{LANGUAGE_NAMES[reply.handoff?.language ?? lang] ?? lang}</dd>
          </dl>
        </section>
      </main>
      <footer className="footer">
        <button type="button" className="btn btn-primary" onClick={onSpeak}><MicIcon /> {bi('speakAgain', lang)}</button>
        <button type="button" className="btn" onClick={onBack}>{bi('back', lang)}</button>
        <button type="button" className="btn btn-dark" onClick={onEnd}>{bi('endErase', lang)}</button>
        <small className="muted center">Nothing is stored on this phone. Safe on a borrowed phone.</small>
      </footer>
    </div>
  );
}
