"use server";

import { revalidatePath } from "next/cache";
import { getSession, isSchoolOperator } from "@/lib/auth";
import {
  addOpsEmail,
  removeOpsEmail,
  sendOpsChangeDigest,
} from "@/lib/ops-change-emails";

function refresh() {
  revalidatePath("/changes");
}

export async function addChangeListEmail(formData: FormData) {
  const user = await getSession();
  if (!user || !isSchoolOperator(user.role)) {
    return { ok: false, error: "Only a bus coordinator or admin can add emails." };
  }
  const result = await addOpsEmail(user.schoolId, String(formData.get("email") || ""));
  refresh();
  return result;
}

export async function removeChangeListEmail(email: string) {
  const user = await getSession();
  if (!user || !isSchoolOperator(user.role)) {
    return { ok: false, error: "Only a bus coordinator or admin can remove emails." };
  }
  const result = await removeOpsEmail(user.schoolId, email);
  refresh();
  return result;
}

export async function emailOpsChangeListNow() {
  const user = await getSession();
  if (!user || !isSchoolOperator(user.role)) {
    return { ok: false, error: "Only a bus coordinator or admin can send this list." };
  }
  const result = await sendOpsChangeDigest({
    schoolId: user.schoolId,
    actorId: user.id,
    automatic: false,
  });
  refresh();
  return result;
}
