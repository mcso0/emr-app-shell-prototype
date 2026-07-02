import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import {
  loadWorkspacePermissionAdapterFromDb,
} from "../src/features/auth/db-workspace-permission-adapter-core";
import type { WorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { resolveWorkspacePermission } from "../src/features/auth/permission-resolver";
import type { ServerSessionReaderResult } from "../src/features/auth/server-session-contract";
import type {
  WorkspaceMembershipStatusGateway,
  WorkspaceMembershipStatusResult,
} from "../src/features/auth/server-workspace-membership-status";
import {
  handleMembershipStatusGet,
  type MembershipRouteDependencies,
} from "../src/app/api/workspaces/[workspaceId]/memberships/route";

async function getMembershipStatus(
  request: APIRequestContext,
  options: { actor?: string; workspaceId?: string } = {}
) {
  return request.get(`/api/workspaces/${options.workspaceId ?? "workspace-a"}/memberships`, {
    headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
  });
}

test("workspace membership status route requires admin read permission", async ({
  request,
}) => {
  const unauthenticated = await getMembershipStatus(request);
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const denied = await getMembershipStatus(request, { actor: "user-vet" });
  expect(denied.status()).toBe(403);
  await expectJson(denied, { ok: false, denialReason: "permission_missing" });

  const admin = await getMembershipStatus(request, { actor: "user-admin" });
  expect(admin.status()).toBe(200);
  await expectJson(admin, {
    ok: true,
    memberships: [],
    invitations: [],
    enforcedBy: "workspace-membership-status-reader",
  });
});

test("workspace membership status route stays server-owned", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/route.ts",
    "utf8"
  );
  const readerSource = readFileSync(
    "src/features/auth/server-workspace-membership-status.ts",
    "utf8"
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260518124000_workspace_member_status_reader.sql",
    "utf8"
  );

  expect(routeSource).toContain("readWorkspaceMembershipStatus");
  expect(routeSource).toContain("readServerSession");
  expect(readerSource).toContain('import "server-only"');
  expect(readerSource).not.toMatch(/sessionStorage|localStorage|window\\./);
  expect(migrationSource).toContain("clair_list_workspace_member_statuses");
  expect(migrationSource).toContain("role_permission:view");
  expect(migrationSource).not.toMatch(/service_role|supabase_secret|db_password/i);
});

test("workspace membership status route denies Supabase session without manage permission", async () => {
  const { calls, deps } = createSupabaseRouteHarness({ permissionMode: "denied" });

  const response = await handleMembershipStatusGet(
    new Request("http://test.local/api/workspaces/workspace-live/memberships"),
    { workspaceId: "workspace-live" },
    deps
  );

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({ ok: false, denialReason: "permission_missing" })
  );
  expect(calls.permissionGatewayClients).toEqual(["db-client"]);
  expect(calls.permissionReads).toEqual([
    "memberships:workspace-live:user-live",
    "users:user-live",
    "policies:workspace-live",
    "permissionRoles:workspace-live:membership-live",
    "jobPositions:workspace-live:membership-live",
  ]);
  expect(calls.statusGatewayClients).toEqual(["db-client:workspace-live"]);
  expect(calls.statusReads).toEqual([]);
});

test("workspace membership status route fails closed when DB permission load fails", async () => {
  const { calls, deps } = createSupabaseRouteHarness({ permissionMode: "fail" });

  const response = await handleMembershipStatusGet(
    new Request("http://test.local/api/workspaces/workspace-live/memberships"),
    { workspaceId: "workspace-live" },
    deps
  );

  expect(response.status).toBe(500);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({ ok: false, error: "db_read_failed" })
  );
  expect(calls.permissionGatewayClients).toEqual(["db-client"]);
  expect(calls.permissionReads).toEqual(["memberships:workspace-live:user-live"]);
  expect(calls.statusGatewayClients).toEqual([]);
  expect(calls.statusReads).toEqual([]);
});

