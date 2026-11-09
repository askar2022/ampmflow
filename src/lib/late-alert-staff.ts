import { prisma } from "./prisma";
import { parentSmsNumbers } from "./sms";

let staffColumnsReady: Promise<void> | null = null;

async function ensureLateAlertStaffColumns() {
  if (!staffColumnsReady) {
    staffColumnsReady = Promise.all([
      prisma.$executeRawUnsafe(
        `ALTER TABLE "SchoolSettings" ADD COLUMN IF NOT EXISTS "lateAlertStaffPhone1" TEXT NOT NULL DEFAULT ''`,
      ),
      prisma.$executeRawUnsafe(
        `ALTER TABLE "SchoolSettings" ADD COLUMN IF NOT EXISTS "lateAlertStaffPhone2" TEXT NOT NULL DEFAULT ''`,
      ),
    ])
      .then(() => undefined)
      .catch(() => undefined);
  }
  await staffColumnsReady;
}

export type LateAlertStaffPhones = {
  phone1: string;
  phone2: string;
};

export async function loadLateAlertStaffPhones(
  schoolId: string,
): Promise<LateAlertStaffPhones> {
  await ensureLateAlertStaffColumns();
  try {
    const rows = await prisma.$queryRaw<
      Array<{ lateAlertStaffPhone1: string; lateAlertStaffPhone2: string }>
    >`
      SELECT "lateAlertStaffPhone1", "lateAlertStaffPhone2"
      FROM "SchoolSettings"
      WHERE "schoolId" = ${schoolId}
    `;
    return {
      phone1: rows[0]?.lateAlertStaffPhone1 || "",
      phone2: rows[0]?.lateAlertStaffPhone2 || "",
    };
  } catch {
    return { phone1: "", phone2: "" };
  }
}

export async function saveLateAlertStaffPhones(
  schoolId: string,
  phones: LateAlertStaffPhones,
) {
  await ensureLateAlertStaffColumns();
  const phone1 = phones.phone1.trim();
  const phone2 = phones.phone2.trim();
  if (phone1 && !parentSmsNumbers(phone1).length) {
    return { ok: false as const, error: "Staff phone 1 is not a valid mobile number." };
  }
  if (phone2 && !parentSmsNumbers(phone2).length) {
    return { ok: false as const, error: "Staff phone 2 is not a valid mobile number." };
  }

  const existing = await prisma.schoolSettings.findUnique({
    where: { schoolId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.schoolSettings.create({
      data: { schoolId },
    });
  }

  await prisma.$executeRaw`
    UPDATE "SchoolSettings"
    SET
      "lateAlertStaffPhone1" = ${phone1},
      "lateAlertStaffPhone2" = ${phone2}
    WHERE "schoolId" = ${schoolId}
  `;

  return {
    ok: true as const,
    phones: { phone1, phone2 },
  };
}

export function lateAlertStaffSmsNumbers(phones: LateAlertStaffPhones) {
  return parentSmsNumbers(phones.phone1, phones.phone2);
}
