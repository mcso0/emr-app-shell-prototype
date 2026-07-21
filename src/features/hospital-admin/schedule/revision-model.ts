import type {
  HospitalScheduleCompletenessStaff,
  HospitalScheduleIssue,
  HospitalScheduleNonWorkEntry,
  HospitalScheduleWorkBlock,
} from "./revision-types";

export function getScheduleWeekStart(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - weekday);
  return parsed.toISOString().slice(0, 10);
}

export function isScheduleDateInWeek(weekStart: string, date: string) {
  return getScheduleWeekStart(date) === weekStart;
}

export function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function getScheduleRevisionIssues({
  completenessStaff,
  nonWorkEntries,
  weekStart,
  workBlocks,
}: {
  completenessStaff: HospitalScheduleCompletenessStaff[];
  nonWorkEntries: HospitalScheduleNonWorkEntry[];
  weekStart: string;
  workBlocks: HospitalScheduleWorkBlock[];
}): HospitalScheduleIssue[] {
  const issues: HospitalScheduleIssue[] = [];
  const workByStaffAndDate = new Map<string, HospitalScheduleWorkBlock[]>();
  const nonWorkByStaffAndDate = new Map<string, HospitalScheduleNonWorkEntry[]>();

  for (const entry of nonWorkEntries) {
    if (!isScheduleDateInWeek(weekStart, entry.entryDate)) {
      issues.push(issue("date_outside_week", entry.id, entry.staffProfileId, entry.entryDate));
      continue;
    }
    if ((entry.startMinutes === null) !== (entry.endMinutes === null)) {
      issues.push(issue("invalid_time_range", entry.id, entry.staffProfileId, entry.entryDate));
    }
    if (
      entry.startMinutes !== null &&
      entry.endMinutes !== null &&
      (entry.startMinutes < 0 || entry.endMinutes > 1440 || entry.endMinutes <= entry.startMinutes)
    ) {
      issues.push(issue("invalid_time_range", entry.id, entry.staffProfileId, entry.entryDate));
    }
    const key = `${entry.staffProfileId}:${entry.entryDate}`;
    nonWorkByStaffAndDate.set(key, [...(nonWorkByStaffAndDate.get(key) ?? []), entry]);
  }

  for (const block of workBlocks) {
    if (!isScheduleDateInWeek(weekStart, block.shiftDate)) {
      issues.push(issue("date_outside_week", block.id, block.staffProfileId, block.shiftDate));
      continue;
    }
    if (
      block.startMinutes < 0 ||
      block.endMinutes > 1440 ||
      block.endMinutes <= block.startMinutes
    ) {
      issues.push(issue("invalid_time_range", block.id, block.staffProfileId, block.shiftDate));
      continue;
    }
    if (!block.staffProfileId) continue;

    const key = `${block.staffProfileId}:${block.shiftDate}`;
    const priorBlocks = workByStaffAndDate.get(key) ?? [];
    if (
      priorBlocks.some((prior) =>
        rangesOverlap(
          block.startMinutes,
          block.endMinutes,
          prior.startMinutes,
          prior.endMinutes,
        ),
      )
    ) {
      issues.push(issue("overlapping_assignment", block.id, block.staffProfileId, block.shiftDate));
    }

    const nonWork = nonWorkByStaffAndDate.get(key) ?? [];
    if (
      nonWork.some(
        (entry) =>
          entry.entryKind === "off" ||
          entry.startMinutes === null ||
          entry.endMinutes === null ||
          rangesOverlap(
            block.startMinutes,
            block.endMinutes,
            entry.startMinutes,
            entry.endMinutes,
          ),
      )
    ) {
      issues.push(issue("work_overlaps_non_work", block.id, block.staffProfileId, block.shiftDate));
    }
    workByStaffAndDate.set(key, [...priorBlocks, block]);
  }

  for (const staff of completenessStaff) {
    if (!staff.active || !staff.required) continue;
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = addDays(weekStart, dayOffset);
      const key = `${staff.staffProfileId}:${date}`;
      if (!workByStaffAndDate.has(key) && !nonWorkByStaffAndDate.has(key)) {
        issues.push(issue("missing_required_assignment", null, staff.staffProfileId, date));
      }
    }
  }

  return issues;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function issue(
  code: HospitalScheduleIssue["code"],
  entryId: string | null,
  staffProfileId: string | null,
  date: string | null,
): HospitalScheduleIssue {
  const messages: Record<HospitalScheduleIssue["code"], string> = {
    invalid_time_range: "근무 시간 범위가 올바르지 않아.",
    date_outside_week: "선택한 주차 밖의 날짜는 저장할 수 없어.",
    overlapping_assignment: "같은 직원의 근무 시간이 겹쳐.",
    work_overlaps_non_work: "근무와 휴무·휴가가 겹쳐.",
    inactive_staff_profile: "활성 상태가 아닌 직원에게 근무를 배정할 수 없어.",
    missing_required_assignment: "근무표 대상 직원의 근무·휴무·휴가가 미등록 상태야.",
    hospital_closed: "병원 휴무일에는 근무를 편성할 수 없어.",
    overnight_not_supported: "야간 근무는 날짜별 근무로 나누어 등록해줘.",
    stale_schedule_revision: "다른 관리자의 변경이 있어 최신 초안을 다시 불러와야 해.",
    roster_revalidation_required: "직원 구성 변경 후 재검토가 필요해.",
    operating_calendar_revalidation_required: "운영 시간 변경 후 재검토가 필요해.",
    outside_operating_hours: "운영 시간 밖의 근무야.",
    missing_location: "근무 위치를 확인해줘.",
  };
  return { code, date, entryId, message: messages[code], severity: "blocker", staffProfileId };
}
