/**
 * Import content/questions.csv into public.questions (idempotent by slug).
 *   npm run content:import            # apply
 *   npm run content:import -- --dry-run
 * New slugs are inserted with their CSV status. Existing questions only get
 * their content fields updated; status/verification are never touched here.
 */
import { readFileSync } from "node:fs";
import { CONTENT_FIELDS, parseQuestionsCsv, type QuestionRow } from "../lib/content/questions";
import { adminClient } from "../lib/supabase/admin";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const { rows, errors } = parseQuestionsCsv(readFileSync("content/questions.csv", "utf8"));
  if (errors.length) {
    console.error(`content/questions.csv has ${errors.length} invalid row(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }

  const db = adminClient();
  const { data: existing, error } = await db.from("questions").select(["id", "slug", ...CONTENT_FIELDS].join(","));
  if (error) throw error;
  const bySlug = new Map((existing as unknown as Array<Record<string, unknown>>).map((q) => [q.slug as string, q]));

  const toInsert: QuestionRow[] = [];
  const toUpdate: Array<{ id: number; slug: string; patch: Record<string, unknown> }> = [];
  for (const row of rows) {
    const cur = bySlug.get(row.slug);
    if (!cur) {
      toInsert.push(row);
      continue;
    }
    const patch: Record<string, unknown> = {};
    for (const f of CONTENT_FIELDS) {
      if (JSON.stringify(cur[f] ?? null) !== JSON.stringify(row[f] ?? null)) patch[f] = row[f];
    }
    if (Object.keys(patch).length) toUpdate.push({ id: cur.id as number, slug: row.slug, patch });
  }

  console.log(`${rows.length} rows in CSV: ${toInsert.length} new, ${toUpdate.length} changed, ${rows.length - toInsert.length - toUpdate.length} unchanged${dryRun ? " (dry run)" : ""}`);
  for (const u of toUpdate) console.log(`  ~ ${u.slug}: ${Object.keys(u.patch).join(", ")}`);
  for (const r of toInsert) console.log(`  + ${r.slug}`);
  if (dryRun) return;

  if (toInsert.length) {
    const { error: e } = await db.from("questions").insert(toInsert);
    if (e) throw e;
  }
  for (const u of toUpdate) {
    const { error: e } = await db.from("questions").update(u.patch).eq("id", u.id);
    if (e) throw e;
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
