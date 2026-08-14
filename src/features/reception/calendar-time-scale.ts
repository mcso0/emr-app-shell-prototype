import type { EffectiveOperatingHours } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { getOperatingTimeClassification } from "@/features/reception/effective-operating-hours";

const MINUTES_PER_DAY = 24 * 60;
export const BUSINESS_QUARTER_HEIGHT = 36;
export const NON_BUSINESS_HOUR_HEIGHT = 72;
const BUSINESS_PX_PER_MINUTE = BUSINESS_QUARTER_HEIGHT / 15;
const NON_BUSINESS_PX_PER_MINUTE = NON_BUSINESS_HOUR_HEIGHT / 60;

export type CalendarTimeScale = {
  totalHeight: number;
  minutesToY: (minutes: number) => number;
  yToMinutes: (y: number) => number;
  rangeHeight: (startMinutes: number, endMinutes: number) => number;
  isSelectable: (startMinutes: number, durationMinutes: number) => boolean;
};

export function createCalendarTimeScale(schedule: EffectiveOperatingHours): CalendarTimeScale {
  const businessStart = schedule.isOpen ? toMinutes(schedule.treatmentStart) : null;
  const businessEnd = schedule.isOpen ? toMinutes(schedule.treatmentEnd) : null;

  const minutesToY = (minutes: number) => {
    const value = clamp(minutes, 0, MINUTES_PER_DAY);
    if (businessStart === null || businessEnd === null) {
      return value * NON_BUSINESS_PX_PER_MINUTE;
    }
    const before = Math.min(value, businessStart) * NON_BUSINESS_PX_PER_MINUTE;
    const during = Math.max(0, Math.min(value, businessEnd) - businessStart) * BUSINESS_PX_PER_MINUTE;
    const after = Math.max(0, value - businessEnd) * NON_BUSINESS_PX_PER_MINUTE;
    return before + during + after;
  };

  const totalHeight = minutesToY(MINUTES_PER_DAY);

  return {
    totalHeight,
    minutesToY,
    rangeHeight: (start, end) => minutesToY(end) - minutesToY(start),
    yToMinutes(y) {
      const target = clamp(y, 0, totalHeight);
      let low = 0;
      let high = MINUTES_PER_DAY;
      for (let index = 0; index < 16; index += 1) {
        const middle = (low + high) / 2;
        if (minutesToY(middle) < target) low = middle;
        else high = middle;
      }
      return (low + high) / 2;
    },
    isSelectable(start, duration) {
      if (businessStart === null || businessEnd === null) return false;
      return getOperatingTimeClassification(schedule, start, duration) !== "blocked";
    },
  };
}

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
