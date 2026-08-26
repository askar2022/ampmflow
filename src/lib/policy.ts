import { formatTime, schoolNow } from "./dates";
import type { DurationType, Role } from "./types";

export const CHANGE_DEADLINE = "14:15";
export const SNAPSHOT_TIME = "14:45";

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function schoolMinutes(date = schoolNow()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function isAfterDeadline(date = schoolNow()) {
  return schoolMinutes(date) >= minutes(CHANGE_DEADLINE);
}

export function isAfterSnapshot(date = schoolNow()) {
  return schoolMinutes(date) >= minutes(SNAPSHOT_TIME);
}

export function canRecordChange(role: Role, duration: DurationType) {
  if (role === "COORDINATOR") return true;
  if (role === "FRONT_DESK") return duration === "TODAY" || duration === "DATE_RANGE";
  return false;
}

export function canChangeAssignment(role: Role) {
  return role === "COORDINATOR" || role === "FRONT_DESK";
}

export function lateLabel(late: boolean, urgent: boolean) {
  if (urgent) return "Late/Emergency change";
  if (late) return "After 2:15 PM deadline";
  return "On time";
}

export function clockLabel(date = schoolNow()) {
  return formatTime(date);
}
