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
};

function apiKey() {
  return (process.env.ONESTEP_GPS_API_KEY || "").trim();
}

export function onestepGpsConfigured() {
  return Boolean(apiKey());
}

export function schoolGpsPoint(): { lat: number; lng: number } | null {
  const lat = Number(
    process.env.ONESTEP_SCHOOL_LAT || process.env.SCHOOL_GPS_LAT || "",
  );
  const lng = Number(
    process.env.ONESTEP_SCHOOL_LNG || process.env.SCHOOL_GPS_LNG || "",
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function num(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractDevices(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = asRecord(payload);
  if (!row) return [];
  for (const key of ["result", "results", "devices", "data", "rows"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}

function extractPoint(device: Record<string, unknown>) {
  const nested =
    asRecord(device.latest_device_point) ||
    asRecord(device.latest_point) ||
    asRecord(device.latestPoint) ||
    asRecord(device.point) ||
    asRecord(device.location) ||
    device;

  const lat = num(
    nested?.lat,
    nested?.latitude,
    nested?.y,
    device.lat,
    device.latitude,
  );
  const lng = num(
    nested?.lng,
    nested?.lon,
    nested?.longitude,
    nested?.x,
    device.lng,
    device.longitude,
  );
  if (lat == null || lng == null) return null;

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

  return { lat, lng, updatedAt };
}

/**
 * Aim Academy (Minnehaha): OneStep unit numbers → school bus labels.
 * 1038 = Bus 5, 1119 = Bus 4. Third bus will be added when the company sends it.
 * Override/extend with ONESTEP_BUS_MAP like: 1038=Bus 5,1119=Bus 4
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

/** School bus labels currently wired from OneStep (Aim: Bus 4 + Bus 5). */
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

/** Always show Aim’s 3-bus fleet: live units + pending slot until unit # arrives. */
export function withAimFleetSlots(buses: LiveBusPoint[]): LiveBusPoint[] {
  const byLabel = new Map(buses.map((bus) => [bus.label, bus]));
  const ordered: LiveBusPoint[] = [];
  for (const label of trackedBusLabels()) {
    const live = byLabel.get(label);
    if (live) ordered.push(live);
  }
  // Keep any unexpected mapped buses, then the pending third seat.
  for (const bus of buses) {
    if (!ordered.some((row) => row.id === bus.id)) ordered.push(bus);
  }
  if (!ordered.some((bus) => bus.label === AIM_GPS_PENDING_LABEL)) {
    ordered.push(pendingAimBus());
  }
  return ordered;
}

function mappedDeviceLabel(device: Record<string, unknown>) {
  const map = busLabelMap();
  for (const token of deviceTokens(device)) {
    const mapped = map[token] || map[token.replace(/\D/g, "")];
    if (mapped) return mapped;
  }
  return "";
}

function deviceTokens(device: Record<string, unknown>) {
  return [
    text(device.id, device.device_id, device.deviceId, device.imei),
    text(
      device.display_name,
      device.displayName,
      device.name,
      device.device_name,
      device.deviceName,
      device.label,
      device.plate_number,
      device.vin_name,
    ),
  ]
    .filter(Boolean)
    .flatMap((value) => {
      const digits = value.match(/\d{3,}/g) || [];
      return [value, value.toLowerCase(), ...digits];
    });
}

function deviceLabel(device: Record<string, unknown>, index: number) {
  return (
    mappedDeviceLabel(device) ||
    text(
      device.display_name,
      device.displayName,
      device.name,
      device.device_name,
      device.deviceName,
      device.label,
      device.plate_number,
      device.vin_name,
    ) ||
    `Bus ${index + 1}`
  );
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
  // Rough city average ~15 mph for arrival estimate.
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

export async function fetchOneStepLiveBuses(): Promise<LiveGpsFeed> {
  const fetchedAt = new Date().toISOString();
  const school = schoolGpsPoint();
  const key = apiKey();
  if (!key) {
    return {
      configured: false,
      live: false,
      school,
      buses: [],
      fetchedAt,
      error: "ONESTEP_GPS_API_KEY is not set in Vercel.",
    };
  }

  try {
    const url = `${ONESTEP_DEVICES_URL}&api-key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        configured: true,
        live: false,
        school,
        buses: [],
        fetchedAt,
        error: `OneStep GPS returned ${response.status}${
          body ? `: ${body.slice(0, 120)}` : ""
        }`,
      };
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const devices = extractDevices(payload);
    const parsed: Array<{
      id: string;
      label: string;
      lat: number;
      lng: number;
      updatedAt: string | null;
    }> = [];

    devices.forEach((item, index) => {
      const device = asRecord(item);
      if (!device) return;
      const label = mappedDeviceLabel(device);
      // Only show buses we have mapped (Aim: Bus 4 + Bus 5 for now).
      if (!label) return;
      const point = extractPoint(device);
      if (!point) return;
      parsed.push({
        id: text(device.id, device.device_id, device.imei) || `device-${index}`,
        label,
        lat: point.lat,
        lng: point.lng,
        updatedAt: point.updatedAt,
      });
    });

    const maps = projectMap(
      parsed.map((row) => ({ lat: row.lat, lng: row.lng })),
      school,
    );

    const liveBuses: LiveBusPoint[] = parsed.map((row, index) => {
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

    liveBuses.sort((a, b) => {
      if (a.etaMinutes == null && b.etaMinutes == null) {
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      }
      if (a.etaMinutes == null) return 1;
      if (b.etaMinutes == null) return -1;
      return a.etaMinutes - b.etaMinutes;
    });

    const buses = withAimFleetSlots(liveBuses);

    return {
      configured: true,
      live: liveBuses.length > 0,
      school,
      buses,
      fetchedAt,
    };
  } catch (error) {
    return {
      configured: true,
      live: false,
      school,
      buses: [],
      fetchedAt,
      error:
        error instanceof Error
          ? error.message
          : "Could not reach OneStep GPS.",
    };
  }
}