test("workspace membership status route returns persisted rows for authorized Supabase session", async () => {
  const { calls, deps } = createSupabaseRouteHarness({ permissionMode: "authorized" });

  const response = await handleMembershipStatusGet(
    new Request("http://test.local/api/workspaces/workspace-live/memberships"),
    { workspaceId: "workspace-live" },
    deps
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({
      ok: true,
      memberships: [
        expect.objectContaining({
          id: "membership-persisted",
          workspaceId: "workspace-live",
          userSessionId: "user-persisted",
          displayName: "Persisted Member",
        }),
      ],
      invitations: [],
      enforcedBy: "workspace-membership-status-reader",
    })
  );
  expect(calls.permissionGatewayClients).toEqual(["db-client"]);
  expect(calls.permissionReads).toEqual([
    "memberships:workspace-live:user-live",
    "users:user-live",
    "policies:workspace-live",
    "permissionRoles:workspace-live:membership-live",
    "jobPositions:workspace-live:membership-live",
  ]);
  expect(calls.statusGatewayClients).toEqual(["db-client:workspace-live"]);
  expect(calls.statusReads).toEqual(["workspace-live"]);
});

test("workspace membership status reader keeps manage permission as the server contract", () => {
  const readerSource = readFileSync(
    "src/features/auth/server-workspace-membership-status.ts",
    "utf8"
  );

  expect(readerSource).toContain('requiredPermission: "role_permission:manage"');
});

test("workspace membership UI can render persisted status rows from server", async ({
  page,
}) => {
  await page.route("**/api/workspaces/clair-demo/memberships", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        memberships: [
          {
            id: "membership-admin",
            workspaceId: "clair-demo",
            userSessionId: "user-admin",
            displayName: "송민재",
            email: "admin@clair.local",
            roles: ["hospital_admin"],
            status: "active",
            title: "병원장",
            department: "운영",
            createdAt: "2026-05-18T00:00:00.000Z",
            activatedAt: "2026-05-18T00:00:00.000Z",
            deactivatedAt: null,
          },
          {
            id: "membership-vet",
            workspaceId: "clair-demo",
            userSessionId: "user-vet",
            displayName: "이수지",
            email: "vet@clair.local",
            roles: ["vet"],
            status: "active",
            title: "수의사",
            department: "진료",
            createdAt: "2026-05-18T00:00:00.000Z",
            activatedAt: "2026-05-18T00:00:00.000Z",
            deactivatedAt: null,
          },
          {
            id: "membership-inactive",
            workspaceId: "clair-demo",
            userSessionId: "user-old",
            displayName: "비활성",
            email: "old@clair.local",
            roles: ["front_desk"],
            status: "inactive",
            title: "데스크",
            department: "원무",
            createdAt: "2026-05-18T00:00:00.000Z",
            activatedAt: null,
            deactivatedAt: "2026-05-18T01:00:00.000Z",
          },
        ],
        invitations: [
          {
            id: "invite-persisted",
            workspaceId: "clair-demo",
            email: "pending@clair.local",
            invitedRoles: ["technician"],
            title: "테크니션",
            department: "검사",
            status: "pending",
            invitedBySessionId: "user-admin",
            acceptedBySessionId: null,
            expiresAt: "2026-05-25T00:00:00.000Z",
            acceptedAt: null,
            canceledAt: null,
            resentAt: null,
            resendCount: 0,
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z",
          },
        ],
        enforcedBy: "workspace-membership-status-reader",
      }),
    });
  });

  await page.goto("/login?next=%2Fw%2Fclair-demo%2Forders%3FmodulePanel%3Dopen%26aside%3Dclosed");
  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("button", { name: "병원구성원 관리" }).click();

  await expect(page.getByText("활성 2명")).toBeVisible();
  await expect(page.getByText("대기 1건")).toBeVisible();
  await expect(page.getByText("비활성 1명")).toBeVisible();
  await expect(page.getByText("pending@clair.local")).toBeVisible();
  await expect(page.getByText("old@clair.local")).toBeVisible();
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}

type PermissionMode = "authorized" | "denied" | "fail";

type FakeSupabaseClient = {
  readonly label: string;
};

type SupabaseRouteHarnessCalls = {
  readonly permissionGatewayClients: string[];
  readonly permissionReads: string[];
  readonly statusGatewayClients: string[];
  readonly statusReads: string[];
};

