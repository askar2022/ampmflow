"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canCompanyAccessSchool, schoolStaffEmails } from "@/lib/company-access";
import { sendMail, smtpConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { loadStudent } from "@/lib/transportation";

export async function requestCompanyClarification(input: {
  studentId: string;
  note: string;
}) {
  const user = await getSession();
  if (!user || user.role !== "BUS_COMPANY") {
    return { ok: false as const, error: "Only the bus company can ask this." };
  }

  const note = input.note.trim();
  if (note.length < 3) {
    return {
      ok: false as const,
      error: "Write what you need the school to check.",
    };
  }

  const loaded = await loadStudent(input.studentId);
  if (!loaded) return { ok: false as const, error: "Student not found." };
  const schoolId = loaded.record.schoolId;
  if (!(await canCompanyAccessSchool(user, schoolId))) {
    return { ok: false as const, error: "That school is not on your list." };
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });
  const open = await prisma.changeRequest.findFirst({
    where: {
      schoolId,
      studentId: input.studentId,
      status: { in: ["PENDING", "NEEDS_CLARIFICATION"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (open) {
    await prisma.changeRequest.update({
      where: { id: open.id },
      data: {
        status: "NEEDS_CLARIFICATION",
        companyNote: note,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  } else {
    await prisma.changeRequest.create({
      data: {
        schoolId,
        studentId: input.studentId,
        source: "BUS_COMPANY",
        title: "Needs clarification",
        details: note,
        status: "NEEDS_CLARIFICATION",
        companyNote: note,
        createdById: user.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  const sent: string[] = [];
  if (smtpConfigured()) {
    const staff = await schoolStaffEmails(schoolId);
    if (staff.length) {
      const result = await sendMail({
        to: staff,
        subject: `${loaded.effective.fullName} needs clarification`,
        text: [
          "AMPM Flow — bus company needs a check",
          "",
          `School: ${school?.name || "School"}`,
          `Student: ${loaded.effective.fullName}`,
          `Grade: ${loaded.effective.grade}`,
          "",
          note,
          "",
          "The student address and daycare stay with the school. Open Front Desk or Today’s Changes to correct it.",
        ].join("\n"),
      });
      if (result.sent) sent.push(...staff);
    }
  }

  revalidatePath("/company");
  revalidatePath("/changes");
  revalidatePath("/dashboard");
  return { ok: true as const, sent };
}
