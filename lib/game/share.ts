import { MAX_POINTS_PER_ROUND, MAX_TOTAL, ROUNDS, TIER_CUTOFFS } from "../config";
import { TIERS, type TierId } from "../scoring";

export const SITE_URL = "https://changel.app";

/** Exact share format (SPEC §10). */
export function shareText(number: number, total: number, tiers: readonly TierId[]): string {
  return `${shareTeaser(number, total, tiers)}\nchangel.app`;
}

/** The share text without the link line (the share sheet adds the link itself). */
export function shareTeaser(number: number, total: number, tiers: readonly TierId[]): string {
  return `Changel #${number} ⇅ ${total}/${MAX_TOTAL}\n${tiers.map((t) => TIERS[t].emoji).join("")}`;
}

export interface SharedResult {
  number: number;
  total: number;
  tiers: TierId[];
}

const TIER_ORDER: TierId[] = ["nailed", "close", "meh", "off", "wrong"];

/** Lowest and highest points a round can have with this result. */
const POINTS: Record<TierId, [number, number]> = {
  nailed: [TIER_CUTOFFS.NAILED, MAX_POINTS_PER_ROUND],
  close: [TIER_CUTOFFS.CLOSE, TIER_CUTOFFS.NAILED - 1],
  meh: [TIER_CUTOFFS.MEH, TIER_CUTOFFS.CLOSE - 1],
  off: [0, TIER_CUTOFFS.MEH - 1],
  wrong: [0, 0],
};

/**
 * `?r=` code (SPEC §10): puzzle number, total and each round's result, never an answer.
 * Format `<number base36>-<total base36>-<5 digits, one per round>`, e.g. "c-bg-01024".
 */
export function encodeShareCode(r: SharedResult): string {
  return `${r.number.toString(36)}-${r.total.toString(36)}-${r.tiers.map((t) => TIER_ORDER.indexOf(t)).join("")}`;
}

/** A shared result, or null if the code is malformed or impossible (the total must fit the rounds). */
export function decodeShareCode(code: string | null | undefined): SharedResult | null {
  const m = /^([0-9a-z]{1,6})-([0-9a-z]{1,3})-([0-4]{5})$/.exec(code ?? "");
  if (!m) return null;
  const number = parseInt(m[1]!, 36);
  const total = parseInt(m[2]!, 36);
  const tiers = [...m[3]!].map((d) => TIER_ORDER[Number(d)]!);
  if (number < 1 || tiers.length !== ROUNDS) return null;
  const min = tiers.reduce((a, t) => a + POINTS[t][0], 0);
  const max = tiers.reduce((a, t) => a + POINTS[t][1], 0);
  return total >= min && total <= max ? { number, total, tiers } : null;
}

export function shareUrl(r: SharedResult): string {
  return `${SITE_URL}/?r=${encodeShareCode(r)}`;
}
