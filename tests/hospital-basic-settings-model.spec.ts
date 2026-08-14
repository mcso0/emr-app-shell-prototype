import { expect, test } from "@playwright/test";

import {
  createInitialHospitalBasicSettingsDraft,
  createTimeOptions,
  hasHospitalBasicSettingsChanges,
  hasContactSettingsChanges,
  hasOperatingHoursChanges,
  setOpenWeekdays,
  validateContactSettingsDraft,
  validateOperatingHoursDraft,
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

test("operating day selection is the single source of open flags and preserves retained times", () => {
  const draft = createInitialHospitalBasicSettingsDraft();
  const retainedSunday = structuredClone(draft.weeklyHours.sunday);
  const next = setOpenWeekdays(draft, ["monday", "wednesday", "sunday"]);

  expect(next.weeklyHours.monday.isOpen).toBe(true);
  expect(next.weeklyHours.tuesday.isOpen).toBe(false);
  expect(next.weeklyHours.wednesday.isOpen).toBe(true);
  expect(next.weeklyHours.sunday).toEqual({ ...retainedSunday, isOpen: true });
  expect(draft.weeklyHours.sunday).toEqual(retainedSunday);
});

test("split settings validation and dirty checks stay inside their own screen", () => {
  const saved = createInitialHospitalBasicSettingsDraft();
  const contactDraft = structuredClone(saved);
  contactDraft.contact.phone = "";
  contactDraft.contact.customerGuideMemo = "가".repeat(301);
  contactDraft.weeklyHours.monday.treatment = { start: "19:00", end: "09:00" };

  expect(hasContactSettingsChanges(contactDraft, saved)).toBe(true);
  expect(hasOperatingHoursChanges(contactDraft, saved)).toBe(true);
  expect(validateContactSettingsDraft(contactDraft).map((issue) => issue.code)).toEqual([
    "required_phone",
    "customer_guide_memo_too_long",
  ]);
  expect(validateOperatingHoursDraft(contactDraft).map((issue) => issue.code)).toEqual([
    "treatment_range",
  ]);
});

test("operating validation skips retained time values for closed days", () => {
  const draft = createInitialHospitalBasicSettingsDraft();
  draft.weeklyHours.sunday.treatment = { start: "19:00", end: "09:00" };

  expect(validateOperatingHoursDraft(draft)).toEqual([]);
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

test("reception validation follows configured hours and warns on the configured break", () => {
  const settings = createInitialHospitalBasicSettingsDraft();
  settings.weeklyHours.friday = {
    isOpen: true,
    treatment: { start: "08:00", end: "20:00" },
    break: { start: "12:00", end: "13:00" },
  };
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T08:00:00+09:00", durationMinutes: 30 }).allowed).toBe(true);
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T12:15:00+09:00", durationMinutes: 30 })).toMatchObject({
    allowed: true,
    classification: "break-warning",
  });
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T11:30:00+09:00", durationMinutes: 30 })).toMatchObject({
    allowed: true,
    classification: "normal",
  });
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T12:30:00+09:00", durationMinutes: 30 })).toMatchObject({
    allowed: true,
    classification: "break-warning",
  });
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T13:00:00+09:00", durationMinutes: 30 })).toMatchObject({
    allowed: true,
    classification: "normal",
  });
  expect(isReceptionTimeAllowed({ settings, scheduledStartAt: "2026-05-01T19:30:00+09:00", durationMinutes: 30 }).allowed).toBe(true);
});
