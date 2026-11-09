/**
 * Value and multiplier formatting (SPEC §6 `format`). Ported from the prototype's
 * fmt() / multLabel() / pct(); output must stay identical for the prototype's
 * formats. Locale is pinned to en-US so server and client render the same.
 * Add new formats here with a test each.
 */
import { SCORING } from "./config";

export const FORMATS = ["big", "int", "usd", "aud", "sec", "m", "yrs", "time", "pct"] as const;
export type Format = (typeof FORMATS)[number];

export function isFormat(f: string): f is Format {
  return (FORMATS as readonly string[]).includes(f);
}

const LOCALE = "en-US";
const group = (n: number) => n.toLocaleString(LOCALE);

/** Round to d significant figures (returns a number, so trailing zeros drop). */
export function sig(n: number, d = 3): number {
  return Number(n.toPrecision(d));
}

function money(v: number, symbol: string): string {
  if (v >= 1000) return symbol + group(Math.round(v));
  if (v >= 1) return symbol + v.toFixed(2);
  if (v >= 0.01) return Math.round(v * 100) + "¢";
  return symbol + sig(v, 2);
}

export function formatValue(v: number, f: Format): string {
  switch (f) {
    case "big":
      if (v >= 1e9) return sig(v / 1e9) + " billion";
      if (v >= 1e6) return sig(v / 1e6) + " million";
      if (v >= 1e3) return group(Math.round(v));
      return sig(v).toString();
    case "int":
      return group(Math.round(v));
    case "usd":
      return money(v, "$");
    case "aud":
      return money(v, "A$");
    case "sec":
      return v.toFixed(2) + "s";
    case "m":
      return Math.round(v) + " m";
    case "yrs":
      return v.toFixed(v < 10 ? 1 : 0) + " yrs";
    case "time": {
      const s = Math.round(v);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      return h + ":" + String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
    }
    case "pct":
      return sig(v) + "%";
  }
}

/** Percentage change for a multiplier m, e.g. 2.4 → "140%". */
export function pctChange(m: number): string {
  const a = Math.abs((m - 1) * 100);
  return (a >= 1000 ? group(Math.round(a)) : a >= 10 ? Math.round(a) : a.toFixed(1)) + "%";
}

function prettyMultiplier(x: number): string {
  return x >= 100 ? group(Math.round(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
}

export type Direction = "up" | "down" | "same";

export interface MultLabel {
  /** "×2.40", "÷3.10" or "×1" */
  big: string;
  /** "+140% bigger", "68% smaller" or "no change" */
  sub: string;
  /** CSS class for the readout colour ("" when no change). */
  cls: "" | "up" | "down";
  direction: Direction;
}

/** Label for a log10 multiplier l. */
export function multLabel(l: number): MultLabel {
  const m = Math.pow(10, l);
  if (Math.abs(l) < SCORING.EPSILON) return { big: "×1", sub: "no change", cls: "", direction: "same" };
  if (l > 0) return { big: "×" + prettyMultiplier(m), sub: "+" + pctChange(m) + " bigger", cls: "up", direction: "up" };
  return { big: "÷" + prettyMultiplier(1 / m), sub: pctChange(m) + " smaller", cls: "down", direction: "down" };
}

/** Screen-reader text for the slider, e.g. "2.4 times bigger" (SPEC §9). */
export function multSpoken(l: number): string {
  const lab = multLabel(l);
  if (lab.direction === "same") return "no change";
  const x = lab.direction === "up" ? Math.pow(10, l) : Math.pow(10, -l);
  const n = x >= 100 ? group(Math.round(x)) : x >= 10 ? String(Math.round(x * 10) / 10) : String(sig(x, 2));
  return `${n} times ${lab.direction === "up" ? "bigger" : "smaller"}`;
}
