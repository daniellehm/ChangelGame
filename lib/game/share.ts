import { MAX_TOTAL } from "../config";
import { TIERS, type TierId } from "../scoring";

/** Exact share format (SPEC §10). */
export function shareText(number: number, total: number, tiers: readonly TierId[]): string {
  return `Changel #${number} ⇅ ${total}/${MAX_TOTAL}\n${tiers.map((t) => TIERS[t].emoji).join("")}\nchangel.app`;
}
