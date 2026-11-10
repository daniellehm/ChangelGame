import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Backdrop } from "@/components/Backdrop";
import { BuyMeACoffee } from "@/components/BuyMeACoffee";
import { bricolage, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://changel.app"),
  // SPEC §10 title; other pages render as "Page · Changel".
  title: { default: "Changel — the daily game about how much the world changed", template: "%s · Changel" },
  description: "A real number from the past: how many times bigger or smaller did it get? Five rounds a day, free, no account needed.",
  applicationName: "Changel",
  alternates: { canonical: "/" },
  // Default link preview for every page; a shared result (?r=) overrides it (app/page.tsx).
  openGraph: { siteName: "Changel", type: "website", images: [{ url: "/api/og", width: 1200, height: 630, alt: "Changel: how much did it change?" }] },
  twitter: { card: "summary_large_image", images: ["/api/og"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e7",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <Backdrop />
        <main>{children}</main>
        <BuyMeACoffee />
      </body>
    </html>
  );
}
