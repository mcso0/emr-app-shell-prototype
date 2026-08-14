import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { AVATAR_STORAGE_BUCKET } from "@/features/staff/staff-avatar";
import { PRIVATE_PROFILE_AVATAR_BUCKET } from "@/features/staff/server-profile-avatar-core";

export type StaffOperationalProfile = {
  avatarUrl?: string;
  department?: string;
  displayName: string;
  email?: string;
  initials?: string;
  jobPositionLabel?: string;
  lastSeenAt?: string;
  membershipStatus: "active" | "inactive" | "suspended";
  phone?: string;
  statusMessage?: string;
  statusMessageUpdatedAt?: string;
  title?: string;
};

export type StaffOperationalShift = {
  date: string;
  endMinutes: number;
  kind: "clinical" | "support" | "reception" | "leave" | "off";
  locationLabel: string | null;
  startMinutes: number;
  workLabel: string;
};

export type StaffCurrentWorkState =
  | "working"
  | "scheduled"
  | "in_consultation"
  | "clocked_out"
  | "shift_ended"
  | "leave"
  | "same_day_leave"
  | "off"
  | "hospital_closed";

export type StaffCurrentWorkInfo = {
  date: string;
  detailLabel: string | null;
  endMinutes: number | null;
  source: "schedule" | "time_clock" | "encounter" | "operating_hours";
  startMinutes: number | null;
  state: StaffCurrentWorkState;
};

export type StaffOperationalAvailability = {
  event: Pick<StaffOperationalShift, "date" | "kind">;
  returnShift?: StaffOperationalShift;
};

export type StaffOperationalProfileCapabilities = {
  canEditAvatar: boolean;
  canEditStatusMessage: boolean;
  canManageMember: boolean;
  manageMemberHref: string | null;
  scheduleHref: string | null;
};

export type StaffOperationalProfileGateway = {
  readProfile(input: {
    date: string;
    userId: string;
    workspaceId: string;
  }): Promise<
    | {
        ok: true;
        availability: StaffOperationalAvailability | null;
        availabilityError?: "schedule_read_failed";
        currentWork: StaffCurrentWorkInfo | null;
        profile: StaffOperationalProfile;
        scheduleProfileId?: string;
        shift: StaffOperationalShift | null;
        shiftError?: "schedule_read_failed";
      }
    | { ok: false; error: "db_read_failed" | "not_found" }
  >;
};

type SupabaseOperationalProfileQueryResult = {
  data: Array<Record<string, unknown>> | null;
  error: { message?: string } | null;
};

type SupabaseOperationalProfileQueryBuilder =
  PromiseLike<SupabaseOperationalProfileQueryResult> & {
    eq(column: string, value: string): SupabaseOperationalProfileQueryBuilder;
    select(columns: string): SupabaseOperationalProfileQueryBuilder;
  };

