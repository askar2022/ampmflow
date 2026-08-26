import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function rawDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  ).trim();
}

function databaseUrl() {
  const url = rawDatabaseUrl();
  if (!url || url.includes("[YOUR-PASSWORD]") || url.startsWith("http")) {
    return "";
  }
  return url;
}

export function isDatabaseConfigured() {
  return Boolean(databaseUrl());
}

function describeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === "postgresql:" ? "5432" : ""),
    };
  } catch {
    return { host: "", port: "" };
  }
}

export async function checkDatabase() {
  const raw = rawDatabaseUrl();
  if (!raw) {
    return { ok: false as const, reason: "missing" as const, host: "", port: "", code: "" };
  }
  if (raw.startsWith("http")) {
    return { ok: false as const, reason: "http" as const, host: "", port: "", code: "" };
  }
  if (raw.includes("[YOUR-PASSWORD]")) {
    return { ok: false as const, reason: "placeholder" as const, host: "", port: "", code: "" };
  }

  const { host, port } = describeUrl(raw);
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true as const, reason: "ok" as const, host, port, code: "" };
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";
    return { ok: false as const, reason: "unreachable" as const, host, port, code };
  }
}

const FALLBACK_URL = "postgresql://unused:unused@127.0.0.1:5432/unused";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: databaseUrl() || FALLBACK_URL } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
