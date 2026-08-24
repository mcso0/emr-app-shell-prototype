import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createSupabaseWorkspaceRoleCatalogGateway,
  validateWorkspaceRoleCatalogMutation,
  type WorkspaceRoleCatalogMutation,
} from "@/features/auth/server-workspace-role-catalog";
import {
  handleWorkspaceRoleCatalogGet,
  handleWorkspaceRoleCatalogMutation,
  type WorkspaceRoleCatalogRouteDependencies,
} from "@/app/api/workspaces/[workspaceId]/role-permission-management/route-core";
import type { ServerSessionReaderResult } from "@/features/auth/server-session-contract";

const migrationsDirectory = join(process.cwd(), "supabase/migrations");
const catalogMigrationPath = join(
  migrationsDirectory,
  readdirSync(migrationsDirectory).find((file) =>
    file.endsWith("_workspace_role_catalog_server_enforcement.sql")
  ) ?? "missing_workspace_role_catalog_server_enforcement.sql"
);

test("role catalog migration records explicit legacy owner reconciliation and guarded RPCs", () => {
  expect(existsSync(catalogMigrationPath)).toBe(true);

  const source = readFileSync(catalogMigrationPath, "utf8");
  expect(source).toContain("owner_source");
  expect(source).toContain("legacy_creator");
  expect(source).toContain("legacy_fallback");
  expect(source).toContain("clair_safe_custom_permission_values");
  expect(source).toContain("workspace_permission_role_system_immutable");
  expect(source).toContain("clair_read_workspace_role_catalog");
  expect(source).toContain("clair_mutate_workspace_role_catalog");
  expect(source).toContain("revoke insert, update, delete on public.workspace_permission_roles from authenticated");
});

test("role catalog mutation accepts a safe custom role", () => {
  const input: WorkspaceRoleCatalogMutation = {
    action: "role.create",
    role: {
      label: "검사 보조",
      description: "검사 결과를 입력합니다.",
      permissionIds: ["lab:complete", "chart:view", "lab:complete"],
    },
  };

  expect(validateWorkspaceRoleCatalogMutation(input)).toEqual({
    ok: true,
    value: {
      action: "role.create",
      roleKey: null,
      positionKey: null,
      label: "검사 보조",
      description: "검사 결과를 입력합니다.",
      permissionIds: ["chart:view", "lab:complete"],
    },
  });
});

test("role catalog mutation rejects owner-only and unknown custom permissions", () => {
  for (const permissionIds of [
    ["*"],
    ["workspace:delete"],
    ["role_permission:manage"],
    ["unknown:permission"],
  ]) {
    expect(
      validateWorkspaceRoleCatalogMutation({
        action: "role.create",
        role: { label: "권한 우회", permissionIds },
      })
    ).toEqual({ ok: false, error: "invalid_custom_role_permissions" });
  }
});

test("role catalog mutation accepts only custom catalog actions", () => {
  expect(
    validateWorkspaceRoleCatalogMutation({
      action: "role.update",
      roleKey: "owner",
      role: { label: "소유자 변경", permissionIds: ["chart:view"] },
    })
  ).toEqual({ ok: false, error: "system_role_immutable" });

  expect(
    validateWorkspaceRoleCatalogMutation({
      action: "job.archive",
      positionKey: "hospital_director",
    })
  ).toEqual({ ok: false, error: "system_job_immutable" });
});

test("role catalog gateway reads and mutates through checked RPCs", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const gateway = createSupabaseWorkspaceRoleCatalogGateway({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: {
          permissionRoles: [],
          jobPositions: [],
          access: { canManage: true },
          ownerReconciliation: { needsConfirmation: false, membershipIds: [] },
        },
        error: null,
      };
    },
  });

  await expect(gateway.read({ workspaceId: "workspace-a" })).resolves.toEqual({
    ok: true,
    snapshot: {
      permissionRoles: [],
      jobPositions: [],
      access: { canManage: true },
      ownerReconciliation: { needsConfirmation: false, membershipIds: [] },
    },
  });

  await expect(
    gateway.mutate({
      workspaceId: "workspace-a",
      mutation: {
        action: "role.create",
        role: { label: "검사 보조", permissionIds: ["lab:complete"] },
      },
    })
  ).resolves.toMatchObject({ ok: true });

  expect(calls).toEqual([
    {
      name: "clair_read_workspace_role_catalog",
      args: { p_workspace_id: "workspace-a" },
    },
    {
      name: "clair_mutate_workspace_role_catalog",
      args: {
        p_workspace_id: "workspace-a",
        p_action: "role.create",
        p_role_key: null,
        p_position_key: null,
        p_label: "검사 보조",
        p_description: null,
        p_permission_ids: ["lab:complete"],
      },
    },
  ]);
});

