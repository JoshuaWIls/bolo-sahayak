import { PosterScreen } from './screens/PosterScreen';
import { VenueApp } from './VenueApp';

const DEMO_VENUES = [
  { code: 'BLR-JNR-DEP-02', label: 'Bank branch · deposit counter' },
  { code: 'HOSP-OPD-01', label: 'Hospital · OPD block' },
  { code: 'BUS-JN4B-N', label: 'Bus stop · towards Majestic' },
];

/** Tiny path router: QR codes point at /v/<LOCATION-CODE>; posters live at /poster/<CODE>. */
export function App() {
  const path = window.location.pathname;
  const help = path.match(/^\/v\/([A-Za-z0-9-]+)\/?$/);
  if (help?.[1]) return <VenueApp code={help[1]} />;
  const poster = path.match(/^\/poster\/([A-Za-z0-9-]+)\/?$/);
  if (poster?.[1]) return <PosterScreen code={poster[1]} />;

  return (
    <main className="content home">
      <h1>Bolo Sahayak</h1>
      <p className="muted">Demo help points (each one is what a poster's QR code opens):</p>
      <ul className="stack plain">
        {DEMO_VENUES.map((v) => (
          <li key={v.code} className="home-row">
            <a className="btn" href={`/v/${v.code}`}>{v.label}</a>
            <a className="btn btn-ghost" href={`/poster/${v.code}`}>Poster</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
