/**
 * Question bank rows (content/questions.csv → public.questions).
 * Validation mirrors the DB constraints so bad rows fail before they hit Postgres.
 */
import { z } from "zod";
import { FORMATS, type Format } from "../format";
import { parseCsvRecords } from "./csv";

/** Formats whose values keep full precision (records, ages). Everything else is rounded to 3 s.f. (DECISIONS item 3). */
const KEEP_PRECISION: ReadonlySet<Format> = new Set<Format>(["sec", "time", "yrs"]);

export function roundForStorage(value: number, format: Format): number {
  return KEEP_PRECISION.has(format) ? value : Number(value.toPrecision(3));
}

/** CSV cells are "" when empty; treat that as missing so defaults apply. */
const blankToUndefined = (v: unknown) => (v === "" ? undefined : v);

const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s));

const optionalUrl = optionalText.refine((s) => s === null || /^https?:\/\/\S+$/.test(s), "must be an http(s) URL");

export const QuestionRowSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase words joined by hyphens"),
    category: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(3).max(200),
    start_year: z.coerce.number().int().min(-10000).max(2200),
    start_value: z.coerce.number().positive(),
    end_year: z.coerce.number().int().min(-10000).max(2200),
    end_value: z.coerce.number().positive(),
    format: z.enum(FORMATS),
    fact: optionalText,
    source_name: optionalText,
    source_url: optionalUrl,
    source_url_2: optionalUrl,
    region: z.preprocess(blankToUndefined, z.enum(["global", "AU", "US", "UK"]).default("global")),
    tags: z
      .string()
      .default("")
      .transform((s) => s.split(";").map((t) => t.trim()).filter(Boolean)),
    status: z.preprocess(blankToUndefined, z.enum(["draft", "flagged", "verified", "scheduled", "used", "retired"]).default("draft")),
    notes: optionalText,
  })
  .transform((q) => ({
    ...q,
    start_value: roundForStorage(q.start_value, q.format),
    end_value: roundForStorage(q.end_value, q.format),
  }))
  .superRefine((q, ctx) => {
    if (q.end_year <= q.start_year) ctx.addIssue({ code: "custom", path: ["end_year"], message: "must be after start_year" });
    if (Math.abs(Math.log10(q.end_value / q.start_value)) > 3) {
      ctx.addIssue({ code: "custom", path: ["end_value"], message: "change must be within ÷1000 to ×1000" });
    }
  });

export type QuestionRow = z.output<typeof QuestionRowSchema>;

export interface ParseResult {
  rows: QuestionRow[];
  errors: string[];
}

/** Parse and validate the whole CSV. Never throws for bad rows; collects errors instead. */
export function parseQuestionsCsv(text: string): ParseResult {
  const rows: QuestionRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  parseCsvRecords(text).forEach((rec, i) => {
    const line = i + 2;
    const r = QuestionRowSchema.safeParse(rec);
    if (!r.success) {
      errors.push(`Line ${line} (${rec.slug || "no slug"}): ${r.error.issues.map((e) => `${e.path.join(".")} ${e.message}`).join("; ")}`);
      return;
    }
    if (seen.has(r.data.slug)) {
      errors.push(`Line ${line}: duplicate slug ${r.data.slug}`);
      return;
    }
    seen.add(r.data.slug);
    rows.push(r.data);
  });
  return { rows, errors };
}

/** Fields the importer may overwrite on an existing question (never status/verification). */
export const CONTENT_FIELDS = [
  "category", "prompt", "start_year", "start_value", "end_year", "end_value", "format",
  "fact", "source_name", "source_url", "source_url_2", "region", "tags", "notes",
] as const;
