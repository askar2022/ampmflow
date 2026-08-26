"use server";

import { redirect } from "next/navigation";
import { authenticate, clearSession, createSession, homePath } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/prisma";

export async function loginAction(formData: FormData) {
  if (!isDatabaseConfigured()) {
    redirect("/login?error=db");
  }

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  let result;
  try {
    result = await authenticate(email, password);
  } catch {
    redirect("/login?error=db");
  }

  if (result.status === "pending") {
    redirect("/login?error=pending");
  }
  if (result.status !== "ok") {
    redirect("/login?error=1");
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
