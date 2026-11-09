/** Expected content of the dev seed puzzles, derived from the same CSV + plan the seed script used. */
import { readFileSync } from "node:fs";
import { devSeedPlan } from "@/lib/content/dev-seed";
import { parseQuestionsCsv, type QuestionRow } from "@/lib/content/questions";

export const seedRows: QuestionRow[] = parseQuestionsCsv(readFileSync("content/questions.csv", "utf8")).rows;
const plan = devSeedPlan(seedRows.filter((r) => r.tags.includes("prototype")).map((r) => r.slug));

export function seededRounds(date: string): QuestionRow[] {
  const day = plan.find((d) => d.date === date);
  if (!day) throw new Error(`No dev seed for ${date}`);
  return day.slugs.map((s) => seedRows.find((r) => r.slug === s)!);
}
