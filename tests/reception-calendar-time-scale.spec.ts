import { expect, test } from "@playwright/test";
import { createCalendarTimeScale } from "@/features/reception/calendar-time-scale";

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
