"use server";

import { redirect } from "next/navigation";
import { emailNewSchoolRequest } from "@/lib/school-request-email";
import { saveSchoolInquiry } from "@/lib/inquiries";
import { usableOpsEmail } from "@/lib/ops-change-emails";

export async function submitSchoolInquiry(formData: FormData) {
  const schoolName = String(formData.get("schoolName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const note = String(formData.get("note") || "").trim();

  if (!schoolName || !name || !usableOpsEmail(email)) {
    redirect("/contact?error=setup");
  }

  try {
    await saveSchoolInquiry({ schoolName, name, email, note });
  } catch {
    redirect("/contact?error=db");
  }

  await emailNewSchoolRequest({
    schoolName,
    name,
    email,
    note,
  }).catch(() => undefined);

  redirect("/contact?sent=1");
}
