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
import { isPlatformAdminEmail } from "@/lib/platform";
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
  const intent = String(formData.get("intent") || "").trim();
  const goToSchools = next === "schools";
  const companyLogin = intent === "company";
  const fail = slug
    ? schoolLoginPath(slug)
    : goToSchools
      ? "/"
      : companyLogin
        ? "/buscompany"
        : "/login";

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

  if (companyLogin && result.user.role !== "BUS_COMPANY") {
    redirect(`${fail}?error=staff`);
  }

  if (goToSchools || isPlatformAdminEmail(result.user.email)) {
    if (!(await isPlatformAdmin(result.user))) {
      redirect(goToSchools ? "/?error=admin" : `${fail}?error=1`);
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
  const next = String(formData.get("next") || "");
  if (next === "landing") redirect("/");
  if (next === "company") redirect("/buscompany");
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const slug = String(formData.get("schoolSlug") || "").trim();
  const company = String(formData.get("company") || "") === "1";
  const back = slug
    ? `/login/forgot?school=${encodeURIComponent(slug)}`
    : company
      ? "/login/forgot?company=1"
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
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const payloadEarly = token ? await readPasswordResetToken(token) : null;
  const platform = Boolean(
    payloadEarly && isPlatformAdminEmail(payloadEarly.email),
  );
  const company = !platform && String(formData.get("company") || "") === "1";
  const slug = platform ? "" : String(formData.get("schoolSlug") || "").trim();
  const fail = slug
    ? `/login/reset?school=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`
    : company
      ? `/login/reset?token=${encodeURIComponent(token)}&company=1`
      : `/login/reset?token=${encodeURIComponent(token)}`;

  if (password.length < 8) {
    redirect(`${fail}&error=short`);
  }
  if (password !== confirm) {
    redirect(`${fail}&error=match`);
  }

  const payload = payloadEarly;
  if (!payload) {
    redirect(`${fail}&error=expired`);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, active: true, role: true },
  });
  if (!user || user.email !== payload.email || !user.active) {
    redirect(`${fail}&error=expired`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  const signIn = platform
    ? "/login"
    : user.role === "BUS_COMPANY" || company
      ? "/buscompany"
      : schoolSignInPath(slug);
  redirect(`${signIn}${signIn.includes("?") ? "&" : "?"}reset=1`);
}
