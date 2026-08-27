import { format, parseISO } from "date-fns";

export const SCHOOL_TIMEZONE =
  process.env.SCHOOL_TIMEZONE || "America/Chicago";

function schoolClockParts(date = new Date()) {
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
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return { get, hour };
}

export function schoolNow(): Date {
  return new Date();
}

export function schoolLocalTime(date = new Date()) {
  const { get, hour } = schoolClockParts(date);
  return {
    weekday: get("weekday"),
    hhmm: `${hour}:${get("minute")}`,
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
  return schoolLocalTime(date).dateKey;
}

export function fromSchoolDateTime(
  dateKey: string,
  hhmm: string,
  second = "00",
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const sec = Number(second);
  let utc = Date.UTC(year, month - 1, day, hour, minute, sec);
  for (let i = 0; i < 4; i += 1) {
    const shown = schoolLocalTime(new Date(utc));
    const [shownHour, shownMinute] = shown.hhmm.split(":").map(Number);
    const shownParts = schoolClockParts(new Date(utc));
    const shownUtc = Date.UTC(
      Number(shown.dateKey.slice(0, 4)),
      Number(shown.dateKey.slice(5, 7)) - 1,
      Number(shown.dateKey.slice(8, 10)),
      shownHour,
      shownMinute,
      Number(shownParts.get("second")),
    );
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, sec);
    const delta = targetUtc - shownUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export function schoolDayBounds(startKey: string, endKey = startKey) {
  return {
    start: fromSchoolDateTime(startKey, "00:00", "00"),
    end: fromSchoolDateTime(endKey, "23:59", "59"),
  };
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d)} · ${formatTime(d)}`;
}

export function formatShortDate(key: string): string {
  return format(parseISO(key), "MMM d, yyyy");
}

export function listVersion(date = new Date()): string {
  const clock = schoolLocalTime(date);
  return `v-${clock.dateKey}-${clock.hhmm.replace(":", "")}`;
}

export function generatedStamp(date = new Date()): string {
  return `${formatLongDate(date)} — Generated at ${formatTime(date)}`;
}

export function dateInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}
