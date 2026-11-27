import type { LanguageCode } from '../../domain/types';

const LANGS: { code: LanguageCode; label: string; name: string }[] = [
  { code: 'hi', label: 'हिन्दी', name: 'Hindi' },
  { code: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'en', label: 'English', name: 'English' },
];

/**
 * Always-visible language switch. Replaces a native <select>, whose popup is
 * drawn by the OS/browser outside the page (and on some phones far from the
 * control) — confusing for first-time users.
 */
export function LanguageChips({ value, onChange }: { value: LanguageCode; onChange(lang: LanguageCode): void }) {
  return (
    <div className="lang-chips" role="group" aria-label="Language / भाषा / ಭಾಷೆ">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-chip ${value === l.code ? 'lang-chip-on' : ''}`}
          aria-pressed={value === l.code}
          aria-label={l.name}
          lang={l.code}
          onClick={() => onChange(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
