import { format, parseISO } from "date-fns";

export const SCHOOL_TIMEZONE =
  process.env.SCHOOL_TIMEZONE || "America/Chicago";

function schoolClockParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return { get };
}

export function schoolNow(): Date {
  const { get } = schoolClockParts();
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`,
  );
}

export function schoolLocalTime() {
  const { get } = schoolClockParts();
  return {
    weekday: get("weekday"),
    hhmm: `${get("hour")}:${get("minute")}`,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export function addMinutesToClock(hhmm: string, minutes: number) {
  const [hours, mins] = hhmm.split(":").map(Number);
  const total = ((hours * 60 + mins + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function isSchoolWeekday(weekday = schoolLocalTime().weekday) {
  return !["Sat", "Sun", "Saturday", "Sunday"].includes(weekday);
}

export function isFriday(weekday = schoolLocalTime().weekday) {
  return weekday === "Fri" || weekday === "Friday";
}

export function clockInWindow(hhmm: string, start: string, minutes: number) {
  const end = addMinutesToClock(start, minutes);
  if (start <= end) return hhmm >= start && hhmm < end;
  return hhmm >= start || hhmm < end;
}

export function todayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatLongDate(date = schoolNow()): string {
  return format(date, "EEEE, MMMM d");
}

export function formatTime(date = schoolNow()): string {
  return format(date, "h:mm a");
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy · h:mm a");
}

export function formatShortDate(key: string): string {
  return format(parseISO(key), "MMM d, yyyy");
}

export function listVersion(date = schoolNow()): string {
  return `v-${format(date, "yyyy-MM-dd-HHmm")}`;
}

export function generatedStamp(date = schoolNow()): string {
  return `${formatLongDate(date)} — Generated at ${formatTime(date)}`;
}

export function dateInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}
