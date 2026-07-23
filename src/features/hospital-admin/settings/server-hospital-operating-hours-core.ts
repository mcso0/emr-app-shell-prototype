import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  cloneHospitalBasicSettingsDraft,
  createInitialHospitalBasicSettingsDraft,
  validateOperatingHoursDraft,
  weekdays,
  type HospitalBasicSettingsDraft,
  type HospitalScheduleException,
  type WeekdaySchedule,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";

export type HospitalOperatingHoursSettings = Pick<
  HospitalBasicSettingsDraft,
  "timezone" | "weeklyHours" | "holidayPolicy" | "exceptions"
>;

export type HospitalOperatingHoursGateway = {
  get(workspaceId: string): Promise<{ ok: true; settings: HospitalOperatingHoursSettings } | { ok: false; error: "db_read_failed" }>;
  replace(input: { actorUserId: string; workspaceId: string; settings: HospitalOperatingHoursSettings }): Promise<
    | { ok: true; settings: HospitalOperatingHoursSettings }
    | { ok: false; error: "db_write_failed" | "future_appointment_conflict" }
  >;
};

type Result =
  | { ok: true; status: 200; settings: HospitalOperatingHoursSettings; enforcedBy: "hospital-operating-hours" }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Array<{ fieldId: string; message: string }> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; error: "future_appointment_conflict" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export async function readHospitalOperatingHours(input: {
  actorUserId: string | null;
  workspaceId: string;
  gateway?: HospitalOperatingHoursGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<Result> {
  const denied = authorize(input, "hospital_settings:view");
  if (denied) return denied;
  const result = await (input.gateway ?? createMockHospitalOperatingHoursGateway()).get(input.workspaceId);
  if (!result.ok) return { ok: false, status: 500, error: result.error };
  return { ok: true, status: 200, settings: result.settings, enforcedBy: "hospital-operating-hours" };
}

export async function updateHospitalOperatingHours(input: {
  actorUserId: string | null;
  workspaceId: string;
  settings: unknown;
  gateway?: HospitalOperatingHoursGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<Result> {
  const denied = authorize(input, "hospital_settings:manage");
  if (denied) return denied;
  const parsed = parseHospitalOperatingHoursSettingsInput(input.settings);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: parsed.fieldErrors,
    };
  }
  const result = await (input.gateway ?? createMockHospitalOperatingHoursGateway()).replace({
    actorUserId: input.actorUserId!,
    workspaceId: input.workspaceId,
    settings: parsed.settings,
  });
  if (!result.ok) {
    return result.error === "future_appointment_conflict"
      ? { ok: false, status: 409, error: result.error }
      : { ok: false, status: 500, error: result.error };
  }
  return { ok: true, status: 200, settings: result.settings, enforcedBy: "hospital-operating-hours" };
}

export type HospitalOperatingHoursInputResult =
  | { ok: true; settings: HospitalOperatingHoursSettings }
  | {
      ok: false;
      fieldErrors: Array<{ fieldId: string; message: string }>;
    };

export function parseHospitalOperatingHoursSettingsInput(
  value: unknown
): HospitalOperatingHoursInputResult {
  const malformed = (fieldId: string, message: string): HospitalOperatingHoursInputResult => ({
    ok: false,
    fieldErrors: [{ fieldId, message }],
  });

  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "timezone",
      "weeklyHours",
      "holidayPolicy",
      "exceptions",
    ])
  ) {
    return malformed("operating-hours", "운영시간 설정 형식을 확인해 주세요.");
  }
  if (!isTimeZone(value.timezone)) {
    return malformed("hospital-settings-timezone", "유효한 시간대를 선택해 주세요.");
  }
  if (
    value.holidayPolicy !== "closed" &&
    value.holidayPolicy !== "weekday" &&
    value.holidayPolicy !== "custom"
  ) {
    return malformed(
      "hospital-settings-holiday-policy",
      "공휴일 기본 정책을 선택해 주세요."
    );
  }
  if (
    !isRecord(value.weeklyHours) ||
    !hasExactKeys(value.weeklyHours, [...weekdays])
  ) {
    return malformed(
      "hospital-settings-weekly-hours",
      "월요일부터 일요일까지의 운영시간을 모두 입력해 주세요."
    );
  }

  const weeklyHours = {} as Record<(typeof weekdays)[number], WeekdaySchedule>;
  for (const day of weekdays) {
    const schedule = parseSchedule(value.weeklyHours[day]);
    if (!schedule) {
      return malformed(
        `hospital-settings-${day}`,
        "진료시간과 휴게시간을 HH:mm 형식으로 입력해 주세요."
      );
    }
    weeklyHours[day] = schedule;
  }

  if (!Array.isArray(value.exceptions) || value.exceptions.length > 366) {
    return malformed(
      "hospital-settings-exceptions",
      "예외 일정은 최대 366개까지 등록할 수 있습니다."
    );
  }
  const exceptions: HospitalScheduleException[] = [];
  for (const [index, exception] of value.exceptions.entries()) {
    const parsed = parseException(exception);
    if (!parsed) {
      return malformed(
        `hospital-settings-exception-${index}`,
        "예외 일정의 날짜와 운영시간 형식을 확인해 주세요."
      );
    }
    exceptions.push(parsed);
  }

  const settings: HospitalOperatingHoursSettings = {
    timezone: value.timezone,
    weeklyHours,
    holidayPolicy: value.holidayPolicy,
    exceptions,
  };
  const validationDraft = {
    ...createInitialHospitalBasicSettingsDraft(),
    ...settings,
  };
  const issues = validateOperatingHoursDraft(validationDraft);
  if (issues.length > 0) {
    return {
      ok: false,
      fieldErrors: issues.map(({ fieldId, message }) => ({ fieldId, message })),
    };
  }
  return { ok: true, settings: cloneSettings(settings) };
}

