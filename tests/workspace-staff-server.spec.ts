import { expect, test } from "@playwright/test";

import {
  loadWorkspacePermissionAdapterFromDb,
  type WorkspacePermissionDbGateway,
} from "../src/features/auth/db-workspace-permission-adapter-core";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseWorkspaceStaffReadGateway,
  readWorkspaceStaff,
} from "../src/features/staff/server-workspace-staff-core";

type SupabaseStaffClient = Parameters<
  typeof createSupabaseWorkspaceStaffReadGateway
>[0];

test("workspace staff read filters active same-workspace veterinarians", async () => {
  const gateway = createSupabaseWorkspaceStaffReadGateway({
    from(tableName: string) {
      if (tableName === "user_memberships") {
        return createSupabaseRows([
          {
            id: "membership-vet-suji",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000003",
            roles: ["vet"],
            department: "Medical",
            title: "수의사",
            status: "active",
          },
          {
            id: "membership-front-desk",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000005",
            roles: ["front_desk"],
            department: "Reception",
            title: "데스크",
            status: "active",
          },
          {
            id: "membership-vet-inactive",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000006",
            roles: ["vet"],
            department: "Medical",
            title: "수의사",
            status: "inactive",
          },
        ]);
      }

      return createSupabaseRows([
        {
          id: "49110000-0000-4000-8000-000000000003",
          display_name: "청담 수의사",
          initial: "수",
          status: "active",
        },
        {
          id: "49110000-0000-4000-8000-000000000005",
          display_name: "청담 데스크",
          initial: "데",
          status: "active",
        },
        {
          id: "49110000-0000-4000-8000-000000000006",
          display_name: "김도윤",
          initial: "김",
          status: "active",
        },
      ]);
    },
  } as unknown as SupabaseStaffClient);

  const result = await readWorkspaceStaff({
    actorUserId: "user-front-desk",
    workspaceId: "workspace-clair-cheongdam",
    role: "vet",
    gateway,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-reader",
          workspaceId: "workspace-clair-cheongdam",
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    staff: [
      {
        id: "49110000-0000-4000-8000-000000000003",
        displayName: "청담 수의사",
        roles: ["vet"],
        status: "active",
      },
    ],
    enforcedBy: "workspace-staff-read",
  });
});

test("workspace staff read merges the selected-date operational status snapshot", async () => {
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const gateway = createSupabaseWorkspaceStaffReadGateway({
    from(tableName: string) {
      if (tableName === "user_memberships") {
        return createSupabaseRows([
          {
            id: "membership-vet-suji",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000003",
            roles: ["vet"],
            department: "Medical",
            title: "수의사",
            status: "active",
          },
        ]);
      }

      if (tableName === "user_profiles") return createSupabaseRows([]);

      return createSupabaseRows([
        {
          id: "49110000-0000-4000-8000-000000000003",
          display_name: "이수지",
          initial: "이",
          status: "active",
        },
      ]);
    },
    async rpc(name: string, params: Record<string, unknown>) {
      rpcCalls.push({ name, params });
      return {
        data: [
          {
            userId: "49110000-0000-4000-8000-000000000003",
            statusCode: "clocked_out",
            source: "time_clock",
          },
        ],
        error: null,
      };
    },
  } as unknown as SupabaseStaffClient);

  const result = await gateway.listWorkspaceStaff({
    operatingDate: "2026-07-14",
    role: "vet",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(rpcCalls).toEqual([
    {
      name: "reception_staff_operational_status_snapshot",
      params: {
        p_day: "2026-07-14",
        p_workspace_id: "workspace-clair-cheongdam",
      },
    },
  ]);
  expect(result).toMatchObject({
    ok: true,
    staff: [
      {
        displayName: "이수지",
        operationalStatus: {
          code: "clocked_out",
          label: "퇴근",
          source: "time_clock",
        },
      },
    ],
  });
});

test("workspace staff read signs private avatar pointers and respects removed legacy avatars", async () => {
  const privatePath =
    "49110000-0000-4000-8000-000000000003/avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";
  const gateway = createSupabaseWorkspaceStaffReadGateway({
    from(tableName: string) {
      if (tableName === "user_memberships") {
        return createSupabaseRows([
          {
            id: "membership-vet-suji",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000003",
            roles: ["vet"],
            status: "active",
          },
          {
            id: "membership-vet-removed",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000004",
            roles: ["vet"],
            status: "active",
          },
        ]);
      }
      if (tableName === "user_profiles") {
        return createSupabaseRows([
          {
            user_id: "49110000-0000-4000-8000-000000000003",
            avatar_url: "legacy-suji.png",
            avatar_storage_path: privatePath,
            avatar_legacy_hidden: true,
          },
          {
            user_id: "49110000-0000-4000-8000-000000000004",
            avatar_url: "legacy-removed.png",
            avatar_storage_path: null,
            avatar_legacy_hidden: true,
          },
        ]);
      }
      return createSupabaseRows([
        {
          id: "49110000-0000-4000-8000-000000000003",
          display_name: "이수지",
          status: "active",
        },
        {
          id: "49110000-0000-4000-8000-000000000004",
          display_name: "삭제 사용자",
          status: "active",
        },
      ]);
    },
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(path: string) {
            return {
              data: { signedUrl: `https://storage.local/${bucket}/signed/${path}` },
              error: null,
            };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `https://storage.local/${bucket}/${path}` } };
          },
        };
      },
    },
  } as unknown as SupabaseStaffClient);

  const result = await gateway.listWorkspaceStaff({
    role: "vet",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    ok: true,
    staff: [
      {
        id: "49110000-0000-4000-8000-000000000003",
        avatarUrl: `https://storage.local/profile-avatars/signed/${privatePath}`,
      },
      { id: "49110000-0000-4000-8000-000000000004" },
    ],
  });
  if (result.ok) expect(result.staff[1]).not.toHaveProperty("avatarUrl");
});

