import { expect, test } from "@playwright/test";

import { validateReceptionCalendarSelection } from "../src/features/reception/calendar-selection";
import { createCalendarTimeScale } from "../src/features/reception/calendar-time-scale";
import type { ReceptionDraftCheckIn } from "../src/features/reception/data";
import type { Appointment } from "../src/types/emr-domain";

const date = "2026-05-02";
const input = () => ({ appointments: [] as Appointment[], draftCheckIns: [] as ReceptionDraftCheckIn[], currentDate: "2026-05-01", operatingDate: date, currentOperatingMinutes: 11 * 60 + 20, startMinutes: 11 * 60, endMinutes: 11 * 60 + 30, veterinarianId: "synthetic-vet-a" });
const appointment = (patch: Partial<Appointment> = {}): Appointment => ({
  id: "synthetic-appointment", workspaceId: "synthetic-workspace", patientId: "synthetic-patient", assignedVeterinarianId: "synthetic-vet-a",
  scheduledStartAt: `${date}T11:15:00+09:00`, scheduledEndAt: `${date}T11:45:00+09:00`, status: "confirmed", createdAt: `${date}T09:00:00+09:00`, updatedAt: `${date}T09:00:00+09:00`, ...patch,
});
const draft = (): ReceptionDraftCheckIn => ({
  durationMinutes: 30, plannedStartAt: `${date}T11:15:00+09:00`,
  encounter: { id: "synthetic-encounter", workspaceId: "synthetic-workspace", patientId: "synthetic-patient", primaryVeterinarianId: "synthetic-vet-a", encounterNo: "S-1", visitPurpose: "합성 접수", status: "waiting", createdAt: `${date}T10:00:00+09:00`, updatedAt: `${date}T10:00:00+09:00` },
  queueEntry: { id: "synthetic-queue", workspaceId: "synthetic-workspace", encounterId: "synthetic-encounter", queueType: "consultation", status: "waiting", priority: "normal", enteredAt: `${date}T10:00:00+09:00` },
});
const scale = (isOpen = true) => createCalendarTimeScale({ date, timezone: "Asia/Seoul", isOpen, source: "weekly", treatmentStart: isOpen ? "08:00" : null, treatmentEnd: isOpen ? "20:00" : null, breakStart: "12:00", breakEnd: "13:00" });

test("calendar selection rounds outward to quarters and preserves the Seoul planned timestamp", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 661, endMinutes: 689 }))
    .toEqual({ valid: true, startMinutes: 660, endMinutes: 690, durationMinutes: 30, plannedStartAt: `${date}T11:00:00+09:00` });
});

test("reverse dragging selects the same chronological interval", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 689, endMinutes: 661 }))
    .toEqual(validateReceptionCalendarSelection({ ...input(), startMinutes: 661, endMinutes: 689 }));
});

test("a point selection keeps the existing minimum quarter", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 660, endMinutes: 660 }))
    .toMatchObject({ valid: true, startMinutes: 660, endMinutes: 675, durationMinutes: 15 });
});

test("the four-hour maximum remains inclusive and oversize selections preserve the error copy", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 540, endMinutes: 780 })).toMatchObject({ valid: true, durationMinutes: 240 });
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 540, endMinutes: 795 }))
    .toEqual({ valid: false, reason: "too-long", message: "접수 task는 최대 240분까지 만들 수 있습니다." });
});

test("fallback business hours reject outside slots but accept the closing boundary", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 525, endMinutes: 540 })).toMatchObject({ valid: false, reason: "outside-business-hours" });
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 1125, endMinutes: 1140 })).toMatchObject({ valid: true });
});

test("elapsed time is blocked today and the same interval remains eligible on a future date", () => {
  expect(validateReceptionCalendarSelection({ ...input(), operatingDate: "2026-05-01" })).toMatchObject({ valid: false, reason: "past-time" });
  expect(validateReceptionCalendarSelection(input())).toMatchObject({ valid: true });
});

test("a same-veterinarian reservation overlap is rejected with its existing label fallback", () => {
  expect(validateReceptionCalendarSelection({ ...input(), appointments: [appointment()] }))
    .toEqual({ valid: false, reason: "overlap", message: "예약과 겹치는 시간에는 접수/예약을 만들 수 없습니다." });
});

test("other-veterinarian reservations and touching boundaries do not collide", () => {
  expect(validateReceptionCalendarSelection({ ...input(), appointments: [appointment({ assignedVeterinarianId: "synthetic-vet-b" })] })).toMatchObject({ valid: true });
  expect(validateReceptionCalendarSelection({ ...input(), endMinutes: 675, appointments: [appointment()] })).toMatchObject({ valid: true });
});

test("pending walk-ins use their planned interval and visit purpose for overlap feedback", () => {
  expect(validateReceptionCalendarSelection({ ...input(), draftCheckIns: [draft()] }))
    .toEqual({ valid: false, reason: "overlap", message: "합성 접수과 겹치는 시간에는 접수/예약을 만들 수 없습니다." });
});

test("walk-in time fallback and omitted duration preserve the thirty-minute block", () => {
  const pending = draft();
  delete pending.plannedStartAt;
  delete pending.durationMinutes;
  pending.encounter.checkedInAt = `${date}T11:15:00+09:00`;
  expect(validateReceptionCalendarSelection({ ...input(), draftCheckIns: [pending] })).toMatchObject({ valid: false, reason: "overlap" });
});

test("a supplied operating scale overrides fallback hours without changing closed-date denial", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 480, endMinutes: 510, timeScale: scale() })).toMatchObject({ valid: true });
  expect(validateReceptionCalendarSelection({ ...input(), timeScale: scale(false) })).toMatchObject({ valid: false, reason: "outside-business-hours" });
});

test("a break-warning interval stays selectable under the existing operating scale", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 735, endMinutes: 765, timeScale: scale() })).toMatchObject({ valid: true });
});

test("validation precedence keeps duration before hours and today-time before overlap", () => {
  expect(validateReceptionCalendarSelection({ ...input(), startMinutes: 0, endMinutes: 300, operatingDate: "2026-05-01", appointments: [appointment()] })).toMatchObject({ valid: false, reason: "too-long" });
  expect(validateReceptionCalendarSelection({ ...input(), operatingDate: "2026-05-01", appointments: [appointment()] })).toMatchObject({ valid: false, reason: "past-time" });
});

test("selection evaluation does not alter appointments or pending encounter snapshots", () => {
  const args = { ...input(), appointments: [appointment()], draftCheckIns: [draft()] };
  const before = JSON.stringify(args);
  const first = validateReceptionCalendarSelection(args);
  expect(validateReceptionCalendarSelection(args)).toEqual(first);
  expect(JSON.stringify(args)).toBe(before);
});
