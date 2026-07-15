import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { AVATAR_STORAGE_BUCKET } from "@/features/staff/staff-avatar";

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

export type StaffOperationalAvailability = {
  event: Pick<StaffOperationalShift, "date" | "kind">;
  returnShift?: StaffOperationalShift;
};

export type StaffOperationalProfileCapabilities = {
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
    functionName: "hospital_schedule_read_snapshot",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  storage: {
    from(bucket: string): {
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

        const [profiles, activities, assignments] = await Promise.all([
          readRows(client, "user_profiles", "user_id, avatar_url", {
            user_id: userId,
          }),
          readOptionalRows(
            client,
            "workspace_member_activity",
            "workspace_id, user_id, last_seen_at",
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
          ...(typeof membership.department === "string"
            ? { department: membership.department }
            : {}),
          ...(typeof membership.title === "string"
            ? { title: membership.title }
            : {}),
          ...(typeof positions[0]?.label === "string"
            ? { jobPositionLabel: positions[0].label }
            : {}),
          ...resolveAvatar(client, profiles[0]?.avatar_url),
        };

        const weekStarts = getAvailabilityWeekStarts(date);
        const scheduleReads = await Promise.all(
          weekStarts.map(async (weekStart) => ({
            weekStart,
            ...(await client.rpc("hospital_schedule_read_snapshot", {
              p_week_start: weekStart,
              p_workspace_id: workspaceId,
            })),
          })),
        );
        const readableSnapshots = scheduleReads
          .filter((read) => !read.error)
          .map((read) => read.data);
        const publishedSnapshots = readableSnapshots.filter(isPublishedSnapshot);
        const todayWeekStart = getWeekStart(date);
        const todayRead = scheduleReads.find(
          (read) => read.weekStart === todayWeekStart,
        );
        const scheduleProfileId = findScheduleProfileId(
          readableSnapshots,
          String(membership.id),
        );
        const availabilityError = scheduleReads.some((read) => read.error);
        const shiftError = Boolean(todayRead?.error);

        return {
          ok: true,
          availability: availabilityError
            ? null
            : readAvailability(
                publishedSnapshots,
                scheduleProfileId,
                date,
              ),
          ...(availabilityError
            ? { availabilityError: "schedule_read_failed" as const }
            : {}),
          profile,
          ...(scheduleProfileId ? { scheduleProfileId } : {}),
          shift: shiftError
            ? null
            : readShift(publishedSnapshots, scheduleProfileId, date),
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

function resolveAvatar(
  client: SupabaseStaffOperationalProfileClient,
  value: unknown,
): Pick<StaffOperationalProfile, "avatarUrl"> | Record<string, never> {
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

function getAvailabilityWeekStarts(date: string) {
  const endWeekStart = getWeekStart(addDays(date, 13));
  const weekStarts: string[] = [];
  for (
    let weekStart = getWeekStart(date);
    weekStart <= endWeekStart;
    weekStart = addDays(weekStart, 7)
  ) {
    weekStarts.push(weekStart);
  }
  return weekStarts;
}

function findScheduleProfileId(
  snapshots: unknown[],
  membershipId: string,
) {
  for (const value of snapshots) {
    const staffProfileId = asArray(asRecord(value).staff)
      .map(asRecord)
      .find((staff) => staff.membershipId === membershipId)?.id;
    if (typeof staffProfileId === "string") return staffProfileId;
  }
  return undefined;
}

function readShift(
  snapshots: unknown[],
  scheduleProfileId: string | undefined,
  date: string,
): StaffOperationalShift | null {
  if (!scheduleProfileId) return null;
  const source = snapshots
    .flatMap((snapshot) => asArray(asRecord(snapshot).shifts))
    .map(asRecord)
    .filter(
      (item) =>
        item.staffProfileId === scheduleProfileId && item.date === date,
    )
    .sort((a, b) => Number(a.startMinutes) - Number(b.startMinutes))[0];
  return parseShift(source);
}

function readAvailability(
  snapshots: unknown[],
  scheduleProfileId: string | undefined,
  date: string,
): StaffOperationalAvailability | null {
  if (!scheduleProfileId) return null;
  const endDate = addDays(date, 13);
  const shifts = snapshots
    .flatMap((snapshot) => asArray(asRecord(snapshot).shifts))
    .map(asRecord)
    .filter(
      (item) =>
        item.staffProfileId === scheduleProfileId &&
        typeof item.date === "string" &&
        item.date >= date &&
        item.date <= endDate,
    )
    .sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        Number(a.startMinutes) - Number(b.startMinutes),
    );
  const absence = shifts.find(
    (shift) => shift.kind === "leave" || shift.kind === "off",
  );
  if (
    !absence ||
    typeof absence.date !== "string" ||
    (absence.kind !== "leave" && absence.kind !== "off")
  ) {
    return null;
  }
  const absenceDate = absence.date;
  const returnShift = shifts
    .filter(
      (shift) =>
        typeof shift.date === "string" &&
        shift.date > absenceDate &&
        shift.kind !== "leave" &&
        shift.kind !== "off",
    )
    .map(parseShift)
    .find((shift): shift is StaffOperationalShift => Boolean(shift));

  return {
    event: { date: absenceDate, kind: absence.kind },
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

function isPublishedSnapshot(value: unknown) {
  const state = asRecord(asRecord(value).week).publicationState;
  return state === "published" || state === "changed";
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
