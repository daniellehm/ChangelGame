import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BuyMeACoffee } from "@/components/BuyMeACoffee";
import { bricolage, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://changel.app"),
  title: "Changel — how much did it change?",
  description: "The daily game about how much the world changed.",
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
        {children}
        <BuyMeACoffee />
      </body>
    </html>
  );
}
