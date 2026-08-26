import type { Destination, DurationType, PlanSnapshot, TransportType, Trip } from "./types";

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
      return "Transportation Coordinator";
    case "ADMINISTRATOR":
      return "School Administrator";
    case "TEACHER":
      return "Teacher";
    case "FRONT_DESK":
      return "Receptionist";
    case "BUS_COMPANY":
      return "Bus Company";
    case "BUS_ASSISTANT":
      return "Bus Assistant";
    default:
      return role;
  }
}

export function formatAddress(parts: {
  line1: string;
  city: string;
  state: string;
  zip: string;
}) {
  return `${parts.line1}, ${parts.city}, ${parts.state} ${parts.zip}`;
}

export function planSummary(plan: PlanSnapshot, trip: Trip = plan.trip) {
  if (plan.source === "MISSING" || !plan.type) {
    return "Missing assignment";
  }
  if (plan.type === "PARENT") {
    return typeLabel("PARENT", trip);
  }
  const dest =
    plan.destination === "DAYCARE" && plan.daycareName
      ? ` to ${plan.daycareName}`
      : plan.destination === "HOME"
        ? " from/to home".replace("from/to", trip === "AM" ? "from" : "to")
        : plan.customAddress
          ? ` — ${plan.customAddress}`
          : "";
  if (plan.waitingForAssignment || !plan.busNumber) {
    return `Bus pending${dest}`;
  }
  return `Bus ${plan.busNumber}${dest}`;
}

export function locationFor(plan: PlanSnapshot) {
  if (plan.type === "PARENT") return "Parent pickup area";
  if (plan.type === "BUS") return plan.location || "Bus loading area";
  return "See coordinator";
}

export type StatusTone = "yellow" | "green" | "red" | "blue" | "gray" | "orange";

export function planTone(plan: PlanSnapshot): StatusTone {
  if (plan.source === "MISSING" || !plan.type) return "red";
  if (plan.waitingForAssignment || (plan.type === "BUS" && !plan.busNumber)) {
    return "red";
  }
  if (plan.type === "PARENT") return "blue";
  if (plan.source === "TODAY" || plan.source === "DATE_RANGE") return "yellow";
  return "green";
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
