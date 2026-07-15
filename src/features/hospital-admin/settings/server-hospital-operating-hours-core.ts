import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  cloneHospitalBasicSettingsDraft,
  createInitialHospitalBasicSettingsDraft,
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
  settings: HospitalOperatingHoursSettings;
  gateway?: HospitalOperatingHoursGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<Result> {
  const denied = authorize(input, "hospital_settings:manage");
  if (denied) return denied;
  const result = await (input.gateway ?? createMockHospitalOperatingHoursGateway()).replace({
    actorUserId: input.actorUserId!, workspaceId: input.workspaceId, settings: input.settings,
  });
  if (!result.ok) {
    return result.error === "future_appointment_conflict"
      ? { ok: false, status: 409, error: result.error }
      : { ok: false, status: 500, error: result.error };
  }
  return { ok: true, status: 200, settings: result.settings, enforcedBy: "hospital-operating-hours" };
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
