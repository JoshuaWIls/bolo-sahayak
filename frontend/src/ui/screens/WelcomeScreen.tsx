import type { VenueInfo } from '../../domain/types';
import { VerifiedHeader } from '../components/Header';
import { MicIcon, PhoneIcon, ShieldIcon } from '../components/Icons';
import { t } from '../i18n';

export function WelcomeScreen({ venue, onStart }: { venue: VenueInfo; onStart(): void }) {
  return (
    <div className="screen">
      <VerifiedHeader right={<span className="chip">Verified</span>} />
      <main className="content">
        <div>
          <h1>Bolo Sahayak</h1>
          <p className="muted">{venue.name} · {venue.location}</p>
        </div>

        <div className="promise">
          <ShieldIcon />
          <div>
            <strong>{t('promise', 'en')}</strong>
            <div>{t('promise', 'hi')}</div>
          </div>
        </div>

        <div className="hero">
          <button type="button" className="mic mic-large mic-idle" onClick={onStart} aria-label="Tap and speak">
            <MicIcon size={64} />
          </button>
          <div className="hero-label">
            <strong>Tap and speak</strong>
            <div>बोलिए · ಮಾತನಾಡಿ</div>
            <small className="muted">Any language. No sign-up.</small>
          </div>
        </div>
      </main>
      <footer className="footer">
        <a className="btn" href={`tel:${venue.tollFree.replace(/[^\d+]/g, '')}`}>
          <PhoneIcon /> Prefer a call? {venue.tollFree}
        </a>
        <small className="muted center">Nothing is saved on your phone.</small>
      </footer>
    </div>
  );
}