function createSupabaseRouteHarness({
  permissionMode,
}: {
  permissionMode: PermissionMode;
}): {
  readonly calls: SupabaseRouteHarnessCalls;
  readonly deps: MembershipRouteDependencies<FakeSupabaseClient>;
} {
  const calls: SupabaseRouteHarnessCalls = {
    permissionGatewayClients: [],
    permissionReads: [],
    statusGatewayClients: [],
    statusReads: [],
  };
  const client: FakeSupabaseClient = { label: "db-client" };
  const deps: MembershipRouteDependencies<FakeSupabaseClient> = {
    async readServerSession() {
      return authenticatedSession("user-live");
    },
    async createClient() {
      return client;
    },
    loadWorkspacePermissionAdapterFromDb,
    createSupabaseWorkspacePermissionGateway(permissionClient) {
      calls.permissionGatewayClients.push(permissionClient.label);
      return {
        async listMemberships(workspaceId, userId) {
          calls.permissionReads.push(`memberships:${workspaceId}:${userId}`);

          if (permissionMode === "fail") {
            throw new Error("permission gateway read failed");
          }

          return [
            {
              id: "membership-live",
              workspace_id: workspaceId,
              user_id: userId,
              roles: ["vet"],
              status: "active",
            },
          ];
        },
        async listUsers(userIds) {
          calls.permissionReads.push(`users:${userIds.join(",")}`);
          return [{ id: "user-live", status: "active", display_name: "Live Admin" }];
        },
        async listPermissionPolicies(workspaceId) {
          calls.permissionReads.push(`policies:${workspaceId}`);
          return [];
        },
        async listPermissionRoleAssignments(workspaceId, membershipIds) {
          calls.permissionReads.push(`permissionRoles:${workspaceId}:${membershipIds.join(",")}`);

          if (permissionMode !== "authorized") {
            return [];
          }

          return [
            {
              workspace_id: workspaceId,
              membership_id: "membership-live",
              permission_role_id: "role-admin",
              role_key: "admin",
              label: "관리자",
              role_type: "admin",
              permissions: { allowed: ["role_permission:manage"] },
            },
          ];
        },
        async listJobPositionAssignments(workspaceId, membershipIds) {
          calls.permissionReads.push(`jobPositions:${workspaceId}:${membershipIds.join(",")}`);
          return [];
        },
      };
    },
    createSupabaseWorkspaceMembershipStatusGateway(statusClient, workspaceId) {
      calls.statusGatewayClients.push(`${statusClient.label}:${workspaceId}`);
      return {
        async listWorkspaceMembershipStatus() {
          calls.statusReads.push(workspaceId);
          return {
            ok: true,
            memberships: [
              {
                id: "membership-persisted",
                workspaceId,
                userSessionId: "user-persisted",
                displayName: "Persisted Member",
                email: "persisted@clair.local",
                roles: ["vet"],
                status: "active",
                title: "수의사",
                department: "진료",
                createdAt: "2026-07-02T00:00:00.000Z",
                activatedAt: "2026-07-02T00:00:00.000Z",
                deactivatedAt: null,
              },
            ],
            invitations: [],
          };
        },
      };
    },
    readWorkspaceMembershipStatus: readMembershipStatusWithPermissionResolver,
  };

  return { calls, deps };
}

function authenticatedSession(sessionUserId: string): ServerSessionReaderResult {
  return {
    ok: true,
    status: "authenticated",
    sessionUserId,
    email: "live-admin@clair.local",
    role: "authenticated",
    aal: "aal1",
    sessionId: "session-live",
    source: "supabase_claims",
  };
}

async function readMembershipStatusWithPermissionResolver({
  actorUserId,
  workspaceId,
  permissionAdapter,
  gateway,
}: {
  actorUserId: string | null;
  workspaceId: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  gateway?: WorkspaceMembershipStatusGateway;
}): Promise<WorkspaceMembershipStatusResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  if (!permissionAdapter) {
    return { ok: false, status: 500, error: "supabase_client_missing" };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "role_permission:manage",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway?.listWorkspaceMembershipStatus();

  if (!result?.ok) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    memberships: result.memberships,
    invitations: result.invitations,
    enforcedBy: "workspace-membership-status-reader",
  };
}
