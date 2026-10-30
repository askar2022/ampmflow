"use server";

import { getSession } from "@/lib/auth";
import { sendFridayLeadershipReport } from "@/lib/friday-leadership-email";
import { usableOpsEmail } from "@/lib/ops-change-emails";

export async function sendFridaySnapshotTest() {
  const user = await getSession();
  if (!user) {
    return { ok: false as const, error: "Sign in first.", to: "" };
  }
  if (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR") {
    return {
      ok: false as const,
      error: "Only admin or a coordinator can send this test.",
      to: "",
    };
  }
  const to = usableOpsEmail(user.email);
  if (!to) {
    return {
      ok: false as const,
      error: "Your sign-in email cannot receive this test.",
      to: "",
    };
  }
  const result = await sendFridayLeadershipReport({
    schoolId: user.schoolId,
    actorId: user.id,
    testTo: to,
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error, to };
  }
  return { ok: true as const, to };
}
