import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function databaseUrl() {
  const url = process.env.DATABASE_URL || "";
  if (!url || url.includes("[YOUR-PASSWORD]") || url.startsWith("http")) {
    return "";
  }
  return url;
}

export function isDatabaseConfigured() {
  return Boolean(databaseUrl());
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
