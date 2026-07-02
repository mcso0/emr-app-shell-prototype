import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  createWorkspacePermissionAdapterFromDbRows,
  loadWorkspacePermissionAdapterFromDb,
} from "../src/features/auth/db-workspace-permission-adapter-core";
import { resolveWorkspacePermission } from "../src/features/auth/permission-resolver";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "../src/features/auth/supabase-workspace-permission-gateway-core";

test("DB-backed permission adapter maps membership and role policy rows into resolver input", async () => {
  const adapter = createWorkspacePermissionAdapterFromDbRows({
    now: "2026-05-18T00:00:00.000Z",
    users: [
      {
        id: "user-live",
        status: "active",
        display_name: "Live Admin",
      },
    ],
    memberships: [
      {
        id: "membership-live",
        workspace_id: "workspace-a",
        user_id: "user-live",
        roles: ["vet", "front_desk", "legacy_role"],
        status: "active",
      },
    ],
    permissionPolicies: [
      {
        workspace_id: "workspace-a",
        scope: "role",
        target_role: "vet",
        permissions: { allowed: ["chart:update"] },
      },
      {
        workspace_id: "workspace-a",
        scope: "role",
        target_role: "front_desk",
        permissions: { allowed: ["billing:issue"] },
      },
    ],
  });

  expect(adapter.memberships[0].roles).toEqual(["vet", "front_desk"]);

  const result = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-live",
    workspaceId: "workspace-a",
    requiredPermission: "billing:issue",
  });

  expect(result.allowed).toBe(true);
  expect(result.assignedRoles).toEqual(["vet", "front_desk"]);
  expect(result.effectivePermissionIds).toEqual(["billing:issue", "chart:update"]);
});

test("DB-backed permission adapter prefers permission-role assignments over legacy roles", async () => {
  const adapter = createWorkspacePermissionAdapterFromDbRows({
    now: "2026-07-02T00:00:00.000Z",
    users: [
      {
        id: "user-custom",
        status: "active",
        display_name: "Custom Member",
      },
    ],
    memberships: [
      {
        id: "membership-custom",
        workspace_id: "workspace-a",
        user_id: "user-custom",
        roles: ["vet"],
        status: "active",
      },
    ],
    permissionRoleAssignments: [
      {
        workspace_id: "workspace-a",
        membership_id: "membership-custom",
        permission_role_id: "role-readonly",
        role_key: "chart_readonly",
        label: "차트 열람",
        role_type: "custom",
        permissions: { allowed: ["chart:view"] },
      },
    ],
    jobPositionAssignments: [
      {
        workspace_id: "workspace-a",
        membership_id: "membership-custom",
        job_position_id: "position-veterinarian",
        position_key: "veterinarian",
        label: "수의사",
      },
    ],
  });

  expect(adapter.memberships[0].permissionRole).toMatchObject({
    key: "chart_readonly",
    label: "차트 열람",
    roleType: "custom",
  });
  expect(adapter.memberships[0].jobPosition).toMatchObject({
    key: "veterinarian",
    label: "수의사",
  });

  const denied = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-custom",
    workspaceId: "workspace-a",
    requiredPermission: "chart:update",
  });

  expect(denied.allowed).toBe(false);
  expect(denied.denialReason).toBe("permission_missing");
  expect(denied.effectivePermissionIds).toEqual(["chart:view"]);
});

test("DB-backed permission loader uses a narrow gateway and keeps server-only boundaries", async () => {
  const calls: string[] = [];
  const adapter = await loadWorkspacePermissionAdapterFromDb({
    now: "2026-05-18T00:00:00.000Z",
    workspaceId: "workspace-a",
    sessionUserId: "user-live",
    gateway: {
      async listMemberships(workspaceId, userId) {
        calls.push(`memberships:${workspaceId}:${userId}`);
        return [
          {
            id: "membership-live",
            workspace_id: workspaceId,
            user_id: userId,
            roles: ["hospital_admin"],
            status: "active",
          },
        ];
      },
      async listUsers(userIds) {
        calls.push(`users:${userIds.join(",")}`);
        return [{ id: "user-live", status: "active", display_name: "Live Admin" }];
      },
      async listPermissionPolicies(workspaceId) {
        calls.push(`policies:${workspaceId}`);
        return [];
      },
      async listPermissionRoleAssignments(workspaceId, membershipIds) {
        calls.push(`permissionRoles:${workspaceId}:${membershipIds.join(",")}`);
        return [
          {
            workspace_id: workspaceId,
            membership_id: "membership-live",
            permission_role_id: "role-owner",
            role_key: "owner",
            label: "소유자",
            role_type: "owner",
            permissions: { allowed: ["*"] },
          },
        ];
      },
      async listJobPositionAssignments(workspaceId, membershipIds) {
        calls.push(`jobPositions:${workspaceId}:${membershipIds.join(",")}`);
        return [
          {
            workspace_id: workspaceId,
            membership_id: "membership-live",
            job_position_id: "position-director",
            position_key: "hospital_director",
            label: "병원장",
          },
        ];
      },
    },
  });

  expect(calls).toEqual([
    "memberships:workspace-a:user-live",
    "users:user-live",
    "policies:workspace-a",
    "permissionRoles:workspace-a:membership-live",
    "jobPositions:workspace-a:membership-live",
  ]);
  expect(adapter.memberships[0]).toMatchObject({
    workspaceId: "workspace-a",
    userId: "user-live",
    roles: ["hospital_admin"],
    permissionRole: { key: "owner", label: "소유자", roleType: "owner" },
    jobPosition: { key: "hospital_director", label: "병원장" },
  });

  const source = readFileSync(
    "src/features/auth/db-workspace-permission-adapter.ts",
    "utf8"
  );
  const supabaseGatewaySource = readFileSync(
    "src/features/auth/supabase-workspace-permission-gateway.ts",
    "utf8"
  );
  expect(source).toContain('import "server-only"');
  expect(supabaseGatewaySource).toContain('import "server-only"');
  expect(source).not.toMatch(/sessionStorage|localStorage|window\\./);
  expect(supabaseGatewaySource).not.toMatch(/sessionStorage|localStorage|window\\./);
});

