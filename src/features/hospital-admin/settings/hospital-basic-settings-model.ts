export const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof weekdays)[number];
export type ScheduleRangeKind = "treatment" | "break";
export type TimeRange = { start: string; end: string };

export type WeekdaySchedule = {
  isOpen: boolean;
  treatment: TimeRange;
  break: TimeRange;
};

export type HospitalScheduleException =
  | { id: string; date: string; mode: "closed" }
  | {
      id: string;
      date: string;
      mode: "custom";
      treatment: TimeRange;
      break: TimeRange;
    };

export type HospitalBasicSettingsDraft = {
  timezone: string;
  contact: {
    phone: string;
    fax: string;
    homepage: string;
    instagram: string;
  };
  weeklyHours: Record<Weekday, WeekdaySchedule>;
  holidayPolicy: "closed" | "weekday" | "custom";
  exceptions: HospitalScheduleException[];
};

export type HospitalSettingsValidationIssue = {
  code:
    | "required_phone"
    | "invalid_homepage"
    | "treatment_range"
    | "break_range"
    | "break_outside_treatment"
    | "duplicate_exception_date";
  fieldId: string;
  message: string;
};

const defaultWeekdaySchedule: WeekdaySchedule = {
  isOpen: true,
  treatment: { start: "09:00", end: "19:00" },
  break: { start: "13:00", end: "14:00" },
};

const saturdaySchedule: WeekdaySchedule = {
  isOpen: true,
  treatment: { start: "09:00", end: "17:00" },
  break: { start: "12:30", end: "13:30" },
};

const sundaySchedule: WeekdaySchedule = {
  ...saturdaySchedule,
  isOpen: false,
};

export function createInitialHospitalBasicSettingsDraft(): HospitalBasicSettingsDraft {
  return {
    timezone: "Asia/Seoul",
    contact: {
      phone: "02-6203-7582",
      fax: "02-6203-7583",
      homepage: "",
      instagram: "",
    },
    weeklyHours: {
      monday: cloneWeekdaySchedule(defaultWeekdaySchedule),
      tuesday: cloneWeekdaySchedule(defaultWeekdaySchedule),
      wednesday: cloneWeekdaySchedule(defaultWeekdaySchedule),
      thursday: cloneWeekdaySchedule(defaultWeekdaySchedule),
      friday: cloneWeekdaySchedule(defaultWeekdaySchedule),
      saturday: cloneWeekdaySchedule(saturdaySchedule),
      sunday: cloneWeekdaySchedule(sundaySchedule),
    },
    holidayPolicy: "closed",
    exceptions: [],
  };
}

export function cloneHospitalBasicSettingsDraft(
  draft: HospitalBasicSettingsDraft
): HospitalBasicSettingsDraft {
  return JSON.parse(JSON.stringify(draft)) as HospitalBasicSettingsDraft;
}

export function createTimeOptions(intervalMinutes = 30): string[] {
  const values: string[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
    const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
    const minute = (minutes % 60).toString().padStart(2, "0");
    values.push(`${hour}:${minute}`);
  }

  return values;
}

export function hasHospitalBasicSettingsChanges(
  draft: HospitalBasicSettingsDraft,
  savedDraft: HospitalBasicSettingsDraft
): boolean {
  return serializeDraft(draft) !== serializeDraft(savedDraft);
}

export function hasOperatingHoursChanges(
  draft: HospitalBasicSettingsDraft,
  savedDraft: HospitalBasicSettingsDraft
): boolean {
  return JSON.stringify({
    exceptions: draft.exceptions,
    holidayPolicy: draft.holidayPolicy,
    timezone: draft.timezone,
    weeklyHours: draft.weeklyHours,
  }) !==
    JSON.stringify({
      exceptions: savedDraft.exceptions,
      holidayPolicy: savedDraft.holidayPolicy,
      timezone: savedDraft.timezone,
      weeklyHours: savedDraft.weeklyHours,
    });
}

export type EffectiveOperatingHours = {
  date: string;
  timezone: string;
  isOpen: boolean;
  source: "weekly" | "exception";
  treatmentStart: string | null;
  treatmentEnd: string | null;
  breakStart: string | null;
  breakEnd: string | null;
};

