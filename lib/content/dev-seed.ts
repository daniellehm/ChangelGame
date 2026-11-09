/**
 * DEV-ONLY puzzle schedule for the 20 prototype seed questions (pre-launch).
 * Reproduces the prototype's daily selection: its seeded shuffle of the pool,
 * 5 per day from 2026-11-09. 20 questions give exactly 4 disjoint days.
 * Used by scripts/seed-dev-puzzles.ts and the E2E tests; not imported by the app.
 * Real scheduling is the M5 pipeline.
 */
import { addDays } from "../dates";

export const DEV_SEED_START = "2026-11-09";
const SHUFFLE_SEED = 20261109;
const ROUNDS = 5;

/** The prototype's PRNG (mulberry32 variant), verbatim. */
function seeded(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates order of pool indices, as in the prototype. */
export function prototypeOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const r = seeded(SHUFFLE_SEED);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

export interface DevSeedDay {
  date: string;
  slugs: string[]; // positions 1..5
}

/** `slugs` must be in prototype pool order (= content/questions.csv order). */
export function devSeedPlan(slugs: readonly string[]): DevSeedDay[] {
  const order = prototypeOrder(slugs.length);
  const days = Math.floor(slugs.length / ROUNDS);
  return Array.from({ length: days }, (_, d) => ({
    date: addDays(DEV_SEED_START, d),
    slugs: Array.from({ length: ROUNDS }, (_, i) => slugs[order[d * ROUNDS + i]!]!),
  }));
}
