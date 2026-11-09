import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";

/*
 * Bricolage is variable: the prototype requests opsz 12..96 + wght 400/600/800.
 * Including the opsz axis is required for headings to render like the prototype.
 *
 * adjustFontFallback is off and the fallbacks mirror the prototype's stacks
 * (system-ui / monospace). Glyphs outside the font's subsets (→, ≈) then fall
 * back exactly as they do in the prototype, instead of to a metric-adjusted
 * Arial (DECISIONS.md). Fonts are preloaded, so the swap is rarely visible.
 */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-sans",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  adjustFontFallback: false,
  fallback: ["monospace"],
  variable: "--font-mono",
});
