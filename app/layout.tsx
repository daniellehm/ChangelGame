import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { bricolage, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Changel — how much did it change?",
  description: "The daily game about how much the world changed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e7",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
