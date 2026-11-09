"use server";

import { getSession } from "@/lib/auth";
import { loadCompanySchools } from "@/lib/company-access";
import { fetchOneStepLiveBuses, onestepGpsConfigured } from "@/lib/onestep-gps";

export async function loadLiveGpsFeed(schoolId?: string) {
  const user = await getSession();
  if (!user) {
    return { ok: false as const, error: "Sign in required." };
  }

  if (user.role === "BUS_COMPANY") {
    if (schoolId) {
      const schools = await loadCompanySchools(user);
      if (!schools.some((school) => school.id === schoolId)) {
        return { ok: false as const, error: "That school is not on your list." };
      }
    }
  } else if (
    !["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"].includes(user.role)
  ) {
    return { ok: false as const, error: "Not allowed." };
  } else if (schoolId && schoolId !== user.schoolId) {
    return { ok: false as const, error: "Not allowed for that school." };
  }

  const feed = await fetchOneStepLiveBuses();
  return {
    ok: true as const,
    configured: onestepGpsConfigured(),
    feed,
  };
}
