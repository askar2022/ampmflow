import { milesBetween } from "./geocode";

const ONESTEP_DEVICES_URL =
  "https://track.onestepgps.com/v3/api/public/device?latest_point=true";

export type LiveBusPoint = {
  id: string;
  label: string;
  lat: number | null;
  lng: number | null;
  miles: number | null;
  etaMinutes: number | null;
  status: "On route" | "Arriving" | "At school" | "No signal" | "GPS soon";
  updatedAt: string | null;
  pending?: boolean;
  map: { left: string; top: string };
};

/** Minnehaha runs 3 Aim buses. Two GPS units known; third unit # coming later. */
export const AIM_GPS_FLEET = ["Bus 4", "Bus 5", "3rd bus"] as const;
export const AIM_GPS_PENDING_LABEL = "3rd bus";

export type LiveGpsFeed = {
  configured: boolean;
  live: boolean;
  error?: string;
  school: { lat: number; lng: number } | null;
  buses: LiveBusPoint[];
  fetchedAt: string;
  debug?: string;
};

function apiKey() {
  return (process.env.ONESTEP_GPS_API_KEY || "").trim();
}

export function onestepGpsConfigured() {
  return Boolean(apiKey());
}

export function schoolGpsPoint(): { lat: number; lng: number } | null {
  const latRaw = (
    process.env.ONESTEP_SCHOOL_LAT ||
    process.env.SCHOOL_GPS_LAT ||
    ""
  ).trim();
  const lngRaw = (
    process.env.ONESTEP_SCHOOL_LNG ||
    process.env.SCHOOL_GPS_LNG ||
    ""
  ).trim();
  if (!latRaw || !lngRaw) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  // Empty env used to become 0,0 and show thousands of fake miles.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.includes(",")) {
      const [a, b] = value.split(",").map((part) => Number(part.trim()));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        // Prefer lat,lng order when both look valid.
        if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return a;
      }
    }
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function extractDevices(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = asRecord(payload);
  if (!row) return [];
  for (const key of [
    "result_list",
    "result",
    "results",
    "devices",
    "data",
    "rows",
    "items",
    "list",
  ]) {
    const value = row[key];
    if (Array.isArray(value)) return value;
    const nested = asRecord(value);
    if (nested) {
      for (const inner of [
        "result_list",
        "result",
        "results",
        "devices",
        "data",
        "rows",
      ]) {
        if (Array.isArray(nested[inner])) return nested[inner] as unknown[];
      }
    }
  }
  return [];
}

