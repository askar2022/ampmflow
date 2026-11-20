import { AIM_FLEET_LABELS, isAimSchool } from "./aim-fleet";

/** Nia-Nur International Academy — Dayip fleet. */
export const NIA_BUS_NUMBERS = ["1", "2"] as const;
export const NIA_VAN_LABELS = [
  "Van 1",
  "Van 2",
  "Van 3",
  "Van 4",
  "Van 5",
  "Van 6",
  "Van 7",
] as const;

export function isNiaSchool(name?: string | null) {
  return Boolean(name && /nia|nur/i.test(name));
}

export type CompanyFleet = {
  buses: string[];
  vans: { id: string; name: string }[];
  hideVan: boolean;
  /** When true, ignore leftover BusRoute / TransportVehicle rows. */
  locked: boolean;
};

/** Fixed bus/van choices for known schools so company assign matches the campus. */
export function companyFleetForSchool(
  schoolName?: string | null,
): CompanyFleet | null {
  if (isAimSchool(schoolName)) {
    return {
      buses: AIM_FLEET_LABELS.map(
        (label) => label.replace(/^Bus\s+/i, "").trim() || label,
      ),
      vans: [],
      hideVan: true,
      locked: true,
    };
  }
  if (isNiaSchool(schoolName)) {
    return {
      buses: [...NIA_BUS_NUMBERS],
      vans: NIA_VAN_LABELS.map((name, index) => ({
        id: `nia-van-${index + 1}`,
        name,
      })),
      hideVan: false,
      locked: true,
    };
  }
  return null;
}

/** Normalize typed van input to "Van N". Rejects empty / Van 0. */
export function normalizeVanLabel(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const num = trimmed.replace(/^van\s+/i, "").trim();
  if (!num || num === "0") return "";
  if (!/^[A-Za-z0-9-]+$/.test(num)) return "";
  return `Van ${num}`;
}

/** Normalize typed bus input to the route number (no "Bus " prefix). */
export function normalizeBusNumber(raw: string) {
  return raw.replace(/^Bus\s+/i, "").trim();
}
