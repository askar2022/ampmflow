"use server";

import { redirect } from "next/navigation";
import {
  authenticate,
  clearSession,
  createSession,
  hashPassword,
  homePath,
  isPlatformAdmin,
} from "@/lib/auth";
import {
  readPasswordResetToken,
  schoolSignInPath,
  sendPasswordResetEmail,
} from "@/lib/password-reset";
import { isDatabaseConfigured } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { findSchoolBySlug, schoolLoginPath } from "@/lib/school-slug";

export async function loginAction(formData: FormData) {
  const slug = String(formData.get("schoolSlug") || "").trim();
  const next = String(formData.get("next") || "").trim();
  const goToSchools = next === "schools";
  const fail = slug ? schoolLoginPath(slug) : goToSchools ? "/" : "/login";

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

  if (goToSchools) {
    if (!(await isPlatformAdmin(result.user))) {
      redirect("/?error=admin");
    }
    await createSession(result.user, {
      remember: formData.get("remember") === "1",
    });
    redirect("/platform");
  }

  await createSession(result.user, {
    remember: formData.get("remember") === "1",
  });
  redirect(homePath(result.user.role));
}

export async function logoutAction(formData: FormData) {
  await clearSession();
  redirect(String(formData.get("next") || "") === "landing" ? "/" : "/login");
}

export async function requestPasswordReset(formData: FormData) {
  const slug = String(formData.get("schoolSlug") || "").trim();
  const back = slug
    ? `/login/forgot?school=${encodeURIComponent(slug)}`
    : "/login/forgot";
  const result = await sendPasswordResetEmail(
    String(formData.get("email") || ""),
    slug,
  );
  if (!result.ok) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${back}${back.includes("?") ? "&" : "?"}sent=1`);
}

export async function completePasswordReset(formData: FormData) {
  const slug = String(formData.get("schoolSlug") || "").trim();
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const fail = slug
    ? `/login/reset?school=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`
    : `/login/reset?token=${encodeURIComponent(token)}`;

  if (password.length < 8) {
    redirect(`${fail}&error=short`);
  }
  if (password !== confirm) {
    redirect(`${fail}&error=match`);
  }

  const payload = await readPasswordResetToken(token);
  if (!payload) {
    redirect(`${fail}&error=expired`);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, active: true },
  });
  if (!user || user.email !== payload.email || !user.active) {
    redirect(`${fail}&error=expired`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  const signIn = schoolSignInPath(slug);
  redirect(`${signIn}${signIn.includes("?") ? "&" : "?"}reset=1`);
}