test("workspace staff read preserves staff when the status snapshot fails", async () => {
  const gateway = createSupabaseWorkspaceStaffReadGateway({
    from(tableName: string) {
      if (tableName === "user_memberships") {
        return createSupabaseRows([
          {
            id: "membership-vet-suji",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000003",
            roles: ["vet"],
            status: "active",
          },
        ]);
      }

      if (tableName === "user_profiles") return createSupabaseRows([]);

      return createSupabaseRows([
        {
          id: "49110000-0000-4000-8000-000000000003",
          display_name: "이수지",
          status: "active",
        },
      ]);
    },
    async rpc() {
      return { data: null, error: { message: "rpc unavailable" } };
    },
  } as unknown as SupabaseStaffClient);

  const result = await gateway.listWorkspaceStaff({
    operatingDate: "2026-07-14",
    role: "vet",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    ok: true,
    sectionErrors: { operationalStatus: "db_read_failed" },
    staff: [{ displayName: "이수지" }],
  });
});

test("workspace staff read rejects an invalid operating date", async () => {
  const result = await readWorkspaceStaff({
    actorUserId: "user-front-desk",
    operatingDate: "2026-02-30",
    role: "vet",
    workspaceId: "clair-demo",
  });

  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "invalid_operating_date",
  });
});

test("workspace staff read enforces reception view permission", async () => {
  const unauthenticated = await readWorkspaceStaff({
    actorUserId: null,
    workspaceId: "workspace-clair-cheongdam",
    role: "vet",
    permissionAdapter: createMockWorkspacePermissionAdapter(),
  });

  expect(unauthenticated).toMatchObject({
    ok: false,
    status: 401,
    denialReason: "unauthenticated",
  });

  const result = await readWorkspaceStaff({
    actorUserId: "user-missing",
    workspaceId: "workspace-clair-cheongdam",
    role: "vet",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-missing", status: "active" }],
      memberships: [],
    }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });

  const missingPermission = await readWorkspaceStaff({
    actorUserId: "user-without-view",
    workspaceId: "workspace-clair-cheongdam",
    role: "vet",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-without-view", status: "active" }],
      memberships: [
        {
          id: "membership-without-view",
          workspaceId: "workspace-clair-cheongdam",
          userId: "user-without-view",
          roles: ["vet"],
          status: "active",
        },
      ],
      permissionPolicies: [
        {
          workspaceId: "workspace-clair-cheongdam",
          role: "vet",
          permissionIds: ["chart:view"],
        },
      ],
    }),
  });

  expect(missingPermission).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("workspace staff read authorizes through legacy DB roles when additive assignments are absent", async () => {
  const calls: string[] = [];
  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    now: "2026-07-02T00:00:00.000Z",
    workspaceId: "workspace-clair-cheongdam",
    sessionUserId: "user-front-desk",
    gateway: createLegacyReceptionViewPermissionGateway(calls),
  });

  const result = await readWorkspaceStaff({
    actorUserId: "user-front-desk",
    workspaceId: "workspace-clair-cheongdam",
    role: "vet",
    permissionAdapter,
  });

  expect(calls).toEqual([
    "memberships:workspace-clair-cheongdam:user-front-desk",
    "users:user-front-desk",
    "policies:workspace-clair-cheongdam",
    "permissionRoles:workspace-clair-cheongdam:membership-front-desk",
    "jobPositions:workspace-clair-cheongdam:membership-front-desk",
  ]);
  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "workspace-staff-read",
  });
});

function createSupabaseRows<Row>(rows: Row[]) {
  let filteredRows = rows;
  const query = {
    eq(column: string, value: string) {
      filteredRows = filteredRows.filter(
        (row) => (row as Record<string, unknown>)[column] === value,
      );
      return query;
    },
    in(column: string, values: string[]) {
      filteredRows = filteredRows.filter((row) =>
        values.includes((row as Record<string, string>)[column]),
      );
      return query;
    },
    select() {
      return query;
    },
    then(onfulfilled: (value: { data: Row[]; error: null }) => unknown) {
      return Promise.resolve({ data: filteredRows, error: null }).then(
        onfulfilled,
      );
    },
  };

  return query;
}

function createLegacyReceptionViewPermissionGateway(calls: string[]): WorkspacePermissionDbGateway {
  return {
    async listMemberships(workspaceId, userId) {
      calls.push(`memberships:${workspaceId}:${userId}`);
      return [
        {
          id: "membership-front-desk", workspace_id: workspaceId, user_id: userId,
          roles: ["front_desk"], status: "active",
        },
      ];
    },
    async listUsers(userIds) {
      calls.push(`users:${userIds.join(",")}`);
      return userIds.map((id) => ({ id, status: "active", display_name: "Front Desk" }));
    },
    async listPermissionPolicies(workspaceId) {
      calls.push(`policies:${workspaceId}`);
      return [
        {
          workspace_id: workspaceId, scope: "role", target_role: "front_desk",
          permissions: { allowed: ["reception:view"] },
        },
      ];
    },
    async listPermissionRoleAssignments(workspaceId, membershipIds) {
      calls.push(`permissionRoles:${workspaceId}:${membershipIds.join(",")}`);
      return [];
    },
    async listJobPositionAssignments(workspaceId, membershipIds) {
      calls.push(`jobPositions:${workspaceId}:${membershipIds.join(",")}`);
      return [];
    },
  };
}
