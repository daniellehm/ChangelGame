/**
 * Apply a JSON file of question edits through the admin editor's save (logged in
 * question_edits, then the real checks re-run, spending real money):
 *   npm run content:apply-edits -- edits.json
 * edits.json: [{ "slug": "...", "edits": { prompt?, start_year?, start_value?, end_year?, end_value?, fact?, source_name?, source_url?, source_url_2?, max_change?, category?, note? } }]
 */
import { readFileSync } from "node:fs";
import { QuestionEdit, saveQuestion } from "../lib/admin/data";
import { flagReason } from "../lib/content/checks";
import { adminClient } from "../lib/supabase/admin";

const EDITOR = "fact-check (Claude, for Dani)";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: apply-edits FILE.json");
  const items = JSON.parse(readFileSync(file, "utf8")) as Array<{ slug: string; edits: unknown }>;
  const db = adminClient();
  for (const it of items) {
    const { data: q, error } = await db.from("questions").select("id").eq("slug", it.slug).maybeSingle();
    if (error) throw error;
    if (!q) {
      console.log(`${it.slug}: NOT FOUND`);
      continue;
    }
    const patch = QuestionEdit.parse(it.edits);
    const out = await saveQuestion(q.id as number, patch, EDITOR);
    if (out.status !== "ok") {
      console.log(`#${q.id} ${it.slug}: ${out.status}${"detail" in out ? `: ${out.detail}` : ""}`);
      continue;
    }
    const { data: after } = await db.from("questions").select("status").eq("id", q.id).single();
    const verdict = out.report?.passed ? "PASSED" : `FAILED: ${out.report ? flagReason(out.report) : "no report"}`;
    console.log(`#${q.id} ${it.slug}: changed ${out.changed.join(", ") || "nothing"}${out.corrected ? " (Corrected)" : ""} · checks ${verdict} · status ${after!.status}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
