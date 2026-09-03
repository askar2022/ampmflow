import type { PlanSnapshot } from "./types";

export type PlanChoice =
  | { kind: "unset" }
  | { kind: "parent" }
  | { kind: "bus-home"; bus: string }
  | { kind: "bus-daycare"; bus: string };

export function encodePlanChoice(choice: PlanChoice) {
  if (choice.kind === "unset") return "";
  if (choice.kind === "parent") return "parent-home";
  if (choice.kind === "bus-home") return `bus-home:${choice.bus}`;
  return `bus-daycare:${choice.bus}`;
}

export function decodePlanChoice(value: string): PlanChoice {
  const raw = value.trim();
  if (!raw) return { kind: "unset" };
  if (raw === "parent-home") return { kind: "parent" };
  if (raw.startsWith("bus-home:")) {
    return { kind: "bus-home", bus: raw.slice("bus-home:".length) };
  }
  if (raw.startsWith("bus-daycare:")) {
    return { kind: "bus-daycare", bus: raw.slice("bus-daycare:".length) };
  }
  return { kind: "unset" };
}

export function choiceFromSnapshot(plan: PlanSnapshot) {
  if (!plan.type) return "";
  if (plan.type === "PARENT") return "parent-home";
  const bus = plan.busNumber || "";
  if (plan.destination === "DAYCARE") return encodePlanChoice({ kind: "bus-daycare", bus });
  return encodePlanChoice({ kind: "bus-home", bus });
}

export function planChoiceLabel(value: string, trip: "AM" | "PM") {
  const choice = decodePlanChoice(value);
  if (choice.kind === "unset") return "Not set";
  if (choice.kind === "parent") {
    return trip === "AM" ? "Parent drop-off from home" : "Parent pickup at home";
  }
  if (choice.kind === "bus-home") {
    return trip === "AM"
      ? `Bus ${choice.bus} from home`
      : `Bus ${choice.bus} home`;
  }
  return trip === "AM"
    ? `Bus ${choice.bus} from daycare`
    : `Bus ${choice.bus} to daycare`;
}
