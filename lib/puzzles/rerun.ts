/**
 * Rerun fallback (SPEC §8): if a date has no ready puzzle when its window opens,
 * serve an earlier puzzle, labelled "Rerun", and alert the admin by email (the
 * game is at risk). The rerun is stored as a ready puzzle with rerun_of, so every
 * route (puzzle, play, guess, reveal) serves the same rounds.
 *
 * Source: the most recent original puzzle at least 365 days earlier. Before the
 * game is a year old there is none, so it falls back to the oldest original
 * puzzle (DECISIONS 2026-11-09 "M5 rerun fallback").
 */
import { addDays } from "../dates";
import { sendAlertEmail } from "../admin/notify";
import { adminClient } from "../supabase/admin";

export const RERUN_MIN_AGE_DAYS = 365;

/** Create (or find) the rerun for `date`. Returns the source date, or null if there's nothing to rerun. */
export async function ensureRerun(date: string): Promise<string | null> {
  const db = adminClient();
  const originals = db.from("puzzles").select("puzzle_date").eq("status", "ready").is("rerun_of", null).lt("puzzle_date", date);
  const { data: old, error } = await originals.lte("puzzle_date", addDays(date, -RERUN_MIN_AGE_DAYS)).order("puzzle_date", { ascending: false }).limit(1);
  if (error) throw error;
  let source = old?.[0]?.puzzle_date as string | undefined;
  if (!source) {
    const { data: oldest, error: e2 } = await db.from("puzzles").select("puzzle_date").eq("status", "ready").is("rerun_of", null).lt("puzzle_date", date).order("puzzle_date", { ascending: true }).limit(1);
    if (e2) throw e2;
    source = oldest?.[0]?.puzzle_date as string | undefined;
  }
  if (!source) return null;

  // A draft row for the date (incomplete puzzle) becomes the rerun; otherwise insert one.
  const { data: updated, error: e3 } = await db.from("puzzles").update({ status: "ready", rerun_of: source }).eq("puzzle_date", date).eq("status", "draft").select("puzzle_date");
  if (e3) throw e3;
  if (!updated?.length) {
    const { error: e4 } = await db.from("puzzles").insert({ puzzle_date: date, status: "ready", rerun_of: source });
    if (e4 && e4.code !== "23505") throw e4; // 23505: another request created it first
  }

  await sendAlertEmail(
    `rerun:${date}`,
    `no puzzle for ${date}, serving a rerun`,
    `${date} had no ready puzzle when it opened, so players are getting a rerun of ${source}. Check the nightly content run and the Upcoming page.`,
  ).catch((e) => console.error("rerun alert email failed", e));
  return source;
}
