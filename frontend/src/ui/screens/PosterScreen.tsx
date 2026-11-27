import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useServices } from '../../application/services';
import type { VenueInfo } from '../../domain/types';
import { ShieldIcon } from '../components/Icons';

/**
 * Printable A4 poster for one help point: a large QR code that opens
 * /v/<CODE>, the address written out (so people can check it's official),
 * the toll-free number, and the safety promise in Hindi, Kannada and English.
 *
 * The QR target uses VITE_PUBLIC_URL when set (e.g. https://help.example.in),
 * so posters printed from a laptop don't point at localhost.
 */
export function PosterScreen({ code }: { code: string }) {
  const { api } = useServices();
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
  const target = `${base}/v/${venue?.code ?? code.toUpperCase()}`;

  useEffect(() => {
    api.getVenue(code).then(setVenue, () => setError(true));
  }, [api, code]);

  useEffect(() => {
    if (!venue) return;
    QRCode.toString(target, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#16201c', light: '#ffffff' } })
      .then(setSvg, () => setError(true));
  }, [venue, target]);

  if (error) return <p className="content">Help point "{code}" was not found.</p>;
  if (!venue || !svg) return <p className="content muted">Loading…</p>;

  const isLocal = /localhost|127\.0\.0\.1/.test(target);

  return (
    <div className="poster-page">
      <div className="poster-tools no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print poster</button>
        <a className="btn" href={`/v/${venue.code}`}>Open help point</a>
        {isLocal && (
          <p className="notice">
            This QR points at <strong>{base}</strong>, which only works on this computer.
            Set <code>VITE_PUBLIC_URL</code> to the real address before printing.
          </p>
        )}
      </div>

      <article className="poster" aria-label={`Poster for ${venue.name}`}>
        <header className="poster-head">
          <h1>बोलिए · ಮಾತನಾಡಿ · Speak</h1>
          <p>
            मदद चाहिए? स्कैन करके अपनी भाषा में बोलिए।<br />
            ಸಹಾಯ ಬೇಕೇ? ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ.<br />
            Need help? Scan and speak in your language.
          </p>
        </header>

        <div className="poster-qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="poster-url">{target.replace(/^https?:\/\//, '')}</p>

        <p className="poster-call">
          📞 मुफ़्त कॉल · ಉಚಿತ ಕರೆ · Free call<br />
          <strong>{venue.tollFree}</strong>
        </p>

        <div className="poster-promise">
          <ShieldIcon />
          <div>
            <strong>हम कभी OTP, PIN, पासवर्ड या पैसे नहीं माँगते।</strong>
            <div>ನಾವು ಎಂದಿಗೂ OTP, PIN, ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಹಣ ಕೇಳುವುದಿಲ್ಲ.</div>
            <div>We never ask for your OTP, PIN, password or money.</div>
          </div>
        </div>

        <footer className="poster-foot">
          <span>Bolo Sahayak · {venue.name} · {venue.location}</span>
          <span className="mono">{venue.code}</span>
        </footer>
      </article>
    </div>
  );
}