test("role catalog gateway treats a foreign workspace membership miss as permission denial", async () => {
  const gateway = createSupabaseWorkspaceRoleCatalogGateway({
    async rpc() {
      return {
        data: null,
        error: { message: "workspace_membership_missing" },
      };
    },
  });

  await expect(gateway.read({ workspaceId: "workspace-foreign" })).resolves.toEqual({
    ok: false,
    error: "permission_missing",
  });
});

test("role catalog route requires an authenticated server identity", async () => {
  const response = await handleWorkspaceRoleCatalogGet(
    new Request("http://localhost/api/workspaces/workspace-a/role-permission-management"),
    { workspaceId: "workspace-a" },
    createRouteDependencies({ session: unauthenticatedSession() })
  );

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "unauthenticated",
  });
});

test("role catalog route reads through the checked gateway and rejects forged role input", async () => {
  const calls: string[] = [];
  const dependencies = createRouteDependencies({
    onRead: () => {
      calls.push("read");
      return { ok: true, snapshot: emptySnapshot };
    },
    onMutate: () => {
      calls.push("mutate");
      return { ok: true, snapshot: emptySnapshot };
    },
  });

  const readResponse = await handleWorkspaceRoleCatalogGet(
    new Request("http://localhost/api/workspaces/workspace-a/role-permission-management"),
    { workspaceId: "workspace-a" },
    dependencies
  );
  expect(readResponse.status).toBe(200);
  await expect(readResponse.json()).resolves.toEqual({ ok: true, snapshot: emptySnapshot });

  const invalidMutation = await handleWorkspaceRoleCatalogMutation(
    new Request("http://localhost/api/workspaces/workspace-a/role-permission-management", {
      method: "POST",
      body: JSON.stringify({
        action: "role.create",
        role: { label: "권한 우회", permissionIds: ["*"] },
      }),
    }),
    { workspaceId: "workspace-a" },
    dependencies
  );
  expect(invalidMutation.status).toBe(400);
  expect(calls).toEqual(["read"]);
});

test("role catalog route maps checked-RPC denial and audit failure", async () => {
  const denied = await handleWorkspaceRoleCatalogMutation(
    new Request("http://localhost/api/workspaces/workspace-a/role-permission-management", {
      method: "POST",
      body: JSON.stringify({
        action: "job.archive",
        positionKey: "custom_coordinator",
      }),
    }),
    { workspaceId: "workspace-a" },
    createRouteDependencies({ onMutate: () => ({ ok: false, error: "permission_missing" }) })
  );
  expect(denied.status).toBe(403);

  const auditFailure = await handleWorkspaceRoleCatalogMutation(
    new Request("http://localhost/api/workspaces/workspace-a/role-permission-management", {
      method: "POST",
      body: JSON.stringify({
        action: "job.archive",
        positionKey: "custom_coordinator",
      }),
    }),
    { workspaceId: "workspace-a" },
    createRouteDependencies({
      onMutate: () => ({ ok: true, snapshot: emptySnapshot }),
      auditOk: false,
    })
  );
  expect(auditFailure.status).toBe(500);
  await expect(auditFailure.json()).resolves.toEqual({ ok: false, error: "audit_write_failed" });
});

const emptySnapshot = {
  permissionRoles: [],
  jobPositions: [],
  access: { canManage: false },
  ownerReconciliation: { needsConfirmation: false, membershipIds: [] },
};

type RouteFixtureOptions = {
  session?: ServerSessionReaderResult;
  onRead?: () => { ok: true; snapshot: typeof emptySnapshot } | { ok: false; error: "permission_missing" };
  onMutate?: () => { ok: true; snapshot: typeof emptySnapshot } | { ok: false; error: "permission_missing" };
  auditOk?: boolean;
};

function createRouteDependencies({
  session = authenticatedSession(),
  onRead = () => ({ ok: true as const, snapshot: emptySnapshot }),
  onMutate = () => ({ ok: true as const, snapshot: emptySnapshot }),
  auditOk = true,
}: RouteFixtureOptions = {}): WorkspaceRoleCatalogRouteDependencies<object> {
  return {
    async readServerSession() {
      return session;
    },
    async createClient() {
      return {};
    },
    createSupabaseWorkspaceRoleCatalogGateway() {
      return {
        async read() {
          return onRead();
        },
        async mutate() {
          return onMutate();
        },
      };
    },
    createAuditGateway() {
      return null;
    },
    enforceWorkspaceMutationRateLimit() {
      return null;
    },
    async emitLiveMutationAuditEvent() {
      return auditOk ? { ok: true as const } : { ok: false as const, error: "audit_write_failed" as const };
    },
  };
}

function authenticatedSession(): ServerSessionReaderResult {
  return {
    ok: true,
    status: "authenticated",
    sessionUserId: "user-owner",
    email: "owner@clair.local",
    role: "authenticated",
    aal: "aal1",
    sessionId: "session-owner",
    source: "supabase_claims",
  };
}

function unauthenticatedSession(): ServerSessionReaderResult {
  return {
    ok: false,
    status: "unauthenticated",
    reason: "no_session",
    sessionUserId: null,
    source: "supabase_claims",
  };
}
