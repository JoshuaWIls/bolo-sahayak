import { telHref } from '../../domain/phone';
import type { LanguageCode, VenueInfo } from '../../domain/types';
import { VerifiedHeader } from '../components/Header';
import { MicIcon, PhoneIcon, ShieldIcon } from '../components/Icons';
import { LanguageChips } from '../components/LanguageChips';
import { bi, t } from '../i18n';

interface Props {
  venue: VenueInfo;
  language: LanguageCode;
  onLanguage(lang: LanguageCode): void;
  onStart(): void;
}

export function WelcomeScreen({ venue, language, onLanguage, onStart }: Props) {
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
            <strong>{t('promise', language)}</strong>
            {language !== 'en' && <div>{t('promise', 'en')}</div>}
          </div>
        </div>

        <div className="welcome-langs">
          <LanguageChips value={language} onChange={onLanguage} />
        </div>

        <div className="hero">
          <button type="button" className="mic mic-large mic-idle" onClick={onStart} aria-label={bi('tapToSpeak', language)}>
            <MicIcon size={64} />
          </button>
          <div className="hero-label">
            <strong>{bi('tapToSpeak', language)}</strong>
            <div>बोलिए · ಮಾತನಾಡಿ · Speak</div>
            <small className="muted">Any language. No sign-up.</small>
          </div>
        </div>
      </main>
      <footer className="footer">
        <a className="btn" href={telHref(venue.tollFree)} aria-disabled={!telHref(venue.tollFree)}>
          <PhoneIcon /> {bi('callFree', language)} · {venue.tollFree}
        </a>
        <small className="muted center">Nothing is saved on your phone.</small>
      </footer>
    </div>
  );
}
