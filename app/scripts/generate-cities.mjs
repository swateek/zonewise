/**
 * Regenerates src/data/world-cities.json from city-timezones + extras.
 * Run: node scripts/generate-cities.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cityTimezones from "city-timezones";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../src/data/world-cities.json");

const EXTRA = [
  { city: "Cupertino", city_ascii: "Cupertino", lat: 37.323, lng: -122.032, pop: 60170, country: "United States of America", iso2: "US", province: "California", timezone: "America/Los_Angeles" },
  { city: "Mountain View", city_ascii: "Mountain View", lat: 37.386, lng: -122.084, pop: 82739, country: "United States of America", iso2: "US", province: "California", timezone: "America/Los_Angeles" },
  { city: "Palo Alto", city_ascii: "Palo Alto", lat: 37.442, lng: -122.143, pop: 68572, country: "United States of America", iso2: "US", province: "California", timezone: "America/Los_Angeles" },
  { city: "Menlo Park", city_ascii: "Menlo Park", lat: 37.453, lng: -122.182, pop: 33780, country: "United States of America", iso2: "US", province: "California", timezone: "America/Los_Angeles" },
  { city: "Sunnyvale", city_ascii: "Sunnyvale", lat: 37.369, lng: -122.036, pop: 155805, country: "United States of America", iso2: "US", province: "California", timezone: "America/Los_Angeles" },
  { city: "Redmond", city_ascii: "Redmond", lat: 47.674, lng: -122.122, pop: 75256, country: "United States of America", iso2: "US", province: "Washington", timezone: "America/Los_Angeles" },
  { city: "Bellevue", city_ascii: "Bellevue", lat: 47.610, lng: -122.201, pop: 151854, country: "United States of America", iso2: "US", province: "Washington", timezone: "America/Los_Angeles" },
  { city: "UTC", city_ascii: "UTC", lat: 0, lng: 0, pop: 9e15, country: "Worldwide", iso2: "ZZ", province: "", timezone: "UTC" },
];

const COUNTRY_SHORT = {
  "United States of America": "USA",
  "United Kingdom": "UK",
  "United Arab Emirates": "UAE",
  "Russian Federation": "Russia",
  "Korea, South": "South Korea",
  "Korea, North": "North Korea",
};

function slug(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function shortCountry(country) {
  return COUNTRY_SHORT[country] ?? country;
}

const seen = new Set();
const out = [];
let skipped = 0;

for (const raw of [...cityTimezones.cityMapping, ...EXTRA]) {
  const timezone = (raw.timezone || "").trim();
  if (!timezone) {
    skipped++;
    continue;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    skipped++;
    continue;
  }
  const iso2 = String(raw.iso2 || "xx").toLowerCase();
  const lat = Number(raw.lat) || 0;
  const lng = Number(raw.lng) || 0;
  const id = [
    slug(raw.city_ascii || raw.city),
    iso2,
    slug(timezone),
    lat.toFixed(2),
    lng.toFixed(2),
  ].join("--");
  if (seen.has(id)) continue;
  seen.add(id);
  out.push({
    id,
    name: raw.city,
    country: shortCountry(raw.country || ""),
    region: (raw.province || "").trim(),
    iana: timezone,
    pop: Number(raw.pop) || 0,
  });
}

out.sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name));
writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${out.length} cities → ${outPath} (skipped ${skipped})`);