export type SupabaseStaffOperationalProfileClient = {
  from(table: string): SupabaseOperationalProfileQueryBuilder;
  rpc(
    functionName:
      | "hospital_schedule_read_profile_schedule"
      | "staff_current_work_status_snapshot",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<{
        data: { signedUrl?: string } | null;
        error: { message?: string } | null;
      }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

export type StaffOperationalProfileReadResult =
  | {
      ok: true;
      status: 200;
      availability: StaffOperationalAvailability | null;
      capabilities: StaffOperationalProfileCapabilities;
      currentWork: StaffCurrentWorkInfo | null;
      profile: StaffOperationalProfile;
      shift: StaffOperationalShift | null;
      sectionErrors?: {
        availability?: "schedule_read_failed";
        shift?: "schedule_read_failed";
      };
      enforcedBy: "staff-operational-profile-read";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 404; error: "not_found" }
  | { ok: false; status: 500; error: "db_read_failed" };

export async function readStaffOperationalProfile({
  actorUserId,
  date,
  gateway,
  permissionAdapter,
  userId,
  workspaceId,
}: {
  actorUserId: string | null;
  date: string;
  gateway: StaffOperationalProfileGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  userId: string;
  workspaceId: string;
}): Promise<StaffOperationalProfileReadResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.readProfile({ date, userId, workspaceId });
  if (!result.ok) {
    return result.error === "not_found"
      ? { ok: false, status: 404, error: "not_found" }
      : { ok: false, status: 500, error: "db_read_failed" };
  }

  const canManageMember = permission.effectivePermissionIds.includes(
    "role_permission:manage",
  );
  const canViewSchedule = permission.effectivePermissionIds.includes(
    "hospital_settings:view",
  );

  return {
    ok: true,
    status: 200,
    availability: result.availability,
    capabilities: {
      canEditAvatar: actorUserId === userId,
      canEditStatusMessage: actorUserId === userId,
      canManageMember,
      manageMemberHref: canManageMember
        ? buildHospitalAdminHref(workspaceId, "members", {
            memberUserId: userId,
          })
        : null,
      scheduleHref: canViewSchedule
        ? buildHospitalAdminHref(workspaceId, "schedule", {
            ...(result.scheduleProfileId
              ? { staffId: result.scheduleProfileId }
              : {}),
            weekStart: getWeekStart(date),
          })
        : null,
    },
    currentWork: result.currentWork,
    profile: result.profile,
    shift: result.shift,
    ...buildSectionErrors(result),
    enforcedBy: "staff-operational-profile-read",
  };
}

export function createSupabaseStaffOperationalProfileGateway(
  client: SupabaseStaffOperationalProfileClient,
): StaffOperationalProfileGateway {
  return {
    async readProfile({ date, userId, workspaceId }) {
      try {
        const memberships = await readRows(
          client,
          "user_memberships",
          "id, workspace_id, user_id, department, title, status",
          { workspace_id: workspaceId, user_id: userId },
        );
        const membership = memberships[0];
        if (!membership) return { ok: false, error: "not_found" };

        const users = await readRows(
          client,
          "users",
          "id, display_name, initial, email, phone, status",
          { id: userId },
        );
        const user = users[0];
        if (!user || typeof user.display_name !== "string") {
          return { ok: false, error: "not_found" };
        }

        const [profiles, activities, statuses, assignments] = await Promise.all([
          readRows(
            client,
            "user_profiles",
            "user_id, avatar_url, avatar_storage_path, avatar_legacy_hidden",
            { user_id: userId },
          ),
          readOptionalRows(
            client,
            "workspace_member_activity",
            "workspace_id, user_id, last_seen_at",
            { workspace_id: workspaceId, user_id: userId },
          ),
          readRows(
            client,
            "workspace_member_status_messages",
            "workspace_id, user_id, status_message, updated_at",
            { workspace_id: workspaceId, user_id: userId },
          ),
          readRows(
            client,
            "workspace_membership_job_position_assignments",
            "workspace_id, membership_id, job_position_id",
            {
              workspace_id: workspaceId,
              membership_id: String(membership.id),
            },
          ),
        ]);
        const jobPositionId = assignments[0]?.job_position_id;
        const positions =
          typeof jobPositionId === "string"
            ? await readRows(
                client,
                "workspace_job_positions",
                "id, workspace_id, label",
                { id: jobPositionId, workspace_id: workspaceId },
              )
            : [];
        const profile: StaffOperationalProfile = {
          displayName: user.display_name,
          membershipStatus: resolveMembershipStatus(
            membership.status,
            user.status,
          ),
          ...(typeof user.initial === "string"
            ? { initials: user.initial }
            : {}),
          ...resolveOptionalText("email", user.email),
          ...resolveOptionalText("phone", user.phone),
          ...resolveOptionalTimestamp(activities[0]?.last_seen_at),
          ...resolveStatusMessage(statuses[0]),
          ...(typeof membership.department === "string"
            ? { department: membership.department }
            : {}),
          ...(typeof membership.title === "string"
            ? { title: membership.title }
            : {}),
          ...(typeof positions[0]?.label === "string"
            ? { jobPositionLabel: positions[0].label }
            : {}),
          ...(await resolveAvatar(client, profiles[0])),
        };

        const [profileScheduleRead, currentWorkRead] = await Promise.all([
          client.rpc("hospital_schedule_read_profile_schedule", {
            p_workspace_id: workspaceId,
            p_user_id: userId,
            p_start_date: date,
            p_end_date: addDays(date, 13),
          }),
          client.rpc("staff_current_work_status_snapshot", {
            p_day: date,
            p_user_id: userId,
            p_workspace_id: workspaceId,
          }),
        ]);
        const profileSchedule = profileScheduleRead.error
          ? null
          : parseProfileSchedule(profileScheduleRead.data);
        const scheduleProfileId = profileSchedule?.scheduleProfileId;
        const availabilityError = Boolean(profileScheduleRead.error);
        const shiftError = Boolean(profileScheduleRead.error || currentWorkRead.error);

        return {
          ok: true,
          availability: availabilityError
            ? null
            : readAvailabilityFromProfileSchedule(profileSchedule?.shifts ?? [], date),
          ...(availabilityError
            ? { availabilityError: "schedule_read_failed" as const }
            : {}),
          currentWork: currentWorkRead.error
            ? null
            : parseCurrentWork(currentWorkRead.data),
          profile,
          ...(scheduleProfileId ? { scheduleProfileId } : {}),
          shift: shiftError
            ? null
            : profileSchedule?.shifts.find((shift) => shift.date === date) ?? null,
          ...(shiftError
            ? { shiftError: "schedule_read_failed" as const }
            : {}),
        };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
  };
}

function buildSectionErrors(
  result: Extract<
    Awaited<ReturnType<StaffOperationalProfileGateway["readProfile"]>>,
    { ok: true }
  >,
): Pick<StaffOperationalProfileReadResult & { ok: true }, "sectionErrors"> | Record<string, never> {
  if (!result.shiftError && !result.availabilityError) return {};
  return {
    sectionErrors: {
      ...(result.availabilityError
        ? { availability: result.availabilityError }
        : {}),
      ...(result.shiftError ? { shift: result.shiftError } : {}),
    },
  };
}

function buildHospitalAdminHref(
  workspaceId: string,
  section: "members" | "schedule",
  extra: Record<string, string>,
) {
  const params = new URLSearchParams({
    modulePanel: "open",
    section,
    ...extra,
  });
  return `/w/${encodeURIComponent(workspaceId)}/hospital-admin?${params.toString()}`;
}

function resolveOptionalText<TKey extends "email" | "phone">(
  key: TKey,
  value: unknown,
): Pick<StaffOperationalProfile, TKey> | Record<string, never> {
  if (typeof value !== "string" || !value.trim()) return {};
  return { [key]: value.trim() } as Pick<StaffOperationalProfile, TKey>;
}

function resolveOptionalTimestamp(
  value: unknown,
): Pick<StaffOperationalProfile, "lastSeenAt"> | Record<string, never> {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return {};
  return { lastSeenAt: value };
}

function resolveStatusMessage(
  row: Record<string, unknown> | undefined,
): Pick<
  StaffOperationalProfile,
  "statusMessage" | "statusMessageUpdatedAt"
> | Record<string, never> {
  if (!row) return {};
  const message = row.status_message;
  const updatedAt = row.updated_at;
  if (
    typeof message !== "string" ||
    !message ||
    message !== message.trim() ||
    Array.from(message).length > 60 ||
    typeof updatedAt !== "string" ||
    Number.isNaN(Date.parse(updatedAt))
  ) {
    throw new Error("invalid_status_message_row");
  }
  return { statusMessage: message, statusMessageUpdatedAt: updatedAt };
}

async function readRows(
  client: SupabaseStaffOperationalProfileClient,
  table: string,
  columns: string,
  filters: Record<string, string>,
) {
  let query = client.from(table).select(columns);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "db_read_failed");
  return data ?? [];
}

async function readOptionalRows(
  client: SupabaseStaffOperationalProfileClient,
  table: string,
  columns: string,
  filters: Record<string, string>,
) {
  try {
    return await readRows(client, table, columns, filters);
  } catch {
    return [];
  }
}

async function resolveAvatar(
  client: SupabaseStaffOperationalProfileClient,
  row: Record<string, unknown> | undefined,
): Promise<
  Pick<StaffOperationalProfile, "avatarUrl"> | Record<string, never>
> {
  const privatePath = row?.avatar_storage_path;
  if (typeof privatePath === "string" && privatePath.trim()) {
    try {
      const { data, error } = await client.storage
        .from(PRIVATE_PROFILE_AVATAR_BUCKET)
        .createSignedUrl(privatePath.trim(), 5 * 60);
      return !error && typeof data?.signedUrl === "string" && data.signedUrl
        ? { avatarUrl: data.signedUrl }
        : {};
    } catch {
      return {};
    }
  }
  if (row?.avatar_legacy_hidden === true) return {};

  const value = row?.avatar_url;
  if (typeof value !== "string" || !value.trim()) return {};
  const reference = value.trim();
  if (reference.startsWith("/") || reference.startsWith("http")) {
    return { avatarUrl: reference };
  }
  return {
    avatarUrl: client.storage
      .from(AVATAR_STORAGE_BUCKET)
      .getPublicUrl(reference).data.publicUrl,
  };
}

function resolveMembershipStatus(
  membershipStatus: unknown,
  userStatus: unknown,
): StaffOperationalProfile["membershipStatus"] {
  if (membershipStatus === "suspended" || userStatus === "suspended") {
    return "suspended";
  }
  if (membershipStatus !== "active" || userStatus !== "active") {
    return "inactive";
  }
  return "active";
}

function parseProfileSchedule(value: unknown): {
  scheduleProfileId?: string;
  shifts: StaffOperationalShift[];
} {
  const record = asRecord(value);
  const scheduleProfileId = record.scheduleProfileId;
  const shifts = asArray(record.shifts)
    .map(asRecord)
    .map((shift) =>
      parseShift({
        date: shift.date,
        startMinutes: shift.start_minutes,
        endMinutes: shift.end_minutes,
        kind: shift.kind,
        workLabel: shift.work_label,
        locationLabel: shift.location_label,
      }),
    )
    .filter((shift): shift is StaffOperationalShift => Boolean(shift));
  return {
    ...(typeof scheduleProfileId === "string" ? { scheduleProfileId } : {}),
    shifts,
  };
}

function readAvailabilityFromProfileSchedule(
  shifts: StaffOperationalShift[],
  date: string,
): StaffOperationalAvailability | null {
  const endDate = addDays(date, 13);
  const scheduled = shifts
    .filter((shift) => shift.date >= date && shift.date <= endDate)
    .sort(
      (first, second) =>
        first.date.localeCompare(second.date) || first.startMinutes - second.startMinutes,
    );
  const absence = scheduled.find(
    (shift) => shift.kind === "leave" || shift.kind === "off",
  );
  if (!absence || (absence.kind !== "leave" && absence.kind !== "off")) return null;

  const returnShift = scheduled.find(
    (shift) =>
      shift.date > absence.date &&
      shift.kind !== "leave" &&
      shift.kind !== "off",
  );
  return {
    event: { date: absence.date, kind: absence.kind },
    ...(returnShift ? { returnShift } : {}),
  };
}

function parseShift(value: Record<string, unknown> | undefined) {
  if (
    !value ||
    typeof value.date !== "string" ||
    typeof value.startMinutes !== "number" ||
    typeof value.endMinutes !== "number" ||
    typeof value.workLabel !== "string" ||
    !isShiftKind(value.kind)
  ) {
    return null;
  }
  return {
    date: value.date,
    startMinutes: value.startMinutes,
    endMinutes: value.endMinutes,
    kind: value.kind,
    workLabel: value.workLabel,
    locationLabel:
      typeof value.locationLabel === "string" ? value.locationLabel : null,
  } satisfies StaffOperationalShift;
}

function parseCurrentWork(value: unknown): StaffCurrentWorkInfo | null {
  const item = asRecord(value);
  if (
    typeof item.date !== "string" ||
    !isCurrentWorkState(item.state) ||
    !isCurrentWorkSource(item.source)
  ) {
    return null;
  }
  const startMinutes = parseNullableMinutes(item.startMinutes);
  const endMinutes = parseNullableMinutes(item.endMinutes);
  if (startMinutes === undefined || endMinutes === undefined) return null;

  return {
    date: item.date,
    state: item.state,
    startMinutes,
    endMinutes,
    detailLabel:
      typeof item.detailLabel === "string" && item.detailLabel.trim()
        ? item.detailLabel.trim()
        : null,
    source: item.source,
  };
}

function parseNullableMinutes(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 1440
    ? value
    : undefined;
}

function isCurrentWorkState(value: unknown): value is StaffCurrentWorkState {
  return (
    value === "working" ||
    value === "scheduled" ||
    value === "in_consultation" ||
    value === "clocked_out" ||
    value === "shift_ended" ||
    value === "leave" ||
    value === "same_day_leave" ||
    value === "off" ||
    value === "hospital_closed"
  );
}

function isCurrentWorkSource(value: unknown): value is StaffCurrentWorkInfo["source"] {
  return (
    value === "schedule" ||
    value === "time_clock" ||
    value === "encounter" ||
    value === "operating_hours"
  );
}

function isShiftKind(value: unknown): value is StaffOperationalShift["kind"] {
  return (
    value === "clinical" ||
    value === "support" ||
    value === "reception" ||
    value === "leave" ||
    value === "off"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getWeekStart(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - weekday);
  return parsed.toISOString().slice(0, 10);
}
