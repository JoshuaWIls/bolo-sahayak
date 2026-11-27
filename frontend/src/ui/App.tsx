import { VenueApp } from './VenueApp';

const DEMO_VENUES = [
  { code: 'BLR-JNR-DEP-02', label: 'Bank branch · deposit counter' },
  { code: 'HOSP-OPD-01', label: 'Hospital · OPD block' },
  { code: 'BUS-JN4B-N', label: 'Bus stop · towards Majestic' },
];

/** Tiny path router: QR codes point at /v/<LOCATION-CODE>. */
export function App() {
  const match = window.location.pathname.match(/^\/v\/([A-Za-z0-9-]+)\/?$/);
  if (match?.[1]) return <VenueApp code={match[1]} />;

  return (
    <main className="content">
      <h1>Bolo Sahayak</h1>
      <p className="muted">Demo help points (each one is what a poster's QR code opens):</p>
      <ul className="stack plain">
        {DEMO_VENUES.map((v) => (
          <li key={v.code}>
            <a className="btn" href={`/v/${v.code}`}>{v.label}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
