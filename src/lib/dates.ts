import { format, parseISO } from "date-fns";

export const SCHOOL_TIMEZONE =
  process.env.SCHOOL_TIMEZONE || "America/Chicago";

export function schoolNow(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`,
  );
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
