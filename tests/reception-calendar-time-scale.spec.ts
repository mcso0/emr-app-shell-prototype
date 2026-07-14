import { expect, test } from "@playwright/test";
import { createCalendarTimeScale } from "@/features/reception/calendar-time-scale";
import {
  getOperatingScheduleLabel,
  getSelectableOperatingStartMinutes,
} from "@/features/reception/effective-operating-hours";

test("calendar scale uses 36px business quarters and compresses each off-hour to 72px", () => {
  const scale = createCalendarTimeScale({
    date: "2026-07-15",
    timezone: "Asia/Seoul",
    isOpen: true,
    source: "weekly",
    treatmentStart: "09:00",
    treatmentEnd: "19:00",
    breakStart: "13:00",
    breakEnd: "14:00",
  });

  expect(scale.rangeHeight(9 * 60, 9 * 60 + 15)).toBe(36);
  expect(scale.rangeHeight(0, 60)).toBe(72);
  expect(scale.rangeHeight(18 * 60 + 45, 19 * 60 + 15)).toBe(54);
  expect(scale.totalHeight).toBe(1728 + 720);
});
test("closed dates compress the full day and keep selections disabled", () => {
  const scale = createCalendarTimeScale({
    date: "2026-07-19",
    timezone: "Asia/Seoul",
    isOpen: false,
    source: "weekly",
    treatmentStart: null,
    treatmentEnd: null,
    breakStart: null,
    breakEnd: null,
  });
  expect(scale.totalHeight).toBe(24 * 72);
  expect(scale.isSelectable(10 * 60, 30)).toBe(false);
});
test("operating schedule helpers honor custom hours and breaks", () => {
  const schedule = {
    date: "2026-07-15",
    timezone: "Asia/Seoul",
    isOpen: true,
    source: "weekly" as const,
    treatmentStart: "08:00",
    treatmentEnd: "20:00",
    breakStart: "12:00",
    breakEnd: "13:00",
  };

  const starts = getSelectableOperatingStartMinutes(schedule, 30);

  expect(getOperatingScheduleLabel(schedule)).toBe("08:00-20:00");
  expect(starts).toContain(8 * 60);
  expect(starts).toContain(19 * 60 + 30);
  expect(starts).not.toContain(12 * 60);
  expect(starts).not.toContain(12 * 60 + 30);
});
test("closed schedules have no selectable start time", () => {
  const schedule = {
    date: "2026-07-19",
    timezone: "Asia/Seoul",
    isOpen: false,
    source: "weekly" as const,
    treatmentStart: null,
    treatmentEnd: null,
    breakStart: null,
    breakEnd: null,
  };

  expect(getOperatingScheduleLabel(schedule)).toBe("휴무");
  expect(getSelectableOperatingStartMinutes(schedule, 30)).toEqual([]);
});
