import { expect, test } from "@playwright/test";

import {
  applyScheduleRangeToOpenDays,
  createInitialHospitalBasicSettingsDraft,
  createTimeOptions,
  hasHospitalBasicSettingsChanges,
  hasOperatingHoursChanges,
  validateHospitalBasicSettingsDraft,
  resolveEffectiveOperatingHours,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { isReceptionTimeAllowed } from "@/features/reception/effective-operating-hours";

test("initial settings are clean and expose 30-minute time choices", () => {
  const initial = createInitialHospitalBasicSettingsDraft();

  expect(hasHospitalBasicSettingsChanges(initial, initial)).toBe(false);
  expect(createTimeOptions()).toEqual(
    expect.arrayContaining(["00:00", "09:00", "12:30", "23:30"])
  );
});

test("contact changes do not count as operating-hours changes", () => {
  const saved = createInitialHospitalBasicSettingsDraft();
  const draft = {
    ...saved,
    contact: { ...saved.contact, fax: "02-6203-0000" },
  };

  expect(hasHospitalBasicSettingsChanges(draft, saved)).toBe(true);
  expect(hasOperatingHoursChanges(draft, saved)).toBe(false);
});

test("schedule propagation updates operating days and preserves closed days", () => {
  const draft = createInitialHospitalBasicSettingsDraft();
  const next = applyScheduleRangeToOpenDays(draft, "monday", "treatment");

  expect(next.weeklyHours.tuesday.treatment).toEqual(draft.weeklyHours.monday.treatment);
  expect(next.weeklyHours.saturday.treatment).toEqual(draft.weeklyHours.monday.treatment);
  expect(next.weeklyHours.sunday).toEqual(draft.weeklyHours.sunday);
});

test("validation rejects inverted hours and duplicate exception dates", () => {
  const draft = createInitialHospitalBasicSettingsDraft();
  draft.weeklyHours.monday.treatment = { start: "19:00", end: "09:00" };
  draft.exceptions = [
    { id: "exception-1", date: "2026-07-14", mode: "closed" },
    { id: "exception-2", date: "2026-07-14", mode: "closed" },
  ];

  expect(validateHospitalBasicSettingsDraft(draft).map((issue) => issue.code)).toEqual([
    "treatment_range",
    "duplicate_exception_date",
  ]);
});

test("effective hours prefer a date exception and preserve workspace timezone", () => {
  const draft = createInitialHospitalBasicSettingsDraft();
  draft.timezone = "Asia/Seoul";
  draft.exceptions = [{
    id: "exception-1",
    date: "2026-07-15",
    mode: "custom",
    treatment: { start: "10:00", end: "16:00" },
    break: { start: "12:00", end: "13:00" },
  }];

  expect(resolveEffectiveOperatingHours(draft, "2026-07-15")).toEqual({
    date: "2026-07-15",
    timezone: "Asia/Seoul",
    isOpen: true,
    source: "exception",
    treatmentStart: "10:00",
    treatmentEnd: "16:00",
    breakStart: "12:00",
    breakEnd: "13:00",
  });
});

test("reception validation follows configured hours and blocks the configured break", () => {
  const settings = createInitialHospitalBasicSettingsDraft();
  settings.weeklyHours.friday = {
    isOpen: true,
    treatment: { start: "08:00", end: "20:00" },
    break: { start: "12:00", end: "13:00" },
  };
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T08:00:00+09:00", durationMinutes: 30 }).allowed).toBe(true);
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T12:15:00+09:00", durationMinutes: 30 }).allowed).toBe(false);
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T19:30:00+09:00", durationMinutes: 30 }).allowed).toBe(true);
});
