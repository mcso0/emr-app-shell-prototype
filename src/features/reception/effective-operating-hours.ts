import {
  resolveEffectiveOperatingHours,
  type HospitalBasicSettingsDraft,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";

export function isReceptionTimeAllowed({ durationMinutes, scheduledStartAt, settings }: {
  durationMinutes: number;
  scheduledStartAt: string;
  settings: Pick<HospitalBasicSettingsDraft, "timezone" | "weeklyHours" | "exceptions">;
}) {
  const start = new Date(scheduledStartAt);
  if (!Number.isFinite(start.getTime())) return { allowed: false, closed: false };
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const date = formatDate(start, settings.timezone);
  const schedule = resolveEffectiveOperatingHours(settings, date);
  if (!schedule.isOpen || !schedule.treatmentStart || !schedule.treatmentEnd) return { allowed: false, closed: true };
  if (formatDate(end, settings.timezone) !== date) return { allowed: false, closed: false };
  const startMinutes = formatMinutes(start, settings.timezone);
  const endMinutes = formatMinutes(end, settings.timezone);
  const breakStart = schedule.breakStart ? toMinutes(schedule.breakStart) : null;
  const breakEnd = schedule.breakEnd ? toMinutes(schedule.breakEnd) : null;
  return {
    allowed: startMinutes >= toMinutes(schedule.treatmentStart)
      && endMinutes <= toMinutes(schedule.treatmentEnd)
      && !(breakStart !== null && breakEnd !== null && startMinutes < breakEnd && endMinutes > breakStart),
    closed: false,
  };
}

function formatDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(value.hour) * 60 + Number(value.minute);
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