export function resolveEffectiveOperatingHours(
  settings: Pick<HospitalBasicSettingsDraft, "timezone" | "weeklyHours" | "exceptions">,
  date: string
): EffectiveOperatingHours {
  const exception = settings.exceptions.find((item) => item.date === date);
  if (exception?.mode === "closed") {
    return closedSchedule(date, settings.timezone, "exception");
  }
  if (exception?.mode === "custom") {
    return {
      date,
      timezone: settings.timezone,
      isOpen: true,
      source: "exception",
      treatmentStart: exception.treatment.start,
      treatmentEnd: exception.treatment.end,
      breakStart: exception.break.start,
      breakEnd: exception.break.end,
    };
  }

  const weekdayIndex = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const schedule = settings.weeklyHours[weekdays[weekdayIndex]];
  if (!schedule.isOpen) return closedSchedule(date, settings.timezone, "weekly");
  return {
    date,
    timezone: settings.timezone,
    isOpen: true,
    source: "weekly",
    treatmentStart: schedule.treatment.start,
    treatmentEnd: schedule.treatment.end,
    breakStart: schedule.break.start,
    breakEnd: schedule.break.end,
  };
}

function closedSchedule(
  date: string,
  timezone: string,
  source: EffectiveOperatingHours["source"]
): EffectiveOperatingHours {
  return {
    date,
    timezone,
    isOpen: false,
    source,
    treatmentStart: null,
    treatmentEnd: null,
    breakStart: null,
    breakEnd: null,
  };
}

export function applyScheduleRangeToOpenDays(
  draft: HospitalBasicSettingsDraft,
  sourceDay: Weekday,
  rangeKind: ScheduleRangeKind
): HospitalBasicSettingsDraft {
  const sourceRange = draft.weeklyHours[sourceDay][rangeKind];
  const next = cloneHospitalBasicSettingsDraft(draft);

  for (const day of weekdays) {
    if (!next.weeklyHours[day].isOpen) continue;
    next.weeklyHours[day][rangeKind] = { ...sourceRange };
  }

  return next;
}

export function validateHospitalBasicSettingsDraft(
  draft: HospitalBasicSettingsDraft
): HospitalSettingsValidationIssue[] {
  const issues: HospitalSettingsValidationIssue[] = [];

  if (!draft.contact.phone.trim()) {
    issues.push({
      code: "required_phone",
      fieldId: "hospital-settings-phone",
      message: "대표 전화를 입력해 주세요.",
    });
  }

  if (draft.contact.homepage.trim() && !isHttpUrl(draft.contact.homepage)) {
    issues.push({
      code: "invalid_homepage",
      fieldId: "hospital-settings-homepage",
      message: "홈페이지 주소를 http:// 또는 https:// 형식으로 입력해 주세요.",
    });
  }

  for (const day of weekdays) {
    const schedule = draft.weeklyHours[day];
    if (!schedule.isOpen) continue;
    issues.push(...validateRanges(schedule, `hospital-settings-${day}`));
  }

  const exceptionDates = new Set<string>();
  for (const exception of draft.exceptions) {
    if (exceptionDates.has(exception.date)) {
      issues.push({
        code: "duplicate_exception_date",
        fieldId: `hospital-settings-exception-${exception.id}-date`,
        message: "같은 날짜의 예외 일정이 이미 있습니다.",
      });
      continue;
    }

    exceptionDates.add(exception.date);
    if (exception.mode === "custom") {
      issues.push(...validateRanges(exception, `hospital-settings-exception-${exception.id}`));
    }
  }

  return issues;
}

function cloneWeekdaySchedule(schedule: WeekdaySchedule): WeekdaySchedule {
  return {
    ...schedule,
    break: { ...schedule.break },
    treatment: { ...schedule.treatment },
  };
}

function serializeDraft(draft: HospitalBasicSettingsDraft): string {
  return JSON.stringify(draft);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateRanges(
  schedule: Pick<WeekdaySchedule, "treatment" | "break">,
  fieldPrefix: string
): HospitalSettingsValidationIssue[] {
  const issues: HospitalSettingsValidationIssue[] = [];
  const treatmentStart = toMinutes(schedule.treatment.start);
  const treatmentEnd = toMinutes(schedule.treatment.end);
  const breakStart = toMinutes(schedule.break.start);
  const breakEnd = toMinutes(schedule.break.end);

  if (treatmentStart >= treatmentEnd) {
    issues.push({
      code: "treatment_range",
      fieldId: `${fieldPrefix}-treatment-start`,
      message: "진료 종료 시간은 시작 시간보다 늦어야 합니다.",
    });
  }

  if (breakStart >= breakEnd) {
    issues.push({
      code: "break_range",
      fieldId: `${fieldPrefix}-break-start`,
      message: "휴게 종료 시간은 시작 시간보다 늦어야 합니다.",
    });
  }

  if (treatmentStart < treatmentEnd && (breakStart < treatmentStart || breakEnd > treatmentEnd)) {
    issues.push({
      code: "break_outside_treatment",
      fieldId: `${fieldPrefix}-break-start`,
      message: "휴게시간은 진료시간 안에 있어야 합니다.",
    });
  }

  return issues;
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