function deepLatLng(
  value: unknown,
  depth = 0,
): { lat: number; lng: number } | null {
  if (value == null || depth > 5) return null;

  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      const a = value[0];
      const b = value[1];
      // GeoJSON is often [lng, lat]
      if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return { lat: b, lng: a };
      if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
    }
    for (const item of value) {
      const found = deepLatLng(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const row = asRecord(value);
  if (!row) return null;

  const lat = num(
    row.lat,
    row.latitude,
    row.Latitude,
    row.LAT,
    row.y,
    row.Y,
  );
  const lng = num(
    row.lng,
    row.lon,
    row.long,
    row.longitude,
    row.Longitude,
    row.LNG,
    row.LON,
    row.x,
    row.X,
  );
  if (
    lat != null &&
    lng != null &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  ) {
    return { lat, lng };
  }

  if (typeof row.lat_lng === "string" || typeof row.latlng === "string") {
    const raw = String(row.lat_lng || row.latlng);
    const [a, b] = raw.split(",").map((part) => Number(part.trim()));
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90) {
      return { lat: a, lng: b };
    }
  }

  for (const key of [
    "latest_device_point",
    "latest_point",
    "latestPoint",
    "last_point",
    "point",
    "location",
    "gps",
    "position",
    "coords",
    "coordinates",
  ]) {
    if (key in row) {
      const found = deepLatLng(row[key], depth + 1);
      if (found) return found;
    }
  }

  for (const child of Object.values(row)) {
    if (child && typeof child === "object") {
      const found = deepLatLng(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractPoint(device: Record<string, unknown>) {
  const point = deepLatLng(device);
  if (!point) return null;
  const nested =
    asRecord(device.latest_device_point) ||
    asRecord(device.latest_point) ||
    asRecord(device.latestPoint) ||
    device;
  const updatedAt =
    text(
      nested?.dt_tracker,
      nested?.dt_server,
      nested?.timestamp,
      nested?.updated_at,
      nested?.time,
      device.dt_tracker,
      device.updated_at,
    ) || null;
  return { ...point, updatedAt };
}

/**
 * Aim Academy (Minnehaha): OneStep unit numbers → school bus labels.
 * 1038 = Bus 5, 1119 = Bus 4. Third bus will be added when the company sends it.
 */
function busLabelMap() {
  const defaults: Record<string, string> = {
    "1038": "Bus 5",
    "1119": "Bus 4",
  };
  const raw = (process.env.ONESTEP_BUS_MAP || "").trim();
  if (!raw) return defaults;
  for (const part of raw.split(/[,;]+/)) {
    const [id, ...rest] = part.split("=");
    const key = (id || "").trim();
    const label = rest.join("=").trim();
    if (key && label) defaults[key] = label;
  }
  return defaults;
}

export function trackedBusLabels() {
  return [...new Set(Object.values(busLabelMap()))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function pendingAimBus(): LiveBusPoint {
  return {
    id: "pending-third",
    label: AIM_GPS_PENDING_LABEL,
    lat: null,
    lng: null,
    miles: null,
    etaMinutes: null,
    status: "GPS soon",
    updatedAt: null,
    pending: true,
    map: { left: "62%", top: "48%" },
  };
}

export function withAimFleetSlots(buses: LiveBusPoint[]): LiveBusPoint[] {
  const byLabel = new Map(buses.map((bus) => [bus.label, bus]));
  const ordered: LiveBusPoint[] = [];
  for (const label of trackedBusLabels()) {
    const live = byLabel.get(label);
    if (live) ordered.push(live);
  }
  for (const bus of buses) {
    if (!ordered.some((row) => row.id === bus.id)) ordered.push(bus);
  }
  if (!ordered.some((bus) => bus.label === AIM_GPS_PENDING_LABEL)) {
    ordered.push(pendingAimBus());
  }
  return ordered;
}

function deviceDisplayName(device: Record<string, unknown>) {
  return text(
    device.display_name,
    device.displayName,
    device.name,
    device.device_name,
    device.deviceName,
    device.label,
    device.plate_number,
    device.vin_name,
    device.device_id,
    device.id,
  );
}

function mappedDeviceLabel(device: Record<string, unknown>) {
  const map = busLabelMap();
  const blob = JSON.stringify(device).toLowerCase();

  // Strong match on known unit numbers anywhere in the device payload.
  for (const [unit, label] of Object.entries(map)) {
    if (blob.includes(unit.toLowerCase())) return label;
  }

  const name = deviceDisplayName(device).toLowerCase();
  if (/\bbus\s*4\b/.test(name) || name === "4") return "Bus 4";
  if (/\bbus\s*5\b/.test(name) || name === "5") return "Bus 5";

  return "";
}

function statusForMiles(miles: number | null): LiveBusPoint["status"] {
  if (miles == null) return "On route";
  if (miles <= 0.15) return "At school";
  if (miles <= 0.6) return "Arriving";
  return "On route";
}

function etaFromMiles(miles: number | null) {
  if (miles == null) return null;
  if (miles <= 0.15) return 0;
  return Math.max(1, Math.round((miles / 15) * 60));
}

function projectMap(
  points: Array<{ lat: number; lng: number }>,
  school: { lat: number; lng: number } | null,
) {
  const all = school ? [...points, school] : points;
  if (!all.length) return [] as Array<{ left: string; top: string }>;

  const lats = all.map((point) => point.lat);
  const lngs = all.map((point) => point.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  if (minLat === maxLat) {
    minLat -= 0.01;
    maxLat += 0.01;
  }
  if (minLng === maxLng) {
    minLng -= 0.01;
    maxLng += 0.01;
  }
  const padLat = (maxLat - minLat) * 0.15;
  const padLng = (maxLng - minLng) * 0.15;
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;

  return points.map((point) => {
    const x = (point.lng - minLng) / (maxLng - minLng);
    const y = (maxLat - point.lat) / (maxLat - minLat);
    return {
      left: `${Math.round(12 + x * 76)}%`,
      top: `${Math.round(14 + y * 72)}%`,
    };
  });
}

async function requestDevices(key: string) {
  const attempts: Array<{ label: string; url: string; headers?: HeadersInit }> =
    [
      {
        label: "query-api-key",
        url: `${ONESTEP_DEVICES_URL}&api-key=${encodeURIComponent(key)}`,
      },
      {
        label: "query-api_key",
        url: `${ONESTEP_DEVICES_URL}&api_key=${encodeURIComponent(key)}`,
      },
      {
        label: "header-x-api-key",
        url: ONESTEP_DEVICES_URL,
        headers: { "X-API-Key": key, Accept: "application/json" },
      },
    ];

  let lastError = "";
  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(attempt.headers || {}),
      },
    });
    const raw = await response.text();
    if (!response.ok) {
      lastError = `${attempt.label} → ${response.status}: ${raw.slice(0, 100)}`;
      continue;
    }
    let payload: unknown = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      lastError = `${attempt.label} → not JSON: ${raw.slice(0, 100)}`;
      continue;
    }
    const devices = extractDevices(payload);
    if (devices.length) {
      return { devices, via: attempt.label, rawPreview: raw.slice(0, 240) };
    }
    // Accept empty array as a valid successful response.
    if (Array.isArray(payload) || asRecord(payload)) {
      return { devices, via: attempt.label, rawPreview: raw.slice(0, 240) };
    }
    lastError = `${attempt.label} → unexpected shape`;
  }
  throw new Error(lastError || "OneStep GPS request failed.");
}

export async function fetchOneStepLiveBuses(): Promise<LiveGpsFeed> {
  const fetchedAt = new Date().toISOString();
  const school = schoolGpsPoint();
  const key = apiKey();
  if (!key) {
    return {
      configured: false,
      live: false,
      school,
      buses: withAimFleetSlots([]),
      fetchedAt,
      error: "ONESTEP_GPS_API_KEY is not set in Vercel.",
    };
  }

  try {
    const { devices, via, rawPreview } = await requestDevices(key);
    const names: string[] = [];
    const parsed: Array<{
      id: string;
      label: string;
      lat: number;
      lng: number;
      updatedAt: string | null;
    }> = [];
    let withPoints = 0;

    devices.forEach((item, index) => {
      const device = asRecord(item);
      if (!device) return;
      const name = deviceDisplayName(device) || `device-${index + 1}`;
      names.push(name);
      const point = extractPoint(device);
      if (point) withPoints += 1;
      const label = mappedDeviceLabel(device);
      if (!label || !point) return;
      parsed.push({
        id: text(device.id, device.device_id, device.imei) || `device-${index}`,
        label,
        lat: point.lat,
        lng: point.lng,
        updatedAt: point.updatedAt,
      });
    });

    // De-dupe by bus label (prefer first).
    const unique = new Map<string, (typeof parsed)[number]>();
    for (const row of parsed) {
      if (!unique.has(row.label)) unique.set(row.label, row);
    }
    const uniqueRows = [...unique.values()];

    const maps = projectMap(
      uniqueRows.map((row) => ({ lat: row.lat, lng: row.lng })),
      school,
    );

    const liveBuses: LiveBusPoint[] = uniqueRows.map((row, index) => {
      const miles = school
        ? Number(milesBetween(school, row).toFixed(1))
        : null;
      return {
        id: row.id,
        label: row.label,
        lat: row.lat,
        lng: row.lng,
        miles,
        etaMinutes: etaFromMiles(miles),
        status: statusForMiles(miles),
        updatedAt: row.updatedAt,
        map: maps[index] || { left: "50%", top: "50%" },
      };
    });

    liveBuses.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

    const buses = withAimFleetSlots(liveBuses);
    let error: string | undefined;
    if (!devices.length) {
      error =
        "OneStep connected, but returned 0 devices. Ask Minnehaha to confirm the API key includes Aim Bus 4 (1119) and Bus 5 (1038).";
    } else if (!liveBuses.length) {
      const sample = names.slice(0, 8).join(", ") || "unnamed";
      error = `OneStep returned ${devices.length} device(s), ${withPoints} with GPS points, but none matched unit 1038/1119 yet. Devices seen: ${sample}.`;
    }

    return {
      configured: true,
      live: liveBuses.length > 0,
      school,
      buses,
      fetchedAt,
      error,
      debug: `via=${via}; devices=${devices.length}; points=${withPoints}; matched=${liveBuses.length}; preview=${rawPreview}`,
    };
  } catch (error) {
    return {
      configured: true,
      live: false,
      school,
      buses: withAimFleetSlots([]),
      fetchedAt,
      error:
        error instanceof Error
          ? error.message
          : "Could not reach OneStep GPS.",
    };
  }
}
