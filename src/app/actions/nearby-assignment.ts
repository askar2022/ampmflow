"use server";

import { getSession } from "@/lib/auth";
import { canCompanyAccessSchool } from "@/lib/company-access";
import { findNearbyAssignment } from "@/lib/nearby-assignment";
import { loadStudent } from "@/lib/transportation";
import type { Trip } from "@/lib/types";

export async function nearbyAssignmentSuggestion(input: {
  studentId: string;
  trips?: Trip[];
}) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Please sign in." };
  if (user.role !== "BUS_COMPANY") {
    return { ok: false as const, error: "Only the bus company can use this reference." };
  }

  const loaded = await loadStudent(input.studentId);
  if (!loaded) return { ok: false as const, error: "Student not found." };
  const schoolId = loaded.record.schoolId;
  if (!(await canCompanyAccessSchool(user, schoolId))) {
    return { ok: false as const, error: "That school is not on your list." };
  }

  const requested = (input.trips || []).filter(
    (trip): trip is Trip => trip === "AM" || trip === "PM",
  );
  const trips: Trip[] = requested.length ? requested : ["AM", "PM"];
  const suggestion = await findNearbyAssignment({
    schoolId,
    studentId: input.studentId,
    trips,
  }).catch(() => null);

  if (!suggestion) {
    return { ok: true as const, found: false as const };
  }

  return {
    ok: true as const,
    found: true as const,
    address: suggestion.address,
    trip: suggestion.trip,
    ride: suggestion.ride,
    vehicle: suggestion.vehicle,
    fill: suggestion.fill,
    miles: suggestion.miles,
  };
}