function authorize(
  input: { actorUserId: string | null; workspaceId: string; permissionAdapter?: WorkspacePermissionAdapter },
  permission: "hospital_settings:view" | "hospital_settings:manage"
): Extract<Result, { ok: false; status: 401 | 403 }> | null {
  const resolved = resolveWorkspacePermission(input.permissionAdapter ?? demoPermissions(), {
    sessionUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    requiredPermission: permission,
  });
  if (resolved.allowed) return null;
  return {
    ok: false,
    status: resolved.denialReason === "unauthenticated" ? 401 : 403,
    denialReason: resolved.denialReason ?? "permission_missing",
  };
}

const mockSettings = new Map<string, HospitalOperatingHoursSettings>();

export function createMockHospitalOperatingHoursGateway(): HospitalOperatingHoursGateway {
  return {
    async get(workspaceId) {
      return { ok: true, settings: cloneSettings(mockSettings.get(workspaceId) ?? defaultSettings()) };
    },
    async replace({ workspaceId, settings }) {
      mockSettings.set(workspaceId, cloneSettings(settings));
      return { ok: true, settings: cloneSettings(settings) };
    },
  };
}

export type SupabaseHospitalOperatingHoursClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseHospitalOperatingHoursGateway(
  client: SupabaseHospitalOperatingHoursClient
): HospitalOperatingHoursGateway {
  return {
    async get(workspaceId) {
      const { data, error } = await client.rpc("clair_get_workspace_operating_hours", { p_workspace_id: workspaceId });
      if (error) return { ok: false, error: "db_read_failed" };
      const settings = mapDbSettings(data);
      return settings ? { ok: true, settings } : { ok: false, error: "db_read_failed" };
    },
    async replace({ actorUserId, workspaceId, settings }) {
      const { data, error } = await client.rpc("clair_replace_workspace_operating_hours", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_settings: toDbSettings(settings),
      });
      if (error) {
        return { ok: false, error: error.message?.includes("future_appointment_conflict") ? "future_appointment_conflict" : "db_write_failed" };
      }
      const mapped = mapDbSettings(data);
      return mapped ? { ok: true, settings: mapped } : { ok: false, error: "db_write_failed" };
    },
  };
}

function toDbSettings(settings: HospitalOperatingHoursSettings) {
  return {
    timezone: settings.timezone,
    holidayPolicy: settings.holidayPolicy,
    weeklyHours: weekdays.map((day, dayOfWeek) => {
      const value = settings.weeklyHours[day];
      return {
        dayOfWeek,
        isOpen: value.isOpen,
        treatmentStart: value.isOpen ? value.treatment.start : null,
        treatmentEnd: value.isOpen ? value.treatment.end : null,
        breakStart: value.isOpen ? value.break.start : null,
        breakEnd: value.isOpen ? value.break.end : null,
      };
    }),
    exceptions: settings.exceptions.map((value) => ({
      id: value.id,
      date: value.date,
      mode: value.mode,
      treatmentStart: value.mode === "custom" ? value.treatment.start : null,
      treatmentEnd: value.mode === "custom" ? value.treatment.end : null,
      breakStart: value.mode === "custom" ? value.break.start : null,
      breakEnd: value.mode === "custom" ? value.break.end : null,
    })),
  };
}

