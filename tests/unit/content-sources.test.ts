import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchOwid, fetchWorldBank, valueAt, type FetchLike } from "@/lib/content/sources";

const fixture = (name: string) => readFileSync(`tests/fixtures/content/${name}`, "utf8");

/** Serves recorded responses by URL prefix; anything else is a test failure. */
function fakeFetch(routes: Record<string, string>): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    if (!hit) return new Response("not found", { status: 404 });
    return new Response(hit[1], { status: 200 });
  }) as FetchLike & { urls: string[] };
  fn.urls = urls;
  return fn;
}

describe("World Bank", () => {
  const f = fakeFetch({ "https://api.worldbank.org/v2/country/WLD/indicator/SP.POP.TOTL": fixture("wb-SP.POP.TOTL-WLD.json") });

  it("reads a series with its name, publisher and link", async () => {
    const s = await fetchWorldBank("SP.POP.TOTL", "WLD", f);
    expect(s).toMatchObject({ source: "worldbank", id: "SP.POP.TOTL", entity: "WLD", entityName: "World", label: "Population, total", publisher: "World Bank" });
    expect(s.url).toBe("https://data.worldbank.org/indicator/SP.POP.TOTL");
    expect(s.points[0]!.year).toBe(1960);
    expect(valueAt(s, 1960)).toBe(3021512598);
    expect(valueAt(s, 2024)).toBe(8140897523);
    expect(s.points.every((p, i, a) => i === 0 || p.year > a[i - 1]!.year)).toBe(true);
  });

  it("fails clearly on an HTTP error or an empty series", async () => {
    await expect(fetchWorldBank("NOPE", "WLD", f)).rejects.toThrow(/HTTP 404/);
    const empty = fakeFetch({ "https://api.worldbank.org": JSON.stringify([{ message: [{ id: "120", value: "Invalid value" }] }]) });
    await expect(fetchWorldBank("SP.POP.TOTL", "WLD", empty)).rejects.toThrow(/no data/);
  });
});

describe("Our World in Data", () => {
  const f = fakeFetch({
    "https://ourworldindata.org/grapher/life-expectancy.csv": fixture("owid-life-expectancy-OWID_WRL.csv"),
    "https://ourworldindata.org/grapher/life-expectancy.metadata.json": fixture("owid-life-expectancy.metadata.json"),
  });

  it("reads a grapher series with units and citation", async () => {
    const s = await fetchOwid("life-expectancy", "OWID_WRL", f);
    expect(s).toMatchObject({ source: "owid", id: "life-expectancy", entity: "OWID_WRL", entityName: "World", label: "Life expectancy", unit: "years", publisher: "Our World in Data" });
    expect(s.citation).toMatch(/^Our World in Data: /);
    expect(s.url).toBe("https://ourworldindata.org/grapher/life-expectancy");
    expect(valueAt(s, 1800)).toBe(28.5);
    expect(s.points.length).toBeGreaterThan(20);
    expect(f.urls.every((u) => u.includes("country=~OWID_WRL"))).toBe(true);
  });
});
