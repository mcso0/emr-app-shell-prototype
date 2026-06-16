import { isLegacySalesDemoWorkspace } from "@/lib/emr-domain/demo-workspaces";

export const LEGACY_FIXTURE_OPERATING_DATE = "2026-05-01";
export const LEGACY_FIXTURE_OPERATING_NOW = "2026-05-01T10:45:00+09:00";
export const DEMO_OPERATING_TIME_ZONE = "Asia/Seoul";

const koreanWeekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

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

function parseIsoDateTime(dateTime?: string) {
  if (!dateTime) return null;

  const date = new Date(dateTime);
  return Number.isNaN(date.getTime()) ? null : date;
}
