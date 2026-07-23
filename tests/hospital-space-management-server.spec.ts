import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockWorkspaceSpaceManagementGateway,
  createSupabaseWorkspaceSpaceManagementGateway,
  mutateWorkspaceSpaceManagement,
  readWorkspaceSpaceManagement,
  type SupabaseWorkspaceSpaceManagementClient,
} from "../src/features/hospital-admin/space-management/server-space-management-core";

const workspaceId = "clair-demo";
const actorUserId = "user-admin";

test("space management read allows members and reports manage eligibility", async () => {
  const admin = await readWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    permissionAdapter: permissionAdapter("hospital_admin"),
    gateway: createMockWorkspaceSpaceManagementGateway("read-admin"),
  });
  const viewer = await readWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    permissionAdapter: permissionAdapter("front_desk"),
    gateway: createMockWorkspaceSpaceManagementGateway("read-viewer"),
  });

  expect(admin).toMatchObject({ ok: true, status: 200, canManage: true });
  expect(viewer).toMatchObject({ ok: true, status: 200, canManage: false });
  if (admin.ok) expect(admin.categories).toHaveLength(4);
});

test("space management rejects non-managers and invalid commands before the write gateway", async () => {
  let gatewayCalled = false;
  const gateway = {
    async get() {
      return { ok: false as const, error: "db_read_failed" as const };
    },
    async mutate() {
      gatewayCalled = true;
      return { ok: false as const, error: "db_write_failed" as const };
    },
  };

  const denied = await mutateWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    input: { action: "category.create", name: "입원 공간" },
    permissionAdapter: permissionAdapter("front_desk"),
    gateway,
  });
  const invalid = await mutateWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    input: { action: "space.create", categoryId: "", name: "입원실 1" },
    permissionAdapter: permissionAdapter("hospital_admin"),
    gateway,
  });

  expect(denied).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  expect(invalid).toEqual({ ok: false, status: 400, error: "invalid_input" });
  expect(gatewayCalled).toBe(false);
});

test("mock space management keeps CRUD scoped and moves spaces before archiving a category", async () => {
  const gateway = createMockWorkspaceSpaceManagementGateway("crud");
  const permissions = permissionAdapter("hospital_admin");

  const createdCategory = await mutateWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    input: { action: "category.create", name: "입원 공간" },
    permissionAdapter: permissions,
    gateway,
  });
  expect(createdCategory).toMatchObject({ ok: true, status: 200 });
  if (!createdCategory.ok) return;
  const inpatient = createdCategory.categories.find((category) => category.name === "입원 공간");
  expect(inpatient).toBeTruthy();
  if (!inpatient) return;

  const createdSpace = await mutateWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    input: { action: "space.create", categoryId: inpatient.id, name: "입원실 1" },
    permissionAdapter: permissions,
    gateway,
  });
  expect(createdSpace).toMatchObject({ ok: true });

  const missingTarget = await mutateWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    input: { action: "category.delete", categoryId: inpatient.id },
    permissionAdapter: permissions,
    gateway,
  });
  expect(missingTarget).toEqual({
    ok: false,
    status: 409,
    error: "category_move_target_required",
  });

  const consultCategory = createdCategory.categories.find(
    (category) => category.name === "진료 공간",
  );
  expect(consultCategory).toBeTruthy();
  if (!consultCategory) return;

  const archived = await mutateWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    input: {
      action: "category.delete",
      categoryId: inpatient.id,
      moveTargetCategoryId: consultCategory.id,
    },
    permissionAdapter: permissions,
    gateway,
  });
  expect(archived).toMatchObject({ ok: true });
  if (archived.ok) {
    expect(archived.categories.some((category) => category.id === inpatient.id)).toBe(false);
    expect(
      archived.categories
        .find((category) => category.id === consultCategory.id)
        ?.spaces.some((space) => space.name === "입원실 1"),
    ).toBe(true);
  }
});

test("mock space management rejects case-insensitive duplicates in the effective category", async () => {
  const gateway = createMockWorkspaceSpaceManagementGateway("duplicates");
  const result = await mutateWorkspaceSpaceManagement({
    actorUserId,
    workspaceId,
    input: { action: "category.create", name: "진료 공간" },
    permissionAdapter: permissionAdapter("hospital_admin"),
    gateway,
  });

  expect(result).toEqual({ ok: false, status: 409, error: "duplicate_category_name" });
});

test("Supabase space management gateway uses only the two workspace-scoped RPCs", async () => {
  const calls: unknown[] = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push([functionName, args]);
      return {
        data: {
          workspaceId,
          categories: [],
        },
        error: null,
      };
    },
  } as SupabaseWorkspaceSpaceManagementClient;
  const gateway = createSupabaseWorkspaceSpaceManagementGateway(client);
  const command = { action: "category.create" as const, name: "입원 공간" };

  expect((await gateway.get(workspaceId)).ok).toBe(true);
  expect((await gateway.mutate({ actorUserId, workspaceId, command })).ok).toBe(true);
  expect(calls).toEqual([
    ["clair_get_workspace_space_management", { p_workspace_id: workspaceId }],
    ["clair_mutate_workspace_space_management", {
      p_actor_user_id: actorUserId,
      p_command: command,
      p_workspace_id: workspaceId,
    }],
  ]);
});

test("space management route keeps identity, permission, and rate limits server-owned", () => {
  const route = readFileSync(
    "src/app/api/workspaces/[workspaceId]/hospital-admin/space-management/route.ts",
    "utf8",
  );

  expect(route).toContain("readServerSession");
  expect(route).toContain("resolveRoleUpdateActorIdentity");
  expect(route).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(route).toContain("enforceWorkspaceMutationRateLimit");
  expect(route).toContain("demoClientSessionIdHeader");
  expect(route).toContain("readWorkspaceSpaceManagement");
  expect(route).toContain("mutateWorkspaceSpaceManagement");
  expect(route).toContain("export async function GET");
  expect(route).toContain("export async function POST");
});

function permissionAdapter(role: "hospital_admin" | "front_desk") {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [{
      id: `membership-${role}`,
      workspaceId,
      userId: actorUserId,
      roles: [role],
      status: "active",
    }],
  });
}
