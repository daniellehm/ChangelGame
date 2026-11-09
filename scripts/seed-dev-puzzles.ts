/**
 * DEV-ONLY: schedule the 20 prototype questions as 4 ready puzzles
 * (2026-11-09 … 2026-11-12) in the prototype's order. Idempotent: existing
 * puzzles are checked, not overwritten. Run after content:import.
 *   npm run content:seed-dev
 * Clear these dev puzzles before launch (launch checklist).
 */
import { readFileSync } from "node:fs";
import { parseQuestionsCsv } from "../lib/content/questions";
import { devSeedPlan } from "../lib/content/dev-seed";
import { adminClient } from "../lib/supabase/admin";

async function main() {
  const { rows, errors } = parseQuestionsCsv(readFileSync("content/questions.csv", "utf8"));
  if (errors.length) throw new Error(errors.join("\n"));
  const prototypeRows = rows.filter((r) => r.tags.includes("prototype"));
  const plan = devSeedPlan(prototypeRows.map((r) => r.slug));

  const db = adminClient();
  const { data: qs, error } = await db.from("questions").select("id, slug").in("slug", prototypeRows.map((r) => r.slug));
  if (error) throw error;
  const idBySlug = new Map(qs.map((q) => [q.slug as string, q.id as number]));
  const missing = prototypeRows.filter((r) => !idBySlug.has(r.slug));
  if (missing.length) throw new Error(`Run content:import first; missing: ${missing.map((m) => m.slug).join(", ")}`);

  for (const day of plan) {
    const ids = day.slugs.map((s) => idBySlug.get(s)!);
    const { data: existing, error: e1 } = await db.from("puzzle_rounds").select("position, question_id").eq("puzzle_date", day.date).order("position");
    if (e1) throw e1;
    if (existing.length) {
      const same = existing.length === 5 && existing.every((r, i) => r.question_id === ids[i]);
      console.log(`${day.date}: already scheduled${same ? "" : " (DIFFERENT rounds; left as is)"}`);
      continue;
    }
    const { error: e2 } = await db.from("puzzles").upsert({ puzzle_date: day.date, status: "ready" }, { onConflict: "puzzle_date" });
    if (e2) throw e2;
    const { error: e3 } = await db.from("puzzle_rounds").insert(ids.map((question_id, i) => ({ puzzle_date: day.date, position: i + 1, question_id })));
    if (e3) throw e3;
    console.log(`${day.date}: scheduled ${day.slugs.join(", ")}`);
  }
  // Questions on a puzzle are 'scheduled' (the nightly run moves them to 'used' once their day has passed),
  // so the admin bank's status filter finds them. Only drafts are touched.
  const onPuzzle = plan.flatMap((d) => d.slugs.map((s) => idBySlug.get(s)!));
  const { error: e4 } = await db.from("questions").update({ status: "scheduled" }).in("id", onPuzzle).eq("status", "draft");
  if (e4) throw e4;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
