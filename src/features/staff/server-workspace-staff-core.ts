import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
  type WorkspaceRoleId,
} from "@/features/auth/permission-resolver";
import { mockStaffUsers } from "@/mocks/emr-domain";
import { AVATAR_STORAGE_BUCKET } from "@/features/staff/staff-avatar";
import { PRIVATE_PROFILE_AVATAR_BUCKET } from "@/features/staff/server-profile-avatar-core";
import { isIsoOperatingDate } from "@/lib/emr-domain/demo-date";

export type WorkspaceStaffOperationalStatusCode =
  | "available"
  | "clocked_out"
  | "leave"
  | "off"
  | "scheduled"
  | "shift_ended"
  | "unknown";

export type WorkspaceStaffOperationalStatus = {
  code: WorkspaceStaffOperationalStatusCode;
  label: string;
  source: "schedule" | "time_clock";
};

export type WorkspaceStaffMember = {
  avatarUrl?: string;
  department?: string;
  displayName: string;
  id: string;
  initial?: string;
  operationalStatus?: WorkspaceStaffOperationalStatus;
  roles: WorkspaceRoleId[];
  status: "active" | "inactive" | "suspended" | "invited";
  title?: string;
};

export type WorkspaceStaffReadGateway = {
  listWorkspaceStaff(input: {
    operatingDate?: string;
    role?: WorkspaceRoleId;
    workspaceId: string;
  }): Promise<
    | {
        ok: true;
        staff: WorkspaceStaffMember[];
        sectionErrors?: { operationalStatus: "db_read_failed" };
      }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type WorkspaceStaffReadResult =
  | {
      ok: true;
      status: 200;
      staff: WorkspaceStaffMember[];
      sectionErrors?: { operationalStatus: "db_read_failed" };
      enforcedBy: "workspace-staff-read";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_operating_date" | "invalid_role";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

type SupabaseStaffMembershipRow = {
  department?: string | null;
  id: string;
  roles: string[] | null;
  status: string;
  title?: string | null;
  user_id: string;
  workspace_id: string;
};

type SupabaseStaffUserRow = {
  display_name?: string | null;
  id: string;
  initial?: string | null;
  status: string;
};

type SupabaseStaffProfileRow = {
  avatar_legacy_hidden?: boolean;
  avatar_storage_path?: string | null;
  avatar_url?: string | null;
  user_id: string;
};

type SupabaseStaffOperationalStatusRow = {
  source: string;
  statusCode: string;
  userId: string;
};

type SupabaseStaffStorage = {
  from(bucket: string): {
    createSignedUrl(path: string, expiresIn: number): Promise<{
      data: { signedUrl?: string } | null;
      error: { message?: string } | null;
    }>;
    getPublicUrl(path: string): { data: { publicUrl: string } };
  };
};

type SupabaseStaffQueryBuilder<Row> = PromiseLike<{
  data: Row[] | null;
  error: { message?: string } | null;
}> & {
  eq(column: string, value: string): SupabaseStaffQueryBuilder<Row>;
  in(column: string, values: string[]): SupabaseStaffQueryBuilder<Row>;
  select(columns: string): SupabaseStaffQueryBuilder<Row>;
};

export type SupabaseWorkspaceStaffClient = {
  from(table: "user_memberships"): SupabaseStaffQueryBuilder<SupabaseStaffMembershipRow>;
  from(table: "users"): SupabaseStaffQueryBuilder<SupabaseStaffUserRow>;
  from(table: "user_profiles"): SupabaseStaffQueryBuilder<SupabaseStaffProfileRow>;
  rpc(
    functionName: "reception_staff_operational_status_snapshot",
    params: { p_day: string; p_workspace_id: string },
  ): PromiseLike<{
    data: SupabaseStaffOperationalStatusRow[] | null;
    error: { message?: string } | null;
  }>;
  storage: SupabaseStaffStorage;
};

export async function readWorkspaceStaff({
  actorUserId,
  gateway = createMockWorkspaceStaffReadGateway(),
  operatingDate,
  permissionAdapter = createDemoWorkspaceStaffPermissionAdapter(),
  role,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: WorkspaceStaffReadGateway;
  operatingDate?: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  role?: string;
  workspaceId: string;
}): Promise<WorkspaceStaffReadResult> {
  const normalizedRole = role ? normalizeWorkspaceRole(role) : undefined;
  if (role && !normalizedRole) return { ok: false, status: 400, error: "invalid_role" };
  if (operatingDate && !isIsoOperatingDate(operatingDate)) {
    return { ok: false, status: 400, error: "invalid_operating_date" };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "reception:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.listWorkspaceStaff({
    operatingDate,
    role: normalizedRole,
    workspaceId,
  });

  if (!result.ok) return { ok: false, status: 500, error: result.error };

  return {
    ok: true,
    status: 200,
    staff: result.staff,
    ...(result.sectionErrors ? { sectionErrors: result.sectionErrors } : {}),
    enforcedBy: "workspace-staff-read",
  };
}

export function createSupabaseWorkspaceStaffReadGateway(
  client: SupabaseWorkspaceStaffClient,
): WorkspaceStaffReadGateway {
  return {
    async listWorkspaceStaff({ operatingDate, role, workspaceId }) {
      try {
        const { data: membershipRows, error: membershipError } = await client
          .from("user_memberships")
          .select("id, workspace_id, user_id, roles, department, title, status")
          .eq("workspace_id", workspaceId)
          .eq("status", "active");
        if (membershipError) return { ok: false, error: "db_read_failed" };

        const memberships = (membershipRows ?? []).filter((row) => {
          const roles = normalizeRoles(row.roles);
          return !role || roles.includes(role);
        });
        const userIds = Array.from(new Set(memberships.map((row) => row.user_id)));
        if (userIds.length === 0) return { ok: true, staff: [] };

        const { data: userRows, error: userError } = await client
          .from("users")
          .select("id, display_name, initial, status")
          .in("id", userIds);
        if (userError) return { ok: false, error: "db_read_failed" };

        const { data: profileRows, error: profileError } = await client
          .from("user_profiles")
          .select(
            "user_id, avatar_url, avatar_storage_path, avatar_legacy_hidden",
          )
          .in("user_id", userIds);
        if (profileError) return { ok: false, error: "db_read_failed" };

        const userById = new Map((userRows ?? []).map((row) => [row.id, row]));
        const avatarUrlByUserId = new Map(
          await Promise.all(
            (profileRows ?? []).map(async (row) => [
              row.user_id,
              await resolveStaffAvatarUrl(client, row),
            ] as const),
          ),
        );
        let operationalStatusByUserId = new Map<
          string,
          WorkspaceStaffOperationalStatus
        >();
        let sectionErrors:
          | { operationalStatus: "db_read_failed" }
          | undefined;

        if (operatingDate) {
          const { data: statusRows, error: statusError } = await client.rpc(
            "reception_staff_operational_status_snapshot",
            {
              p_day: operatingDate,
              p_workspace_id: workspaceId,
            },
          );

          if (statusError) {
            sectionErrors = { operationalStatus: "db_read_failed" };
          } else {
            operationalStatusByUserId = new Map(
              (statusRows ?? []).flatMap((row) => {
                const status = normalizeOperationalStatus(row);
                return status ? [[row.userId, status] as const] : [];
              }),
            );
          }
        }
        const staff = memberships
          .reduce<WorkspaceStaffMember[]>((accumulator, membership) => {
            const user = userById.get(membership.user_id);
            if (!user || user.status !== "active") return accumulator;
            const roles = normalizeRoles(membership.roles);
            const avatarUrl = avatarUrlByUserId.get(user.id);

            accumulator.push({
              department: membership.department ?? undefined,
              displayName: user.display_name ?? "이름 없음",
              id: user.id,
              initial: user.initial ?? undefined,
              operationalStatus: operationalStatusByUserId.get(user.id),
              ...(avatarUrl ? { avatarUrl } : {}),
              roles,
              status: "active" as const,
              title: membership.title ?? undefined,
            });
            return accumulator;
          }, [])
          .sort((a, b) => a.id.localeCompare(b.id));

        return {
          ok: true,
          staff,
          ...(sectionErrors ? { sectionErrors } : {}),
        };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
  };
}

export function createMockWorkspaceStaffReadGateway(): WorkspaceStaffReadGateway {
  return {
    async listWorkspaceStaff({ role }) {
      const staff = mockStaffUsers
        .map((user): WorkspaceStaffMember | null => {
          const roles = user.role === "veterinarian" ? ["vet" as const] : [];
          if (roles.length === 0) return null;

          return {
            displayName: user.name,
            id: user.id,
            initial: user.initial,
            avatarUrl: user.avatarUrl ?? undefined,
            roles,
            status: "active",
            title: "수의사",
          };
        })
        .filter((member): member is WorkspaceStaffMember => Boolean(member))
        .filter((member) => !role || member.roles.includes(role));

      return { ok: true, staff };
    },
  };
}

async function resolveStaffAvatarUrl(
  client: SupabaseWorkspaceStaffClient,
  profile: SupabaseStaffProfileRow,
): Promise<string | undefined> {
  const privatePath = profile.avatar_storage_path?.trim();
  if (privatePath) {
    try {
      const { data, error } = await client.storage
        .from(PRIVATE_PROFILE_AVATAR_BUCKET)
        .createSignedUrl(privatePath, 5 * 60);
      return !error && typeof data?.signedUrl === "string" && data.signedUrl
        ? data.signedUrl
        : undefined;
    } catch {
      return undefined;
    }
  }
  if (profile.avatar_legacy_hidden === true) return undefined;

  const avatarReference = profile.avatar_url;
  const reference = avatarReference?.trim();
  if (!reference) return undefined;
  if (reference.startsWith("/") || reference.startsWith("http")) {
    return reference;
  }

  return client.storage.from(AVATAR_STORAGE_BUCKET).getPublicUrl(reference).data.publicUrl;
}

export function createDemoWorkspaceStaffPermissionAdapter() {
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

function normalizeWorkspaceRole(role: string): WorkspaceRoleId | undefined {
  if (
    role === "hospital_admin" ||
    role === "vet" ||
    role === "technician" ||
    role === "front_desk"
  ) {
    return role;
  }

  return undefined;
}

function normalizeRoles(roles: string[] | null): WorkspaceRoleId[] {
  return (roles ?? []).filter((role): role is WorkspaceRoleId =>
    Boolean(normalizeWorkspaceRole(role)),
  );
}

const operationalStatusLabels: Record<
  WorkspaceStaffOperationalStatusCode,
  string
> = {
  available: "진료가능",
  clocked_out: "퇴근",
  leave: "휴가중",
  off: "휴무",
  scheduled: "근무 예정",
  shift_ended: "근무 종료",
  unknown: "",
};

function normalizeOperationalStatus(
  row: SupabaseStaffOperationalStatusRow,
): WorkspaceStaffOperationalStatus | undefined {
  if (!isWorkspaceStaffOperationalStatusCode(row.statusCode)) return undefined;
  if (row.statusCode === "unknown") return undefined;
  if (row.source !== "schedule" && row.source !== "time_clock") return undefined;

  return {
    code: row.statusCode,
    label: operationalStatusLabels[row.statusCode],
    source: row.source,
  };
}

function isWorkspaceStaffOperationalStatusCode(
  value: string,
): value is WorkspaceStaffOperationalStatusCode {
  return value in operationalStatusLabels;
}
