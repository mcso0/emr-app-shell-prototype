import { expect, test } from "@playwright/test";
import {
  calculateSchedulePayrollPreview,
  getScheduleAssignmentSuggestions,
} from "@/features/hospital-admin/schedule/operations-model";
import type { HospitalScheduleShift, HospitalScheduleStaff } from "@/features/hospital-admin/schedule/types";

const staff: HospitalScheduleStaff[] = [
  { id: "staff-busy", name: "바쁜 접수", initials: "바접", role: "reception", roleLabel: "접수", weeklyTargetMinutes: 40 * 60, unavailableByWeekday: {} },
  { id: "staff-free", name: "여유 접수", initials: "여접", role: "reception", roleLabel: "접수", weeklyTargetMinutes: 40 * 60, unavailableByWeekday: {} },
  { id: "staff-tech", name: "검사 담당", initials: "검담", role: "technician", roleLabel: "테크니션", weeklyTargetMinutes: 40 * 60, unavailableByWeekday: {} },
];

const busyShift: HospitalScheduleShift = {
  id: "busy-shift", staffId: "staff-busy", date: "2026-07-06", startMinutes: 9 * 60, endMinutes: 18 * 60, kind: "reception", workLabel: "접수", locationLabel: "프런트", note: null,
};

test("schedule assignment suggests the lowest-load eligible staff without changing the draft", () => {
  const suggestions = getScheduleAssignmentSuggestions({
    staff,
    shifts: [busyShift],
    targetShift: { ...busyShift, id: "unassigned", staffId: null, startMinutes: 10 * 60, endMinutes: 14 * 60 },
  });

  expect(suggestions).toEqual([
    expect.objectContaining({ staffId: "staff-free", reason: "역할과 시간이 맞고 이번 주 배정 시간이 가장 적습니다." }),
  ]);
  expect(busyShift.staffId).toBe("staff-busy");
});

test("schedule payroll preview uses completed clock entries and never creates a payment", () => {
  const preview = calculateSchedulePayrollPreview({
    staffProfiles: [{ staffId: "staff-free", hourlyRateCents: 2500 }],
    timeEntries: [{ staffId: "staff-free", clockInMinutes: 9 * 60, clockOutMinutes: 17 * 60 }],
  });

  expect(preview).toEqual({ totalMinutes: 8 * 60, totalPayCents: 20_000, status: "preview" });
});
