import { prisma } from "./prisma";

export type GeoPoint = {
  id: string;
  address: string;
  lat: number;
  lng: number;
};

let geoColumnsReady: Promise<void> | null = null;

export async function ensureAddressGeoColumns() {
  if (!geoColumnsReady) {
    geoColumnsReady = Promise.all([
      prisma.$executeRawUnsafe(
        `ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`,
      ),
      prisma.$executeRawUnsafe(
        `ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
      ),
    ])
      .then(() => undefined)
      .catch(() => undefined);
  }
  await geoColumnsReady;
}

function cleanPart(value: string | null | undefined) {
  const text = (value || "").replace(/[—–]/g, " ").replace(/\s+/g, " ").trim();
  if (!text || text === "-" || text === ",") return "";
  return text;
}

function displayAddress(row: {
  line1: string;
  city: string;
  state: string;
  zip: string;
}) {
  const line1 = cleanPart(row.line1);
  const zip = cleanPart(row.zip) || line1.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "";
  const city = cleanPart(row.city);
  const state = cleanPart(row.state);
  if (/minneapolis/i.test(line1) && /\bMN\b/i.test(line1)) {
    return line1;
  }
  return [line1, city || "Minneapolis", `${state || "MN"} ${zip}`.trim()]
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();
}

function canGeocode(line1: string) {
  const value = line1.trim().toLowerCase();
  if (value.length < 5) return false;
  if (value.includes("pending")) return false;
  if (!/\d/.test(value)) return false;
  return true;
}

async function censusGeocode(query: string) {
  const url = new URL(
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
  );
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    result?: {
      addressMatches?: Array<{ coordinates?: { x?: number; y?: number } }>;
    };
  };
  const match = payload.result?.addressMatches?.[0]?.coordinates;
  if (typeof match?.y !== "number" || typeof match?.x !== "number") return null;
  return { lat: match.y, lng: match.x };
}

async function nominatimGeocode(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      Accept: "application/json",
      "User-Agent": "AMPMFlow/1.0 (askar@automationllc.org)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
  }>;
  const lat = Number(payload[0]?.lat);
  const lng = Number(payload[0]?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function geocodeAndSaveAddress(addressId: string) {
  await ensureAddressGeoColumns();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      line1: string;
      city: string;
      state: string;
      zip: string;
      latitude: number | null;
      longitude: number | null;
    }>
  >`
    SELECT "id", "line1", "city", "state", "zip", "latitude", "longitude"
    FROM "Address"
    WHERE "id" = ${addressId}
    LIMIT 1
  `.catch(() => []);
  const row = rows[0];
  if (!row || !canGeocode(row.line1)) return null;
  if (row.latitude != null && row.longitude != null) {
    return {
      id: row.id,
      address: displayAddress(row),
      lat: Number(row.latitude),
      lng: Number(row.longitude),
    };
  }

  const query = displayAddress(row);
  const found =
    (await censusGeocode(query).catch(() => null)) ||
    (await nominatimGeocode(query).catch(() => null));
  if (!found) return null;

  await prisma.$executeRaw`
    UPDATE "Address"
    SET "latitude" = ${found.lat}, "longitude" = ${found.lng}
    WHERE "id" = ${row.id}
  `.catch(() => undefined);

  return {
    id: row.id,
    address: query,
    lat: found.lat,
    lng: found.lng,
  };
}

export async function loadSchoolGeoPoints(
  schoolId: string,
  addressIds: string[],
  options?: { geocode?: boolean; limit?: number; priorityIds?: string[] },
) {
  await ensureAddressGeoColumns();
  const ids = [...new Set(addressIds.filter(Boolean))];
  if (!ids.length) return new Map<string, GeoPoint>();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      line1: string;
      city: string;
      state: string;
      zip: string;
      latitude: number | null;
      longitude: number | null;
    }>
  >`
    SELECT "id", "line1", "city", "state", "zip", "latitude", "longitude"
    FROM "Address"
    WHERE "schoolId" = ${schoolId}
  `.catch(() => []);

  const wanted = new Set(ids);
  const missing: string[] = [];
  const points = new Map<string, GeoPoint>();
  for (const row of rows) {
    if (!wanted.has(row.id)) continue;
    if (row.latitude != null && row.longitude != null) {
      points.set(row.id, {
        id: row.id,
        address: displayAddress(row),
        lat: Number(row.latitude),
        lng: Number(row.longitude),
      });
    } else if (canGeocode(row.line1)) {
      missing.push(row.id);
    }
  }

  const priority = new Set(options?.priorityIds || []);
  missing.sort((a, b) => Number(priority.has(b)) - Number(priority.has(a)));
  const toGeocode = options?.geocode ? missing.slice(0, options.limit ?? 12) : [];
  for (let index = 0; index < toGeocode.length; index += 4) {
    const chunk = toGeocode.slice(index, index + 5);
    const found = await Promise.all(
      chunk.map((id) => geocodeAndSaveAddress(id).catch(() => null)),
    );
    for (const point of found) {
      if (point) points.set(point.id, point);
    }
  }
  return points;
}
