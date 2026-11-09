/**
 * Curated world-level series for data-backed questions (M5 task 5.3). Every entry
 * was checked live on 2026-11-09 to return a World series. Global only (Dani:
 * no country bias; country versions may come later). One series makes at most one
 * question: the duplicate key for data-backed questions is (source, id, entity).
 */
import type { Format } from "../format";

export interface CatalogEntry {
  source: "worldbank" | "owid";
  /** World Bank indicator code or OWID grapher slug. */
  id: string;
  /** World Bank "WLD", OWID "OWID_WRL". */
  entity: string;
  category: string;
  format: Format;
  /** Plain-English measure + unit, given to the wording step so the prompt states units correctly. */
  measure: string;
  /** Money series: whether values are nominal or inflation-adjusted (the prompt must say so). */
  money?: "nominal" | "inflation-adjusted";
  /** Earliest start year worth asking about (older data can be patchy). */
  minYear?: number;
}

const wb = (id: string, category: string, format: Format, measure: string, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({ source: "worldbank", id, entity: "WLD", category, format, measure, ...extra });
const owid = (id: string, category: string, format: Format, measure: string, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({ source: "owid", id, entity: "OWID_WRL", category, format, measure, ...extra });

export const CATALOG: readonly CatalogEntry[] = [
  // People
  wb("SP.POP.TOTL", "People", "big", "people alive worldwide"),
  wb("SP.URB.TOTL", "People", "big", "people living in cities and towns worldwide"),
  wb("SP.DYN.TFRT.IN", "People", "big", "average births per woman worldwide"),
  wb("SP.DYN.CBRT.IN", "People", "big", "births per 1,000 people per year worldwide"),
  wb("SP.POP.65UP.TO.ZS", "People", "pct", "share of the world's people aged 65 or over (%)"),
  wb("SP.POP.0014.TO.ZS", "People", "pct", "share of the world's people aged under 15 (%)"),
  wb("EN.POP.DNST", "People", "big", "people per square km of land, worldwide"),
  // Health
  owid("life-expectancy", "Health", "yrs", "life expectancy at birth worldwide (years)", { minYear: 1950 }),
  wb("SH.H2O.BASW.ZS", "Health", "pct", "share of people with at least basic drinking water (%)"),
  wb("SH.STA.BASS.ZS", "Health", "pct", "share of people with at least basic sanitation (%)"),
  owid("daily-per-capita-caloric-supply", "Food", "int", "food calories available per person per day (kcal)"),
  // Money
  wb("NY.GDP.MKTP.CD", "Money", "usd", "world GDP in US dollars", { money: "nominal" }),
  wb("NY.GDP.PCAP.CD", "Money", "usd", "world GDP per person in US dollars", { money: "nominal" }),
  wb("BX.TRF.PWKR.CD.DT", "Money", "usd", "money migrants send home (remittances received) worldwide, US dollars", { money: "nominal" }),
  wb("NE.TRD.GNFS.ZS", "Money", "pct", "world trade as a share of world GDP (%)"),
  wb("SI.POV.DDAY", "Money", "pct", "share of people living on under $3 a day (2021 prices) (%)"),
  wb("SL.TLF.CACT.FE.ZS", "Work", "pct", "share of women aged 15+ in the labour force worldwide (%)"),
  wb("NV.AGR.TOTL.ZS", "Work", "pct", "farming, forestry and fishing as a share of world GDP (%)"),
  // Tech + internet
  wb("IT.CEL.SETS", "Tech", "big", "mobile phone subscriptions worldwide", { minYear: 1990 }),
  wb("IT.CEL.SETS.P2", "Tech", "big", "mobile phone subscriptions per 100 people worldwide", { minYear: 1990 }),
  owid("number-of-internet-users", "Internet", "big", "people using the internet worldwide"),
  wb("IT.NET.USER.ZS", "Internet", "pct", "share of people using the internet worldwide (%)"),
  wb("IT.NET.BBND.P2", "Internet", "big", "fixed broadband subscriptions per 100 people worldwide"),
  // Science + education
  wb("IP.PAT.RESD", "Science", "big", "patent applications filed by residents worldwide per year"),
  wb("IP.JRN.ARTC.SC", "Science", "big", "scientific and technical journal articles published worldwide per year"),
  wb("SE.ADT.LITR.ZS", "Education", "pct", "share of adults (15+) who can read and write worldwide (%)"),
  wb("SE.TER.ENRR", "Education", "pct", "university enrolment worldwide, gross (% of the age group)"),
  // Energy
  wb("EG.ELC.ACCS.ZS", "Energy", "pct", "share of people with access to electricity (%)"),
  wb("EG.USE.ELEC.KH.PC", "Energy", "int", "electricity used per person worldwide per year (kWh)"),
  owid("installed-solar-pv-capacity", "Energy", "big", "solar power capacity installed worldwide (gigawatts)"),
  owid("solar-pv-prices", "Energy", "usd", "price of solar panels per watt (US dollars, inflation-adjusted)", { money: "inflation-adjusted" }),
  owid("share-electricity-solar", "Energy", "pct", "share of the world's electricity from solar (%)", { minYear: 2000 }),
  owid("share-electricity-wind", "Energy", "pct", "share of the world's electricity from wind (%)", { minYear: 2000 }),
  owid("share-electricity-renewables", "Energy", "pct", "share of the world's electricity from renewables (%)", { minYear: 1965 }),
  owid("electricity-generation", "Energy", "big", "electricity generated worldwide per year (terawatt-hours)", { minYear: 1965 }),
  owid("coal-consumption-by-country-terawatt-hours-twh", "Energy", "big", "coal burned worldwide per year (terawatt-hours of energy)", { minYear: 1965 }),
  owid("oil-consumption-by-country", "Energy", "big", "oil used worldwide per year (terawatt-hours of energy)", { minYear: 1965 }),
  owid("per-capita-energy-use", "Energy", "int", "energy used per person worldwide per year (kWh)", { minYear: 1965 }),
  // Climate + nature
  owid("annual-co2-emissions-per-country", "Climate", "big", "CO₂ emitted worldwide per year (tonnes)", { minYear: 1950 }),
  owid("co-emissions-per-capita", "Climate", "big", "CO₂ emitted per person worldwide per year (tonnes)", { minYear: 1950 }),
  wb("AG.LND.FRST.ZS", "Nature", "pct", "share of the world's land covered by forest (%)"),
  wb("AG.LND.ARBL.HA.PC", "Food", "big", "farmland (arable land) per person worldwide (hectares)"),
  // Food
  owid("global-meat-production", "Food", "big", "meat produced worldwide per year (tonnes)"),
  wb("AG.YLD.CREL.KG", "Food", "int", "cereal harvest per hectare worldwide (kg)"),
  owid("wheat-yields", "Food", "big", "wheat harvested per hectare worldwide (tonnes)"),
  owid("rice-yields", "Food", "big", "rice harvested per hectare worldwide (tonnes)"),
  owid("maize-yields", "Food", "big", "maize harvested per hectare worldwide (tonnes)"),
  owid("fish-and-seafood-consumption-per-capita", "Food", "big", "fish and seafood eaten per person worldwide per year (kg)"),
  owid("global-plastics-production", "Stuff", "big", "plastic produced worldwide per year (tonnes)"),
  // Travel
  wb("IS.AIR.PSGR", "Travel", "big", "airline passengers carried worldwide per year"),
  wb("IS.AIR.DPRT", "Travel", "big", "airline flights (departures) worldwide per year"),
  wb("ST.INT.ARVL", "Travel", "big", "international tourist arrivals worldwide per year"),
];
