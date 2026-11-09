/**
 * Loads the pure parts of reference/prototype.html's script (data, selection,
 * formatting, scoring) so tests can compare our modules against the real
 * reference rather than a hand-copied version.
 */
import { readFileSync } from "node:fs";

export interface ProtoItem {
  cat: string; q: string; y0: number; v0: number; y1: number; v1: number;
  fmt: string; fact: string; src: string;
}

export interface Prototype {
  POOL: ProtoItem[];
  EPOCH: number;
  ROUNDS: number;
  order: number[];
  fmt: (v: number, f: string) => string;
  multLabel: (l: number) => { big: string; sub: string; cls: string };
  pct: (m: number) => string;
  score: (gl: number, al: number) => { pts: number; wrong: boolean };
  tier: (p: number, wrong: boolean) => { e: string; t: string; c: string };
}

let cached: Prototype | undefined;

export function loadPrototype(): Prototype {
  if (cached) return cached;
  const html = readFileSync("reference/prototype.html", "utf8");
  const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
  // Everything before the STORAGE section is pure (no DOM access).
  const pure = script.slice(0, script.indexOf("STORAGE (best-effort)"));
  const cut = pure.lastIndexOf("/*");
  // Pin the locale so number grouping is deterministic.
  const src = pure.slice(0, cut).replaceAll(".toLocaleString()", '.toLocaleString("en-US")');
  cached = new Function(`${src}; return { POOL, EPOCH, ROUNDS, order, fmt, multLabel, pct, score, tier };`)() as Prototype;
  return cached;
}
