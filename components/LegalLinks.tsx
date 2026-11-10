import Link from "next/link";

/** Small links at the foot of every page, including the game (not in the menu: Dani 2026-11-10). */
export function LegalLinks() {
  return (
    <p className="legal-links">
      <Link href="/privacy">Privacy &amp; terms</Link> · <Link href="/contact">Contact</Link>
    </p>
  );
}
