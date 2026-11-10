"use client";

/**
 * Buy Me a Coffee floating button (Dani's request, DECISIONS 2026-11-09).
 *
 * The official embed is a <script> that waits for window "DOMContentLoaded",
 * which has already fired by the time a client component mounts. So we insert
 * the same script tag ourselves and replay that event once it has loaded.
 * Production builds only: keeps the third-party script out of dev, E2E and
 * visual baselines. Hidden mid-round (html[data-playing], set by Game), and
 * html.has-bmc adds bottom space so the last button can scroll clear of it.
 */
import { useEffect } from "react";

const SRC = "https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js";

/** Exactly the attributes from the Buy Me a Coffee embed code. */
const ATTRS: Record<string, string> = {
  "data-name": "BMC-Widget",
  "data-cfasync": "false",
  "data-id": "releasedani",
  "data-description": "Support me on Buy me a coffee!",
  "data-message": "",
  "data-color": "#40DCA5",
  "data-position": "Right",
  "data-x_margin": "18",
  "data-y_margin": "18",
};

export function BuyMeACoffee() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    // Third-party, not needed to play: load it once the page is idle after loading, so it
    // never competes with the game's first paint (M6 6.9, Lighthouse).
    let cancelled = false;
    const add = () => {
      if (cancelled || document.querySelector('script[data-name="BMC-Widget"]')) return; // once per page load
      const s = document.createElement("script");
      for (const [k, v] of Object.entries(ATTRS)) s.setAttribute(k, v);
      s.src = SRC;
      s.async = true;
      s.onload = () => window.dispatchEvent(new Event("DOMContentLoaded"));
      document.documentElement.classList.add("has-bmc");
      document.body.appendChild(s);
    };
    const idle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(add, { timeout: 4000 }) : setTimeout(add, 2000));
    const later = () => setTimeout(idle, 1500);
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", later);
    };
  }, []);
  return null;
}
