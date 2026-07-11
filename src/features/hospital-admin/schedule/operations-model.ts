import { getWeekday } from "./model";
import type {
  HospitalScheduleShift,
  HospitalScheduleShiftKind,
  HospitalScheduleStaff,
} from "./types";

export type HospitalScheduleAssignmentSuggestion = {
  reason: string;
  staffId: string;
};

export type HospitalScheduleTimeClockEntry = {
  clockInMinutes: number;
  clockOutMinutes: number | null;
  staffId: string;
};

const roleByShiftKind: Partial<Record<HospitalScheduleShiftKind, HospitalScheduleStaff["role"]>> = {
  clinical: "veterinarian",
  reception: "reception",
  support: "technician",
};

function overlaps(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function hasAvailabilityConflict(staff: HospitalScheduleStaff, shift: HospitalScheduleShift) {
  const unavailable = staff.unavailableByWeekday[getWeekday(shift.date)] ?? [];

  return unavailable.some((range) =>
    overlaps(shift.startMinutes, shift.endMinutes, range.startMinutes, range.endMinutes),
  );
}

function getAssignedMinutes(shifts: HospitalScheduleShift[], staffId: string) {
  return shifts
    .filter(
      (shift) =>
        shift.staffId === staffId && shift.kind !== "leave" && shift.kind !== "off",
    )
    .reduce((total, shift) => total + shift.endMinutes - shift.startMinutes, 0);
}

export function getScheduleAssignmentSuggestions({
  staff,
  shifts,
  targetShift,
}: {
  staff: HospitalScheduleStaff[];
  shifts: HospitalScheduleShift[];
  targetShift: HospitalScheduleShift;
}): HospitalScheduleAssignmentSuggestion[] {
  const requiredRole = roleByShiftKind[targetShift.kind];
  if (!requiredRole) return [];

  return staff
    .filter((member) => member.role === requiredRole)
    .filter((member) => !hasAvailabilityConflict(member, targetShift))
    .filter(
      (member) =>
        !shifts.some(
          (shift) =>
            shift.staffId === member.id &&
            shift.date === targetShift.date &&
            overlaps(
              shift.startMinutes,
              shift.endMinutes,
              targetShift.startMinutes,
              targetShift.endMinutes,
            ),
        ),
    )
    .sort(
      (first, second) =>
        getAssignedMinutes(shifts, first.id) - getAssignedMinutes(shifts, second.id),
    )
    .map((member) => ({
      staffId: member.id,
      reason: "역할과 시간이 맞고 이번 주 배정 시간이 가장 적어.",
    }));
}

export function calculateSchedulePayrollPreview({
  staffProfiles,
  timeEntries,
}: {
  staffProfiles: Array<{ hourlyRateCents: number; staffId: string }>;
  timeEntries: HospitalScheduleTimeClockEntry[];
}) {
  const rateByStaffId = new Map(
    staffProfiles.map((profile) => [profile.staffId, profile.hourlyRateCents]),
  );
  const totalMinutes = timeEntries.reduce((total, entry) => {
    if (entry.clockOutMinutes === null || entry.clockOutMinutes <= entry.clockInMinutes) {
      return total;
    }

    return total + entry.clockOutMinutes - entry.clockInMinutes;
  }, 0);
  const totalPayCents = timeEntries.reduce((total, entry) => {
    const hourlyRateCents = rateByStaffId.get(entry.staffId) ?? 0;
    if (entry.clockOutMinutes === null || entry.clockOutMinutes <= entry.clockInMinutes) {
      return total;
    }

    return total + ((entry.clockOutMinutes - entry.clockInMinutes) / 60) * hourlyRateCents;
  }, 0);

  return { status: "preview" as const, totalMinutes, totalPayCents };
}
