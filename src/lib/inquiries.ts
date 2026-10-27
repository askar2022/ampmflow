import { randomUUID } from "crypto";
import { prisma } from "./prisma";

export type SchoolInquiry = {
  id: string;
  schoolName: string;
  name: string;
  email: string;
  note: string;
  status: string;
  createdAt: Date;
};

async function ensureInquiryTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SchoolInquiry" (
      "id" TEXT PRIMARY KEY,
      "schoolName" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "note" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function saveSchoolInquiry(args: {
  schoolName: string;
  name: string;
  email: string;
  note?: string;
}) {
  await ensureInquiryTable();
  const id = randomUUID().replace(/-/g, "").slice(0, 24);
  await prisma.$executeRaw`
    INSERT INTO "SchoolInquiry" ("id", "schoolName", "name", "email", "note", "status", "createdAt")
    VALUES (${id}, ${args.schoolName}, ${args.name}, ${args.email}, ${args.note || ""}, 'PENDING', CURRENT_TIMESTAMP)
  `;
  return id;
}

export async function loadPendingInquiries() {
  try {
    await ensureInquiryTable();
    return prisma.$queryRaw<SchoolInquiry[]>`
      SELECT "id", "schoolName", "name", "email", "note", "status", "createdAt"
      FROM "SchoolInquiry"
      WHERE "status" = 'PENDING'
      ORDER BY "createdAt" DESC
    `;
  } catch {
    return [];
  }
}

export async function markInquirySetup(email: string, schoolName: string) {
  try {
    await ensureInquiryTable();
    await prisma.$executeRaw`
      UPDATE "SchoolInquiry"
      SET "status" = 'SETUP'
      WHERE "status" = 'PENDING'
        AND lower("email") = ${email.toLowerCase()}
        AND lower("schoolName") = ${schoolName.toLowerCase()}
    `;
  } catch {
    return;
  }
}
