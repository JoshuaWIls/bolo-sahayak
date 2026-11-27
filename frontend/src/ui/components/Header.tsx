import { LockIcon } from './Icons';

/** Shows the real host so users can check they're on the official page. */
export function VerifiedHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="verified-bar">
      <span className="lock"><LockIcon /></span>
      <span className="host">{window.location.host}</span>
      {right}
    </header>
  );
}
