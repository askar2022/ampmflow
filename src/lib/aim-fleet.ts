import { randomUUID } from "crypto";
import { ensureGateTables, loadVehicles } from "./gate";
import { prisma } from "./prisma";

/** Minnehaha’s Aim fleet: Bus 4, Bus 5, and a 3rd bus (name TBD). No vans. */
export const AIM_FLEET_LABELS = ["Bus 4", "Bus 5", "3rd bus"] as const;

export function isAimSchool(name?: string | null) {
  return Boolean(name && /aim/i.test(name));
}

function looksLikeOldAimVan(name: string) {
  const n = name.trim().toLowerCase();
  return (
    /^van\s*[123]$/i.test(n) ||
    /^[123]$/.test(n) ||
    n === "van 1" ||
    n === "van 2" ||
    n === "van 3"
  );
}

/**
 * Convert Aim Academy sample “Van 1/2/3” rows into the real Minnehaha bus names
 * and make sure all three fleet slots exist.
 */
export async function ensureAimFleetVehicles(schoolId: string) {
  await ensureGateTables();
  const vehicles = await loadVehicles(schoolId);

  const byNorm = new Map(
    vehicles.map((vehicle) => [vehicle.name.trim().toLowerCase(), vehicle]),
  );

  // Prefer renaming existing Van 1/2/3 (keeps student vehicleId links).
  const oldVans = vehicles
    .filter((vehicle) => looksLikeOldAimVan(vehicle.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  for (let i = 0; i < AIM_FLEET_LABELS.length; i += 1) {
    const target = AIM_FLEET_LABELS[i];
    const targetKey = target.toLowerCase();
    if (byNorm.has(targetKey)) {
      const row = byNorm.get(targetKey)!;
      if (row.vehicleType.toUpperCase() !== "BUS") {
        await prisma.$executeRaw`
          UPDATE "TransportVehicle"
          SET "vehicleType" = ${"BUS"}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${row.id} AND "schoolId" = ${schoolId}
        `.catch(() => undefined);
      }
      continue;
    }

    const source = oldVans[i];
    if (source) {
      // Avoid unique-name clashes while renaming.
      const temp = `__aim_rename_${i}_${Date.now()}`;
      await prisma.$executeRaw`
        UPDATE "TransportVehicle"
        SET "name" = ${temp}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${source.id} AND "schoolId" = ${schoolId}
      `.catch(() => undefined);
      await prisma.$executeRaw`
        UPDATE "TransportVehicle"
        SET
          "name" = ${target},
          "vehicleType" = ${"BUS"},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${source.id} AND "schoolId" = ${schoolId}
      `.catch(() => undefined);
      byNorm.delete(source.name.trim().toLowerCase());
      byNorm.set(targetKey, { ...source, name: target, vehicleType: "BUS" });
      continue;
    }

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "TransportVehicle"
        ("id", "schoolId", "name", "vehicleType", "driverName", "driverPhone", "createdAt", "updatedAt")
      VALUES
        (${id}, ${schoolId}, ${target}, ${"BUS"}, ${""}, ${""}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `.catch(() => undefined);
  }

  // Any leftover Aim “Van …” rows become BUS with Bus prefix (no vans at Aim).
  const leftover = await loadVehicles(schoolId);
  for (const vehicle of leftover) {
    if (!/van/i.test(vehicle.name) && vehicle.vehicleType.toUpperCase() !== "VAN") {
      continue;
    }
    if (AIM_FLEET_LABELS.some((label) => label.toLowerCase() === vehicle.name.trim().toLowerCase())) {
      continue;
    }
    const cleaned = vehicle.name.replace(/^Van\s+/i, "").trim() || "bus";
    const nextName = /^bus\b/i.test(cleaned) || /3rd bus/i.test(cleaned)
      ? cleaned
      : `Bus ${cleaned}`;
    await prisma.$executeRaw`
      UPDATE "TransportVehicle"
      SET
        "name" = ${nextName},
        "vehicleType" = ${"BUS"},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${vehicle.id} AND "schoolId" = ${schoolId}
    `.catch(() => undefined);
  }

  return loadVehicles(schoolId);
}
