import worldCities from "./world-cities.json";

export type City = {
  id: string;
  name: string;
  country: string;
  region: string;
  iana: string;
  pop: number;
};

type RawSlim = {
  id: string;
  name: string;
  country: string;
  region: string;
  iana: string;
  pop: number;
};

export const CITIES: City[] = worldCities as RawSlim[];

const byId = new Map(CITIES.map((c) => [c.id, c]));

const abbrCache = new Map<string, string[]>();

/** Short zone labels from Jan/Jul samples (e.g. EST / EDT). */
export function zoneAbbrs(iana: string): string[] {
  const cached = abbrCache.get(iana);
  if (cached) return cached;

  const year = new Date().getFullYear();
  const labels = new Set<string>();
  for (const month of [0, 6]) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "short",
      hour: "numeric",
    }).formatToParts(new Date(Date.UTC(year, month, 15, 12)));
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (name && !/^GMT|^UTC/i.test(name)) labels.add(name);
  }

  if (labels.size === 0) {
    const offsetParts = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "shortOffset",
      hour: "numeric",
    }).formatToParts(new Date(Date.UTC(year, 0, 15, 12)));
    const off = offsetParts.find((p) => p.type === "timeZoneName")?.value;
    if (off) labels.add(off.replace("GMT", "UTC"));
  }

  const result = [...labels];
  abbrCache.set(iana, result);
  return result;
}

// Warm abbr cache for unique zones once (hundreds, not thousands).
for (const iana of new Set(CITIES.map((c) => c.iana))) {
  zoneAbbrs(iana);
}

/** Stable defaults used by the UI. */
export const DEFAULT_SOURCE_ID =
  CITIES.find((c) => c.name === "Bengaluru" && c.country === "India")?.id ??
  CITIES[0]!.id;

export const DEFAULT_TARGET_IDS = [
  CITIES.find((c) => c.name === "New York" && c.country === "USA")?.id,
  CITIES.find((c) => c.name === "London" && c.country === "UK")?.id,
].filter((id): id is string => Boolean(id));

export function getCityById(id: string): City | undefined {
  return byId.get(id);
}

function scoreMatch(city: City, q: string): number {
  const name = city.name.toLowerCase();
  const country = city.country.toLowerCase();
  const region = city.region.toLowerCase();
  const iana = city.iana.toLowerCase();
  const abbrs = zoneAbbrs(city.iana);
  const abbrJoined = abbrs.join(" ").toLowerCase();

  if (name === q) return 1000;
  if (name.startsWith(q)) return 800;
  if (abbrs.some((a) => a.toLowerCase() === q)) return 700;
  if (region.startsWith(q)) return 500;
  if (name.includes(q)) return 400;
  if (country.startsWith(q) || country.includes(q)) return 200;
  if (iana.includes(q) || abbrJoined.includes(q) || region.includes(q))
    return 100;
  return 0;
}

export function searchCities(query: string, excludeIds: string[] = []): City[] {
  const excluded = new Set(excludeIds);
  const pool = CITIES.filter((c) => !excluded.has(c.id));
  const q = query.trim().toLowerCase();

  if (!q) {
    return pool.slice(0, 40);
  }

  return pool
    .map((c) => ({ c, score: scoreMatch(c, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.c.pop - a.c.pop)
    .map((x) => x.c);
}

export function cityLabel(city: City): string {
  const abbr = zoneAbbrs(city.iana)[0];
  return abbr ? `${city.name} · ${abbr}` : city.name;
}

export function cityMeta(city: City): string {
  const bits = [city.region, city.country].filter(Boolean);
  const place = bits.join(", ");
  const abbr = zoneAbbrs(city.iana).join(" / ");
  if (place && abbr) return `${place} · ${abbr}`;
  return place || abbr || city.iana;
}
