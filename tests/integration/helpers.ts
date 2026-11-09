import { readFileSync } from "node:fs";
import { TEST_CLOCK_HEADER } from "@/lib/api/clock";
import { devSeedPlan } from "@/lib/content/dev-seed";
import { parseQuestionsCsv, type QuestionRow } from "@/lib/content/questions";

/** Expected content of the dev seed puzzles, from the same CSV the seed used. */
const rows = parseQuestionsCsv(readFileSync("content/questions.csv", "utf8")).rows;
const plan = devSeedPlan(rows.filter((r) => r.tags.includes("prototype")).map((r) => r.slug));
export function seededRounds(date: string): QuestionRow[] {
  const day = plan.find((d) => d.date === date);
  if (!day) throw new Error(`No dev seed for ${date}`);
  return day.slugs.map((s) => rows.find((r) => r.slug === s)!);
}

export function get(path: string, now?: string): Request {
  return new Request(`http://localhost${path}`, { headers: now ? { [TEST_CLOCK_HEADER]: now } : {} });
}

export function post(path: string, body: unknown, now?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(now ? { [TEST_CLOCK_HEADER]: now } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
