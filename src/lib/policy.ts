import { formatTime, isFriday, schoolNow } from "./dates";
import type { DurationType, Role } from "./types";

export const CHANGE_DEADLINE = "14:15";
export const SNAPSHOT_TIME = "14:45";
export const FRIDAY_CHANGE_DEADLINE = "11:15";
export const FRIDAY_SNAPSHOT_TIME = "11:45";
export const FRIDAY_CLOSE_TIME = "12:00";

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function schoolMinutes(date = schoolNow()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function changeDeadlineForToday() {
  return isFriday() ? FRIDAY_CHANGE_DEADLINE : CHANGE_DEADLINE;
}

export function snapshotTimeForToday() {
  return isFriday() ? FRIDAY_SNAPSHOT_TIME : SNAPSHOT_TIME;
}

export function deadlineClockLabel() {
  return isFriday() ? "11:15 AM" : "2:15 PM";
}

export function snapshotClockLabel() {
  return isFriday() ? "11:45 AM" : "2:45 PM";
}

export function isAfterDeadline(date = schoolNow()) {
  return schoolMinutes(date) >= minutes(changeDeadlineForToday());
}

export function isAfterSnapshot(date = schoolNow()) {
  return schoolMinutes(date) >= minutes(snapshotTimeForToday());
}

export function canRecordChange(role: Role, duration: DurationType) {
  if (role === "COORDINATOR" || role === "ADMINISTRATOR") return true;
  if (role === "FRONT_DESK") return duration === "TODAY" || duration === "DATE_RANGE";
  return false;
}

export function canChangeAssignment(role: Role) {
  return (
    role === "COORDINATOR" ||
    role === "ADMINISTRATOR" ||
    role === "FRONT_DESK"
  );
}

export function lateLabel(late: boolean, urgent: boolean) {
  if (urgent) return "Late/Emergency change";
  if (late) return `After ${deadlineClockLabel()} deadline`;
  return "On time";
}

export function clockLabel(date = schoolNow()) {
  return formatTime(date);
}
