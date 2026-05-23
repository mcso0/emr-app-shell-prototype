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
    },
  });

  expect(calls).toEqual([
    "memberships:workspace-a:user-live",
    "users:user-live",
    "policies:workspace-a",
  ]);
  expect(adapter.memberships[0]).toMatchObject({
    workspaceId: "workspace-a",
    userId: "user-live",
    roles: ["hospital_admin"],
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

test("Supabase workspace permission gateway reads scoped membership, users, and policies", async () => {
  const calls: string[] = [];
  const client = {
    from(table: "user_memberships" | "users" | "permission_policies") {
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

  expect(calls).toContain("user_memberships:eq:workspace_id=clair-demo");
  expect(calls).toContain("user_memberships:eq:user_id=user-live");
  expect(calls).toContain("users:in:id=user-live");
  expect(calls).toContain("permission_policies:eq:workspace_id=clair-demo");
});
