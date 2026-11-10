/**
 * The ⇅ mark, drawn (same paths as app/icon.svg). The "⇅" character isn't in the site's
 * fonts, so phones drew it in a fallback font and it looked distorted on some (Dani 2026-11-10).
 */
export function LogoMark() {
  return (
    <svg className="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="18" />
      <g fill="none" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 47V18M13.5 27.5 23 17.5l9.5 10" />
        <path d="M41 17v29M31.5 36.5 41 46.5l9.5-10" />
      </g>
    </svg>
  );
}
