/**
 * DEV-ONLY M1 fixture: the 20 questions from reference/prototype.html and its
 * seeded daily selection, so the app shows exactly the prototype's rounds for
 * any date (needed for screenshot parity). Delete in M2 (task 2.7).
 * Figures are rounded approximations. They are seed candidates, not verified content.
 */
import type { Format } from "../format";

export interface FixtureQuestion {
  cat: string; q: string; y0: number; v0: number; y1: number; v1: number;
  fmt: Format; fact: string; src: string;
}

export const POOL: readonly FixtureQuestion[] = [
  {cat:"People", q:"World population", y0:1975, v0:4.07e9, y1:2025, v1:8.2e9, fmt:"big", fact:"It took all of human history to reach 4 billion, and just 50 years to double it.", src:"UN World Population Prospects"},
  {cat:"Sport", q:"Men's 100m world record", y0:1968, v0:9.95, y1:2009, v1:9.58, fmt:"sec", fact:"Forty years of training science shaved off just 0.37 seconds. Usain Bolt's 9.58 still stands.", src:"World Athletics"},
  {cat:"Energy", q:"Price of a solar panel, per watt", y0:1976, v0:106, y1:2023, v1:0.31, fmt:"usd", fact:"Solar got ~99.7% cheaper. One of the fastest cost collapses of any technology, ever.", src:"Our World in Data / IRENA (approx.)"},
  {cat:"Money", q:"US federal minimum wage (per hour)", y0:1970, v0:1.60, y1:2025, v1:7.25, fmt:"usd", fact:"It hasn't moved since 2009 — the longest stretch without a raise since it was created in 1938.", src:"US Dept. of Labor"},
  {cat:"Buildings", q:"Height of the world's tallest building", y0:1931, v0:381, y1:2010, v1:828, fmt:"m", fact:"Empire State Building → Burj Khalifa. Taller, yes, but only about 2× in 80 years.", src:"CTBUH"},
  {cat:"Health", q:"Global life expectancy at birth", y0:1950, v0:46, y1:2023, v1:73, fmt:"yrs", fact:"The average newborn now gets roughly 27 more years than one born in 1950.", src:"UN WPP (approx.)"},
  {cat:"Streaming", q:"Netflix paid subscribers", y0:2014, v0:57.4e6, y1:2024, v1:301.6e6, fmt:"big", fact:"Netflix stopped reporting subscriber counts after crossing 300 million.", src:"Netflix shareholder letters"},
  {cat:"Nature", q:"Wild giant pandas", y0:1988, v0:1114, y1:2014, v1:1864, fmt:"int", fact:"Pandas were downgraded from 'Endangered' to 'Vulnerable' in 2016.", src:"China national panda surveys"},
  {cat:"Crypto", q:"Price of one Bitcoin", y0:2015, v0:314, y1:2025, v1:94400, fmt:"usd", fact:"Measured on 1 January each year. A $1,000 bet in 2015 would be worth ~$300k.", src:"CoinMarketCap (approx.)"},
  {cat:"Internet", q:"English Wikipedia articles", y0:2006, v0:1e6, y1:2020, v1:6e6, fmt:"big", fact:"Article #6,000,000 landed in January 2020: a biography of a Canadian writer.", src:"Wikipedia"},
  {cat:"Coffee", q:"Starbucks stores worldwide", y0:2000, v0:3501, y1:2024, v1:40199, fmt:"int", fact:"Roughly 4 new Starbucks a day, every day, for 24 years.", src:"Starbucks annual reports (approx.)"},
  {cat:"Climate", q:"Arctic sea ice, September minimum (km²)", y0:1980, v0:7.7e6, y1:2012, v1:3.39e6, fmt:"big", fact:"2012 is still the record low — less than half the extent of 1980.", src:"NSIDC (approx.)"},
  {cat:"Politics", q:"Member states of the United Nations", y0:1945, v0:51, y1:2011, v1:193, fmt:"int", fact:"South Sudan became the 193rd member in 2011. Nobody has joined since.", src:"United Nations"},
  {cat:"Money", q:"Price of a US first-class stamp", y0:1970, v0:0.06, y1:2025, v1:0.78, fmt:"usd", fact:"13× more expensive — far faster than general inflation over the same period.", src:"USPS"},
  {cat:"Climate", q:"CO₂ in the atmosphere (ppm)", y0:1960, v0:317, y1:2024, v1:424, fmt:"int", fact:"Sounds small? Pre-industrial levels were ~280 ppm for thousands of years.", src:"NOAA Mauna Loa"},
  {cat:"Cars", q:"Tesla vehicles delivered per year", y0:2014, v0:31655, y1:2023, v1:1808581, fmt:"big", fact:"From a niche roadster maker to ~1.8 million cars a year in under a decade.", src:"Tesla delivery reports"},
  {cat:"Movies", q:"Average US cinema ticket", y0:1980, v0:2.69, y1:2023, v1:10.78, fmt:"usd", fact:"Popcorn prices, sadly, are not tracked by the official stats.", src:"National Association of Theatre Owners"},
  {cat:"Internet", q:"People using the internet", y0:2000, v0:4.1e8, y1:2024, v1:5.5e9, fmt:"big", fact:"About two-thirds of humanity is now online — up from under 7% in 2000.", src:"ITU (approx.)"},
  {cat:"Space", q:"Orbital rocket launches per year", y0:2000, v0:85, y1:2024, v1:259, fmt:"int", fact:"SpaceX alone flew more than half of 2024's launches.", src:"Launch logs (approx.)"},
  {cat:"Sport", q:"Women's marathon world record", y0:1985, v0:8466, y1:2024, v1:7796, fmt:"time", fact:"Ruth Chepngetich's 2:09:56 in Chicago cut nearly two minutes off the old record.", src:"World Athletics"},
];

/** The prototype's EPOCH: Changel #1 = 9 Nov 2026. */
export const PROTOTYPE_EPOCH = "2026-11-09";
const SHUFFLE_SEED = 20261109;

/** The prototype's mulberry32-style PRNG, verbatim. */
function seeded(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle of pool indices with the prototype's seed. */
export const ORDER: readonly number[] = (() => {
  const order = POOL.map((_, i) => i);
  const r = seeded(SHUFFLE_SEED);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
})();

/** The prototype's selection: 5 consecutive items of the shuffled pool per day. */
export function questionsForDay(dayNum: number, rounds = 5): FixtureQuestion[] {
  const d = Math.max(0, dayNum);
  return Array.from({ length: rounds }, (_, i) => POOL[ORDER[(d * rounds + i) % POOL.length]!]!);
}
