import type {
  HospitalScheduleConflict,
  HospitalScheduleCoverageIssue,
  HospitalScheduleRequest,
  HospitalScheduleSeed,
  HospitalScheduleShift,
} from "./types";

const dayMilliseconds = 24 * 60 * 60 * 1000;

const toUtcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

export function getWeekDates(weekStart: string) {
  const start = toUtcDate(weekStart).getTime();

  return Array.from({ length: 7 }, (_, index) =>
    new Date(start + index * dayMilliseconds).toISOString().slice(0, 10),
  );
}

export function getWeekday(date: string) {
  return toUtcDate(date).getUTCDay();
}

export function formatScheduleMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (minutes % 60).toString().padStart(2, "0");

  return `${hours}:${remainder}`;
}

export function cloneScheduleSeed(seed: HospitalScheduleSeed): HospitalScheduleSeed {
  return {
    ...seed,
    staff: seed.staff.map((staff) => ({
      ...staff,
      unavailableByWeekday: Object.fromEntries(
        Object.entries(staff.unavailableByWeekday).map(([weekday, ranges]) => [
          weekday,
          ranges?.map((range) => ({ ...range })) ?? [],
        ]),
      ),
    })),
    shifts: seed.shifts.map((shift) => ({ ...shift })),
    requests: seed.requests.map((request) => ({ ...request })),
    coverageRules: seed.coverageRules.map((rule) => ({ ...rule })),
    publication: {
      ...seed.publication,
      changedShiftIds: [...seed.publication.changedShiftIds],
    },
    settings: { ...seed.settings },
  };
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function isWorkingShift(shift: HospitalScheduleShift) {
  return shift.staffId !== null && shift.kind !== "leave" && shift.kind !== "off";
}

export function getScheduleConflicts(
  seed: Pick<HospitalScheduleSeed, "staff" | "shifts">,
) {
  const conflicts: HospitalScheduleConflict[] = [];
  const staffById = new Map(seed.staff.map((staff) => [staff.id, staff]));
  const shiftsByStaffAndDate = new Map<string, HospitalScheduleShift[]>();

  for (const shift of seed.shifts) {
    if (!isWorkingShift(shift) || !shift.staffId) {
      continue;
    }

    const staff = staffById.get(shift.staffId);
    const unavailableRanges = staff?.unavailableByWeekday[getWeekday(shift.date)] ?? [];

    if (
      unavailableRanges.some((range) =>
        rangesOverlap(
          shift.startMinutes,
          shift.endMinutes,
          range.startMinutes,
          range.endMinutes,
        ),
      )
    ) {
      conflicts.push({
        kind: "availability",
        shiftId: shift.id,
        staffId: shift.staffId,
        message: "근무 가능 시간을 벗어났어.",
      });
    }

    const key = `${shift.staffId}:${shift.date}`;
    const sameDay = shiftsByStaffAndDate.get(key) ?? [];

    for (const priorShift of sameDay) {
      if (
        rangesOverlap(
          shift.startMinutes,
          shift.endMinutes,
          priorShift.startMinutes,
          priorShift.endMinutes,
        )
      ) {
        conflicts.push({
          kind: "overlap",
          shiftId: shift.id,
          staffId: shift.staffId,
          message: "같은 시간대의 근무가 겹쳐.",
        });
      }
    }

    sameDay.push(shift);
    shiftsByStaffAndDate.set(key, sameDay);
  }

  return conflicts;
}

export function getCoverageIssues(seed: Pick<HospitalScheduleSeed, "staff" | "shifts" | "coverageRules">) {
  const staffById = new Map(seed.staff.map((staff) => [staff.id, staff]));

  return seed.coverageRules.reduce<HospitalScheduleCoverageIssue[]>((issues, rule) => {
    const assignedStaffCount = seed.shifts.filter((shift) => {
      if (!isWorkingShift(shift) || shift.date !== rule.date || !shift.staffId) {
        return false;
      }

      const staff = staffById.get(shift.staffId);

      return (
        staff?.role === rule.role &&
        shift.startMinutes <= rule.startMinutes &&
        shift.endMinutes >= rule.endMinutes
      );
    }).length;

    if (assignedStaffCount < rule.minimumStaff) {
      issues.push({ ...rule, assignedStaffCount });
    }

    return issues;
  }, []);
}

export function applyApprovedRequest(
  seed: HospitalScheduleSeed,
  request: HospitalScheduleRequest,
) {
  const next = cloneScheduleSeed(seed);
  const requestIndex = next.requests.findIndex((candidate) => candidate.id === request.id);

  if (requestIndex < 0 || next.requests[requestIndex].status !== "pending") {
    return next;
  }

  const pendingRequest = next.requests[requestIndex];
  next.requests[requestIndex] = { ...pendingRequest, status: "approved" };

  if (pendingRequest.shiftId) {
    const shiftIndex = next.shifts.findIndex((shift) => shift.id === pendingRequest.shiftId);

    if (shiftIndex >= 0) {
      const shift = next.shifts[shiftIndex];
      next.shifts[shiftIndex] = {
        ...shift,
        ...(pendingRequest.type === "leave"
          ? {
              kind: "leave" as const,
              workLabel: "휴무",
              locationLabel: null,
              note: pendingRequest.reason,
            }
          : {
              startMinutes: pendingRequest.requestedStartMinutes ?? shift.startMinutes,
              endMinutes: pendingRequest.requestedEndMinutes ?? shift.endMinutes,
              note: pendingRequest.reason,
            }),
      };

      next.publication = {
        ...next.publication,
        state: "changed",
        changedShiftIds: Array.from(new Set([...next.publication.changedShiftIds, shift.id])),
      };
    }
  }

  return next;
}
