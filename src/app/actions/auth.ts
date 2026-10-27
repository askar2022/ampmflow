"use server";

import { redirect } from "next/navigation";
import { authenticate, clearSession, createSession, homePath } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/prisma";
import { findSchoolBySlug, schoolLoginPath } from "@/lib/school-slug";

export async function loginAction(formData: FormData) {
  const slug = String(formData.get("schoolSlug") || "").trim();
  const fail = slug ? schoolLoginPath(slug) : "/login";

  if (!isDatabaseConfigured()) {
    redirect(`${fail}?error=db`);
  }

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  let result;
  try {
    result = await authenticate(email, password);
  } catch {
    redirect(`${fail}?error=db`);
  }

  if (result.status === "pending") {
    redirect(`${fail}?error=pending`);
  }
  if (result.status !== "ok") {
    redirect(`${fail}?error=1`);
  }

  if (slug) {
    const school = await findSchoolBySlug(slug);
    if (!school || result.user.schoolId !== school.id) {
      redirect(`${fail}?error=1`);
    }
  }

  await createSession(result.user, {
    remember: formData.get("remember") === "1",
  });
  redirect(homePath(result.user.role));
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
