/** llm_calls ledger (server only): month-to-date spend for the cap, and one row per Claude call. */
import { adminClient } from "../supabase/admin";
import type { Ledger } from "./llm";

/** Start of the current calendar month in UTC (the cap resets on the 1st). */
export function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const dbLedger = (): Ledger => ({
  async monthSpendUsd() {
    const { data, error } = await adminClient().rpc("llm_spend_since", { p_since: monthStartUtc().toISOString() });
    if (error) throw error;
    return Number(data ?? 0);
  },
  async record(e) {
    const { error } = await adminClient().from("llm_calls").insert(e);
    if (error) console.error("llm_calls insert failed", error); // never lose a run over bookkeeping
  },
});