function mapDbSettings(value: unknown): HospitalOperatingHoursSettings | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.timezone !== "string" || !Array.isArray(row.weeklyHours) || !Array.isArray(row.exceptions)) return null;
  const initial = defaultSettings();
  const weeklyHours = { ...initial.weeklyHours };
  for (const item of row.weeklyHours as Record<string, unknown>[]) {
    const index = Number(item.dayOfWeek);
    const day = weekdays[index];
    if (!day) continue;
    weeklyHours[day] = mapSchedule(item);
  }
  const exceptions = (row.exceptions as Record<string, unknown>[]).flatMap((item): HospitalScheduleException[] => {
    const date = String(item.date ?? "");
    const id = String(item.id ?? `exception-${date}`);
    if (item.mode === "closed") return [{ id, date, mode: "closed" }];
    if (item.mode !== "custom") return [];
    const schedule = mapSchedule({ ...item, isOpen: true });
    return [{ id, date, mode: "custom", treatment: schedule.treatment, break: schedule.break }];
  });
  return {
    timezone: row.timezone,
    holidayPolicy: row.holidayPolicy === "weekday" || row.holidayPolicy === "custom" ? row.holidayPolicy : "closed",
    weeklyHours,
    exceptions,
  };
}

function mapSchedule(item: Record<string, unknown>): WeekdaySchedule {
  const isOpen = Boolean(item.isOpen);
  return {
    isOpen,
    treatment: { start: String(item.treatmentStart ?? "09:00"), end: String(item.treatmentEnd ?? "19:00") },
    break: { start: String(item.breakStart ?? "13:00"), end: String(item.breakEnd ?? "14:00") },
  };
}

function defaultSettings(): HospitalOperatingHoursSettings {
  const { timezone, weeklyHours, holidayPolicy, exceptions } = createInitialHospitalBasicSettingsDraft();
  return { timezone, weeklyHours, holidayPolicy, exceptions };
}

function cloneSettings(settings: HospitalOperatingHoursSettings): HospitalOperatingHoursSettings {
  const cloned = cloneHospitalBasicSettingsDraft({
    ...createInitialHospitalBasicSettingsDraft(),
    ...settings,
  });
  return {
    timezone: cloned.timezone,
    weeklyHours: cloned.weeklyHours,
    holidayPolicy: cloned.holidayPolicy,
    exceptions: cloned.exceptions,
  };
}

function parseSchedule(value: unknown): WeekdaySchedule | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["isOpen", "treatment", "break"]) ||
    typeof value.isOpen !== "boolean"
  ) {
    return null;
  }
  const treatment = parseTimeRange(value.treatment);
  const breakRange = parseTimeRange(value.break);
  if (!treatment || !breakRange) return null;
  return {
    isOpen: value.isOpen,
    treatment,
    break: breakRange,
  };
}

function parseException(value: unknown): HospitalScheduleException | null {
  if (!isRecord(value) || !isExceptionId(value.id) || !isDate(value.date)) {
    return null;
  }
  if (
    value.mode === "closed" &&
    hasExactKeys(value, ["id", "date", "mode"])
  ) {
    return { id: value.id, date: value.date, mode: "closed" };
  }
  if (
    value.mode === "custom" &&
    hasExactKeys(value, ["id", "date", "mode", "treatment", "break"])
  ) {
    const treatment = parseTimeRange(value.treatment);
    const breakRange = parseTimeRange(value.break);
    if (!treatment || !breakRange) return null;
    return {
      id: value.id,
      date: value.date,
      mode: "custom",
      treatment,
      break: breakRange,
    };
  }
  return null;
}

function parseTimeRange(value: unknown) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["start", "end"]) ||
    !isTime(value.start) ||
    !isTime(value.end)
  ) {
    return null;
  }
  return { start: value.start, end: value.end };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    keys.every((key) => expected.includes(key))
  );
}

function isTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("ko-KR", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isExceptionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 100 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function demoPermissions() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
    ],
    memberships: [
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-front", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
    ],
  });
}
