import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuestionsCsv, roundForStorage } from "@/lib/content/questions";
import { devSeedPlan, prototypeOrder } from "@/lib/content/dev-seed";
import { loadPrototype } from "../helpers/prototype";

const csv = readFileSync("content/questions.csv", "utf8");
const header = "slug,category,prompt,start_year,start_value,end_year,end_value,format,max_change,fact,source_name,source_url,source_url_2,region,tags,status,notes";
const row = (over: Record<string, string> = {}) => {
  const base: Record<string, string> = {
    slug: "test-q", category: "Test", prompt: "A test question", start_year: "2000", start_value: "100",
    end_year: "2020", end_value: "250", format: "int", max_change: "10", fact: "", source_name: "", source_url: "",
    source_url_2: "", region: "", tags: "", status: "", notes: "",
  };
  const r = { ...base, ...over };
  return header + "\n" + header.split(",").map((k) => JSON.stringify(r[k] ?? "")).join(",") + "\n";
};

describe("content/questions.csv", () => {
  const { rows, errors } = parseQuestionsCsv(csv);

  it("parses all 20 seed questions with no errors", () => {
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(20);
  });

  it("is in the prototype pool's order (the dev seed relies on it)", () => {
    expect(rows.map((r) => r.prompt)).toEqual(loadPrototype().POOL.map((p) => p.q));
  });

  it("rounds values to 3 significant figures except sec/time/yrs", () => {
    const tesla = rows.find((r) => r.slug === "tesla-deliveries-2014-2023")!;
    expect([tesla.start_value, tesla.end_value]).toEqual([31700, 1810000]);
    const sprint = rows.find((r) => r.slug === "mens-100m-record-1968-2009")!;
    expect(sprint.end_value).toBe(9.58);
    const marathon = rows.find((r) => r.slug === "womens-marathon-record-1985-2024")!;
    expect([marathon.start_value, marathon.end_value]).toEqual([8466, 7796]);
  });
});

describe("question row validation", () => {
  it("defaults region/status and splits tags", () => {
    const { rows, errors } = parseQuestionsCsv(row({ tags: "a; b;;c" }));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ region: "global", status: "draft", tags: ["a", "b", "c"], fact: null });
  });

  it.each([
    [{ start_value: "0" }, "start_value"],
    [{ end_year: "1999" }, "end_year"],
    [{ end_value: "150000" }, "end_value"], // ×1500 (100001 would round to exactly ×1000, which is allowed)
    [{ format: "gbp" }, "format"],
    [{ slug: "Bad Slug" }, "slug"],
    [{ region: "NZ" }, "region"],
    [{ source_url: "ftp://x" }, "source_url"],
    [{ max_change: "" }, "needs max_change"], // every question needs a range
    [{ max_change: "2.6" }, "85% of the way"], // answer (×2.5) hard against the end of the slider
    [{ max_change: "1.01" }, "too small"],
    [{ max_change: "2000" }, "too big"],
  ])("rejects %o", (over, field) => {
    const { rows, errors } = parseQuestionsCsv(row(over));
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain(field);
  });

  it("rejects duplicate slugs", () => {
    const one = row();
    const twice = one + one.split("\n")[1] + "\n";
    expect(parseQuestionsCsv(twice).errors[0]).toMatch(/duplicate slug/);
  });

  it("roundForStorage", () => {
    expect(roundForStorage(40199, "int")).toBe(40200);
    expect(roundForStorage(0.0012345, "usd")).toBe(0.00123);
    expect(roundForStorage(9.581, "sec")).toBe(9.581);
  });
});

describe("dev seed plan", () => {
  const { rows } = parseQuestionsCsv(csv);
  const plan = devSeedPlan(rows.map((r) => r.slug));
  const proto = loadPrototype();

  it("matches the prototype's shuffle", () => {
    expect(prototypeOrder(20)).toEqual(proto.order);
  });

  it("schedules 4 days from 2026-11-09 with every question exactly once", () => {
    expect(plan.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    const all = plan.flatMap((d) => d.slugs);
    expect(new Set(all).size).toBe(20);
  });

  it("each day has the prototype's 5 questions in order", () => {
    plan.forEach((day, d) => {
      const expected = Array.from({ length: 5 }, (_, i) => proto.POOL[proto.order[d * 5 + i]!]!.q);
      expect(day.slugs.map((s) => rows.find((r) => r.slug === s)!.prompt)).toEqual(expected);
    });
  });
});
