/**
 * Trusted datasets for data-backed questions (SPEC §8, M5 task 5.2). The numbers
 * in a data-backed question come from these APIs, never from the model.
 *  - World Bank Indicators API: api.worldbank.org/v2
 *  - Our World in Data grapher CSV + metadata: ourworldindata.org/grapher/<slug>
 * `fetchFn` is injectable so tests run on recorded fixtures.
 */
import { parseCsvRecords } from "./csv";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SeriesPoint {
  year: number;
  value: number;
}

export interface Series {
  source: "worldbank" | "owid";
  /** Indicator code (World Bank) or grapher slug (OWID). */
  id: string;
  /** Entity code: World Bank ISO3/aggregate (WLD) or OWID code (OWID_WRL). */
  entity: string;
  entityName: string;
  /** Dataset's own name for the measure, e.g. "Population, total". */
  label: string;
  unit: string | null;
  /** Publisher, as shown under the reveal ("World Bank" / "Our World in Data"). */
  publisher: string;
  /** Longer citation for the audit trail. */
  citation: string;
  /** Human-readable page for the source link. */
  url: string;
  points: SeriesPoint[];
}

const HEADERS = { "user-agent": "changel-content-pipeline", accept: "application/json, text/csv" };

async function getOk(fetchFn: FetchLike, url: string): Promise<Response> {
  const res = await fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

const finite = (p: { year: number; value: number }) => Number.isInteger(p.year) && Number.isFinite(p.value);

interface WbRow {
  date: string;
  value: number | null;
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  unit?: string;
}

export async function fetchWorldBank(indicator: string, country = "WLD", fetchFn: FetchLike = fetch): Promise<Series> {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}?format=json&date=1960:2100&per_page=500`;
  const body = (await (await getOk(fetchFn, url)).json()) as [unknown, WbRow[] | null] | [{ message: unknown }];
  const rows = Array.isArray(body) && Array.isArray(body[1]) ? body[1] : null;
  if (!rows?.length) throw new Error(`World Bank ${indicator}/${country}: no data`);
  const first = rows[0]!;
  return {
    source: "worldbank",
    id: indicator,
    entity: country,
    entityName: first.country.value,
    label: first.indicator.value,
    unit: first.unit || null,
    publisher: "World Bank",
    citation: `World Bank, World Development Indicators: ${first.indicator.value} (${indicator})`,
    url: `https://data.worldbank.org/indicator/${indicator}`,
    points: rows
      .filter((r) => r.value !== null)
      .map((r) => ({ year: Number(r.date), value: Number(r.value) }))
      .filter(finite)
      .sort((a, b) => a.year - b.year),
  };
}

interface OwidMeta {
  columns: Record<string, { titleShort?: string; titleLong?: string; unit?: string; shortUnit?: string; citationShort?: string }>;
}

export async function fetchOwid(slug: string, entity = "OWID_WRL", fetchFn: FetchLike = fetch): Promise<Series> {
  const q = `v=1&csvType=filtered&useColumnShortNames=true&country=~${encodeURIComponent(entity)}`;
  const base = `https://ourworldindata.org/grapher/${encodeURIComponent(slug)}`;
  const [csvRes, metaRes] = await Promise.all([getOk(fetchFn, `${base}.csv?${q}`), getOk(fetchFn, `${base}.metadata.json?${q}`)]);
  const records = parseCsvRecords(await csvRes.text());
  const meta = (await metaRes.json()) as OwidMeta;
  if (!records.length) throw new Error(`OWID ${slug}/${entity}: no data`);
  const valueCol = Object.keys(records[0]!).find((k) => !["entity", "code", "year"].includes(k));
  if (!valueCol) throw new Error(`OWID ${slug}: no value column`);
  const col = meta.columns[valueCol] ?? Object.values(meta.columns)[0] ?? {};
  return {
    source: "owid",
    id: slug,
    entity,
    entityName: records[0]!.entity ?? entity,
    label: col.titleShort ?? col.titleLong ?? slug,
    unit: col.unit || col.shortUnit || null,
    publisher: "Our World in Data",
    citation: col.citationShort ? `Our World in Data: ${col.citationShort}` : "Our World in Data",
    url: base,
    points: records
      .map((r) => ({ year: Number(r.year), value: r[valueCol] === "" ? Number.NaN : Number(r[valueCol]) }))
      .filter(finite)
      .sort((a, b) => a.year - b.year),
  };
}

/** The value for an exact year, if the series has it. */
export function valueAt(s: Series, year: number): number | null {
  return s.points.find((p) => p.year === year)?.value ?? null;
}
