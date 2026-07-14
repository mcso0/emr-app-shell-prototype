import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockStaffUsers } from "@/mocks/emr-domain";
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

export type StaffOperationalProfileGateway = {
  readProfile(input: {
    date: string;
    userId: string;
    workspaceId: string;
  }): Promise<
    | {
        ok: true;
        profile: StaffOperationalProfile;
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
      profile: StaffOperationalProfile;
      shift: StaffOperationalShift | null;
      sectionErrors?: { shift: "schedule_read_failed" };
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
  gateway = createMockStaffOperationalProfileGateway(),
  permissionAdapter = createDemoStaffOperationalProfilePermissionAdapter(),
  userId,
  workspaceId,
}: {
  actorUserId: string | null;
  date: string;
  gateway?: StaffOperationalProfileGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
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
    if (result.error === "not_found") {
      return { ok: false, status: 404, error: "not_found" };
    }
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    profile: result.profile,
    shift: result.shift,
    ...(result.shiftError
      ? { sectionErrors: { shift: result.shiftError } }
      : {}),
    enforcedBy: "staff-operational-profile-read",
  };
}

export function createMockStaffOperationalProfileGateway(): StaffOperationalProfileGateway {
  return {
    async readProfile({ userId, workspaceId }) {
      const staff = mockStaffUsers.find(
        (item) => item.id === userId && item.workspaceId === workspaceId,
      );
      if (!staff) return { ok: false, error: "not_found" };

      const jobPositionLabel = getMockJobPositionLabel(staff.role);
      return {
        ok: true,
        profile: {
          avatarUrl: staff.avatarUrl ?? undefined,
          department: staff.department,
          displayName: staff.name,
          initials: staff.initial,
          jobPositionLabel,
          membershipStatus: "active",
        },
        shift: null,
      };
    },
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

        const profiles = await readRows(
          client,
          "user_profiles",
          "user_id, avatar_url",
          { user_id: userId },
        );
        // Keep the profile readable while the additive activity migration is
        // rolling out. Presence remains authoritative for the live state; a
        // missing activity snapshot only removes the last-seen enhancement.
        const activities = await readOptionalRows(
          client,
          "workspace_member_activity",
          "workspace_id, user_id, last_seen_at",
          { workspace_id: workspaceId, user_id: userId },
        );
        const assignments = await readRows(
          client,
          "workspace_membership_job_position_assignments",
          "workspace_id, membership_id, job_position_id",
          {
            workspace_id: workspaceId,
            membership_id: String(membership.id),
          },
        );
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

        const { data: scheduleData, error: scheduleError } = await client.rpc(
          "hospital_schedule_read_snapshot",
          {
            p_workspace_id: workspaceId,
            p_week_start: getWeekStart(date),
          },
        );
        if (scheduleError) {
          return {
            ok: true,
            profile,
            shift: null,
            shiftError: "schedule_read_failed",
          };
        }

        return {
          ok: true,
          profile,
          shift: readShift(scheduleData, String(membership.id), date),
        };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
  };
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

function readShift(
  value: unknown,
  membershipId: string,
  date: string,
): StaffOperationalShift | null {
  const snapshot = asRecord(value);
  const staffProfileId = asArray(snapshot.staff)
    .map(asRecord)
    .find((staff) => staff.membershipId === membershipId)?.id;
  if (typeof staffProfileId !== "string") return null;

  const shift = asArray(snapshot.shifts)
    .map(asRecord)
    .filter(
      (item) => item.staffProfileId === staffProfileId && item.date === date,
    )
    .sort((a, b) => Number(a.startMinutes) - Number(b.startMinutes))[0];
  if (
    !shift ||
    typeof shift.startMinutes !== "number" ||
    typeof shift.endMinutes !== "number" ||
    typeof shift.workLabel !== "string" ||
    !isShiftKind(shift.kind)
  ) {
    return null;
  }

  return {
    date,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    kind: shift.kind,
    workLabel: shift.workLabel,
    locationLabel:
      typeof shift.locationLabel === "string" ? shift.locationLabel : null,
  };
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

function getWeekStart(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - weekday);
  return parsed.toISOString().slice(0, 10);
}

function createDemoStaffOperationalProfilePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

function getMockJobPositionLabel(role: string) {
  if (role === "veterinarian") return "수의사";
  if (role === "technician") return "테크니션";
  if (role === "desk") return "데스크";
  if (role === "billing") return "수납";
  return "운영 관리자";
}
