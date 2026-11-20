import type {
  Destination,
  DurationType,
  EffectiveStudent,
  PlanSnapshot,
  TransportType,
  Trip,
} from "./types";

export function fullName(first: string, last: string) {
  return `${first} ${last}`;
}

export function tripLabel(trip: Trip) {
  return trip === "AM" ? "AM arrival" : "PM dismissal";
}

export function typeLabel(type: TransportType | null, trip: Trip = "PM") {
  if (!type) return "Unassigned";
  if (type === "PARENT") {
    return trip === "AM" ? "Parent drop-off" : "Parent pickup";
  }
  return "Bus";
}

export function destinationLabel(destination: Destination | null) {
  if (destination === "HOME") return "Home";
  if (destination === "DAYCARE") return "Daycare";
  if (destination === "CUSTOM") return "Custom address";
  return "—";
}

export function durationLabel(duration: DurationType) {
  if (duration === "TODAY") return "Today only";
  if (duration === "DATE_RANGE") return "Date range";
  return "Permanent";
}

export function roleLabel(role: string) {
  switch (role) {
    case "COORDINATOR":
      return "Bus Coordinator";
    case "ADMINISTRATOR":
      return "Admin";
    case "TEACHER":
      return "Teacher";
    case "FRONT_DESK":
      return "Reception";
    case "BUS_COMPANY":
      return "Bus Company";
    case "BUS_ASSISTANT":
      return "Bus Assistant";
    case "PENDING":
      return "Waiting for approval";
    default:
      return role;
  }
}

/** True when a "teacher" value is really a grade (e.g. "2", "Grade 2", "K"). */
export function looksLikeGradeLabel(value: string) {
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return false;
  if (/^\d{1,2}$/.test(v)) return true;
  if (/^(k|kg|kinder(garten)?|prek|pre-k|pk)$/.test(v)) return true;
  if (/^grade\s*\d{1,2}$/.test(v)) return true;
  if (/^\d{1,2}(st|nd|rd|th)$/.test(v)) return true;
  return false;
}

/** Show a real teacher name; hide grade leftovers from bad imports. */
export function displayTeacherName(name?: string | null) {
  const value = String(name || "").trim();
  if (!value || /^unassigned$/i.test(value) || looksLikeGradeLabel(value)) {
    return "Unassigned";
  }
  return value;
}

export function formatAddress(
  parts?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null,
) {
  if (!parts) return "—";
  const line1 = String(parts.line1 || "").trim();
  const city = String(parts.city || "").trim();
  const state = String(parts.state || "").trim();
  const zip = String(parts.zip || "").trim();
  if (!line1 && !city && !state && !zip) return "—";
  if (!city && !state && !zip) return line1 || "—";
  return `${line1 || "—"}, ${city || "—"}, ${state || "—"} ${zip}`.trim();
}

function vanFromPlan(plan: PlanSnapshot) {
  return plan.notes?.match(/Van\s+[A-Za-z0-9-]+/i)?.[0] || "";
}

export function isPlanWaiting(plan: PlanSnapshot) {
  if (plan.type === "PARENT") return false;
  if (plan.waitingForAssignment) return true;
  if (plan.type === "BUS" && !plan.busNumber && !vanFromPlan(plan)) return true;
  return false;
}

export function isWaitingRide(student: EffectiveStudent) {
  return isPlanWaiting(student.am) || isPlanWaiting(student.pm);
}

export function changeRequestLabel(student: EffectiveStudent) {
  for (const plan of [student.pm, student.am]) {
    if (plan.destination === "DAYCARE") {
      return plan.daycareName ? `Daycare · ${plan.daycareName}` : "Daycare";
    }
    if (plan.destination === "CUSTOM") {
      return plan.customAddress
        ? `New address · ${plan.customAddress}`
        : "New address";
    }
  }
  if (
    student.enrollmentSource === "ROUTE_REQUEST" ||
    student.enrollmentSource === "NEW_APPLICATION"
  ) {
    return student.homeAddress && student.homeAddress !== "—"
      ? `New route · ${student.homeAddress}`
      : "New route";
  }
  if (isWaitingRide(student)) return "New request";
  return "Bus or van";
}

export function companyAssignmentLabel(student: EffectiveStudent) {
  const parts: string[] = [];
  for (const plan of [student.am, student.pm]) {
    if (isPlanWaiting(plan)) continue;
    // Prefer a real bus route over leftover "Van …" text in notes.
    const ride = plan.busNumber
      ? `Bus ${plan.busNumber}`
      : vanFromPlan(plan).replace(/^van/i, "Van");
    if (!ride) continue;
    const time = plan.pickupTime?.trim();
    parts.push(time ? `${plan.trip} ${ride} · ${time}` : `${plan.trip} ${ride}`);
  }
  return parts.length ? parts.join(" · ") : "Waiting for company";
}

export function isRouteRequestStudent(student: EffectiveStudent) {
  if (
    student.enrollmentSource === "ROUTE_REQUEST" ||
    student.enrollmentSource === "NEW_APPLICATION"
  ) {
    return true;
  }
  if (!isWaitingRide(student)) return false;
  const destination = student.pm.destination || student.am.destination;
  return destination === "HOME" || !destination;
}

export function planSummary(plan: PlanSnapshot, trip: Trip = plan.trip) {
  if (plan.source === "MISSING" || !plan.type) {
    return "Missing assignment";
  }
  if (plan.type === "PARENT") {
    return typeLabel("PARENT", trip);
  }
  const dest =
    plan.destination === "DAYCARE"
      ? plan.daycareName
        ? ` to daycare ${plan.daycareName}`
        : " to daycare"
      : plan.destination === "HOME"
        ? " from/to home".replace("from/to", trip === "AM" ? "from" : "to")
        : plan.customAddress
          ? ` — ${plan.customAddress}`
          : "";
  if (isPlanWaiting(plan)) {
    return `Bus pending${dest}`;
  }
  if (plan.busNumber) return `Bus ${plan.busNumber}${dest}`;
  const van = vanFromPlan(plan);
  if (van) return `${van.replace(/^van/i, "Van")}${dest}`;
  return `Bus pending${dest}`;
}

export function locationFor(plan: PlanSnapshot) {
  if (plan.type === "PARENT") return "Parent pickup area";
  if (plan.type === "BUS") return plan.location || "Bus loading area";
  return "See coordinator";
}

export type StatusTone = "yellow" | "green" | "red" | "blue" | "gray" | "orange";

export function planTone(plan: PlanSnapshot): StatusTone {
  if (plan.source === "MISSING" || !plan.type) return "red";
  if (isPlanWaiting(plan)) {
    return "red";
  }
  if (plan.type === "PARENT") return "blue";
  if (plan.source === "TODAY" || plan.source === "DATE_RANGE") return "yellow";
  return "green";
}

export function rosterChangeLabel(
  student: EffectiveStudent,
  companyBus?: string | null,
): string | null {
  const plan = student.pm;
  if (plan.type !== "BUS" || !plan.busNumber) return null;
  if (companyBus && companyBus === plan.busNumber) {
    return "Bus company approved — ride this bus. Show this list if the driver did not print a new roster.";
  }
  if (plan.source === "TODAY" || plan.source === "DATE_RANGE") {
    return "Today-only change on the school list. Show this to the driver.";
  }
  return null;
}

export function toneLabel(tone: StatusTone) {
  switch (tone) {
    case "yellow":
      return "Temporary change";
    case "green":
      return "Permanent assignment";
    case "red":
      return "Missing bus assignment";
    case "blue":
      return "Parent pickup";
    case "orange":
      return "Last-minute change";
    default:
      return "Unknown";
  }
}
