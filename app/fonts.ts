import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";

// Bricolage is variable: the prototype requests opsz 12..96 + wght 400/600/800.
// Including the opsz axis is required for headings to render like the prototype.
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-sans",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--font-mono",
});
