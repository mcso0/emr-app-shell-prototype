import { isLegacySalesDemoWorkspace } from "@/lib/emr-domain/demo-workspaces";

export const LEGACY_FIXTURE_OPERATING_DATE = "2026-05-01";
export const LEGACY_FIXTURE_OPERATING_NOW = "2026-05-01T10:45:00+09:00";
export const DEMO_OPERATING_TIME_ZONE = "Asia/Seoul";

const koreanWeekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function getDatePartsInTimeZone(
  date: Date,
  timeZone = DEMO_OPERATING_TIME_ZONE
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

export function getCurrentOperatingDate(now = new Date()) {
  const parts = getDatePartsInTimeZone(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getCurrentOperatingNow(now = new Date()) {
  const parts = getDatePartsInTimeZone(now);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

export function getWorkspaceOperatingDate(
  workspaceId?: string | null,
  now = new Date()
) {
  if (isLegacySalesDemoWorkspace(workspaceId)) return LEGACY_FIXTURE_OPERATING_DATE;
  return getCurrentOperatingDate(now);
}

export function getWorkspaceOperatingNow(
  workspaceId?: string | null,
  now = new Date()
) {
  if (isLegacySalesDemoWorkspace(workspaceId)) return LEGACY_FIXTURE_OPERATING_NOW;
  return getCurrentOperatingNow(now);
}

export function formatShortOperatingDate(date: string) {
  const [year = "0000", month = "00", day = "00"] = date.split("-");
  return `${year.slice(2)}.${month}.${day}`;
}

export function formatKoreanOperatingDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  const weekday = Number.isNaN(parsed.getTime())
    ? ""
    : ` (${koreanWeekdayLabels[parsed.getDay()]})`;

  return `${formatShortOperatingDate(date)}${weekday}`;
}

export function formatOperatingMonthLabel(date: string) {
  const [year = "0000", month = "00"] = date.split("-");
  return `${year.slice(2)}.${month}`;
}

export function getOperatingIsoAtMinutes(date: string, minutes: number) {
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${date}T${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
}

export function getOperatingDateFromIso(dateTime?: string) {
  const date = parseIsoDateTime(dateTime);
  if (!date) return undefined;

  const parts = getDatePartsInTimeZone(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getOperatingMinutesFromIso(dateTime?: string) {
  const date = parseIsoDateTime(dateTime);
  if (!date) return undefined;

  const parts = getDatePartsInTimeZone(date);
  const hours = Number(parts.hour);
  const minutes = Number(parts.minute);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;

  return hours * 60 + minutes;
}

export function formatOperatingShortTime(dateTime?: string) {
  const date = parseIsoDateTime(dateTime);
  if (!date) return "-";

  const parts = getDatePartsInTimeZone(date);
  return `${parts.hour}:${parts.minute}`;
}

export function isIsoOperatingDate(date?: string | null) {
  if (!date || !isoDatePattern.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return false;

  return getOperatingDateFromIso(parsed.toISOString()) === date;
}

export function parseIsoDateParts(date: string) {
  const match = isoDatePattern.exec(date);
  if (!match) return { year: 2026, month: 5, day: 1 };

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getIsoDateFromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDaysToIsoDate(date: string, days: number) {
  const parts = parseIsoDateParts(date);
  const utcDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  return getIsoDateFromUtcDate(utcDate);
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsToIsoDate(date: string, months: number) {
  const parts = parseIsoDateParts(date);
  const nextMonthIndex = parts.month - 1 + months;
  const year = parts.year + Math.floor(nextMonthIndex / 12);
  const monthIndex = ((nextMonthIndex % 12) + 12) % 12;
  const day = Math.min(parts.day, getDaysInMonth(year, monthIndex + 1));

  return getIsoDateFromUtcDate(new Date(Date.UTC(year, monthIndex, day)));
}

export function setMonthOnIsoDate(date: string, month: number) {
  const parts = parseIsoDateParts(date);
  const day = Math.min(parts.day, getDaysInMonth(parts.year, month));

  return getIsoDateFromUtcDate(new Date(Date.UTC(parts.year, month - 1, day)));
}

function parseIsoDateTime(dateTime?: string) {
  if (!dateTime) return null;

  const date = new Date(dateTime);
  return Number.isNaN(date.getTime()) ? null : date;
}
