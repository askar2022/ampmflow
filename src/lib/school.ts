import { prisma } from "@/lib/prisma";

export const APP_NAME = "AMPM Flow";
export const APP_SUBTITLE = "Student Transportation & Dismissal";
export const APP_TAGLINE = "Safe arrivals. Organized dismissals.";
export const DEFAULT_SCHOOL_LOGO = "/sankofa-prep-logo.png";

export type SchoolIdentity = {
  name: string;
  logoUrl: string | null;
};

export type SchoolTheme = {
  navy: string;
  navyDeep: string;
};

export function schoolTheme(name?: string | null): SchoolTheme {
  if (name && /aim/i.test(name)) {
    return { navy: "#0f5f56", navyDeep: "#0a403a" };
  }
  return { navy: "#0b2942", navyDeep: "#081f33" };
}

export function schoolInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isUsableLogo(url: string | null | undefined) {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes("sankofa-logo.jpg") || /wakanda/i.test(trimmed)) {
    return false;
  }
  return true;
}

function identityFromRecord(school: {
  name: string;
  logoUrl?: string | null;
}): SchoolIdentity {
  const name = school.name;
  if (isUsableLogo(school.logoUrl)) {
    return { name, logoUrl: school.logoUrl!.trim() };
  }
  return {
    name,
    logoUrl: /sankofa/i.test(name)
      ? DEFAULT_SCHOOL_LOGO
      : /aim/i.test(name)
        ? "/demo-2.jpg"
        : null,
  };
}

export async function getSchoolIdentity(): Promise<SchoolIdentity | null> {
  try {
    const school = await prisma.school.findFirst({
      select: { name: true, logoUrl: true },
      orderBy: { createdAt: "asc" },
    });
    return school ? identityFromRecord(school) : null;
  } catch {
    try {
      const school = await prisma.school.findFirst({
        select: { name: true },
        orderBy: { createdAt: "asc" },
      });
      return school ? identityFromRecord(school) : null;
    } catch {
      return null;
    }
  }
}

export async function getSchoolIdentityById(
  schoolId: string,
): Promise<SchoolIdentity | null> {
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, logoUrl: true },
    });
    return school ? identityFromRecord(school) : null;
  } catch {
    const school = await prisma.school
      .findUnique({
        where: { id: schoolId },
        select: { name: true },
      })
      .catch(() => null);
    return school ? identityFromRecord(school) : null;
  }
}