test("Supabase workspace permission gateway reads scoped membership, users, policies, and assignments", async () => {
  const calls: string[] = [];
  const client = {
    from(table:
      | "user_memberships"
      | "users"
      | "permission_policies"
      | "workspace_membership_permission_role_assignments"
      | "workspace_membership_job_position_assignments"
    ) {
      const filters: string[] = [];
      const builder = {
        select(columns: string) {
          calls.push(`${table}:select:${columns}`);
          return builder;
        },
        eq(column: string, value: string) {
          filters.push(`${column}=${value}`);
          calls.push(`${table}:eq:${column}=${value}`);
          return builder;
        },
        in(column: string, values: string[]) {
          filters.push(`${column}=${values.join(",")}`);
          calls.push(`${table}:in:${column}=${values.join(",")}`);
          return builder;
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          if (table === "user_memberships") {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: "membership-live",
                    workspace_id: "clair-demo",
                    user_id: "user-live",
                    roles: ["hospital_admin"],
                    status: "active",
                  },
                ],
                error: null,
              })
            );
          }

          if (table === "users") {
            return Promise.resolve(
              resolve({
                data: [{ id: "user-live", status: "active", display_name: "Live Admin" }],
                error: null,
              })
            );
          }

          if (table === "workspace_membership_permission_role_assignments") {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    workspace_id: "clair-demo",
                    membership_id: "membership-live",
                    permission_role_id: "role-owner",
                    workspace_permission_roles: {
                      role_key: "owner",
                      label: "소유자",
                      role_type: "owner",
                      permissions: { allowed: ["*"] },
                    },
                  },
                ],
                error: null,
              })
            );
          }

          if (table === "workspace_membership_job_position_assignments") {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    workspace_id: "clair-demo",
                    membership_id: "membership-live",
                    job_position_id: "position-director",
                    workspace_job_positions: {
                      position_key: "hospital_director",
                      label: "병원장",
                    },
                  },
                ],
                error: null,
              })
            );
          }

          return Promise.resolve(
            resolve({
              data: [
                {
                  workspace_id: "clair-demo",
                  scope: "role",
                  target_role: "hospital_admin",
                  permissions: { allowed: ["*"] },
                },
              ],
              error: null,
            })
          );
        },
      };

      return builder;
    },
  };
  const gateway = createSupabaseWorkspacePermissionGateway(
    client as unknown as SupabaseWorkspacePermissionClient
  );

  await expect(gateway.listMemberships("clair-demo", "user-live")).resolves.toHaveLength(1);
  await expect(gateway.listUsers(["user-live"])).resolves.toHaveLength(1);
  await expect(gateway.listPermissionPolicies("clair-demo")).resolves.toHaveLength(1);
  await expect(gateway.listPermissionRoleAssignments("clair-demo", ["membership-live"])).resolves.toEqual([
    expect.objectContaining({
      membership_id: "membership-live",
      role_key: "owner",
      label: "소유자",
      role_type: "owner",
    }),
  ]);
  await expect(gateway.listJobPositionAssignments("clair-demo", ["membership-live"])).resolves.toEqual([
    expect.objectContaining({
      membership_id: "membership-live",
      position_key: "hospital_director",
      label: "병원장",
    }),
  ]);

  expect(calls).toContain("user_memberships:eq:workspace_id=clair-demo");
  expect(calls).toContain("user_memberships:eq:user_id=user-live");
  expect(calls).toContain("users:in:id=user-live");
  expect(calls).toContain("permission_policies:eq:workspace_id=clair-demo");
  expect(calls).toContain(
    "workspace_membership_permission_role_assignments:in:membership_id=membership-live"
  );
  expect(calls).toContain(
    "workspace_membership_job_position_assignments:in:membership_id=membership-live"
  );
});
