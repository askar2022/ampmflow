"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageUsers, getSession } from "@/lib/auth";

export async function updateSchoolIdentity(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) return;

  const name = String(formData.get("schoolName") || "").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  if (!name) return;

  try {
    await prisma.school.update({
      where: { id: session.schoolId },
      data: { name, logoUrl },
    });
  } catch {
    await prisma.school.update({
      where: { id: session.schoolId },
      data: { name },
    });
  }

  revalidatePath("/");
  revalidatePath("/login");
  revalidatePath("/admin/users");
}
