import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockOrderIntendedAssigneeGateway,
  createSupabaseOrderIntendedAssigneeGateway,
  saveOrderIntendedAssignee,
  type SupabaseOrderIntendedAssigneeRpcClient,
} from "../src/features/chart/server-order-intended-assignee-core";

const workspaceId = "clair-demo";
const orderId = "95000000-0000-4000-8000-000000000101";
const expectedOrderUpdatedAt = "2026-09-02T09:00:00.000Z";

test("intended assignee requires chart:update before the gateway is called", async () => {
  let called = false;
  const result = await saveOrderIntendedAssignee({
    actorUserId: "user-front-desk",
    expectedOrderUpdatedAt,
    gateway: {
      async save() {
        called = true;
        throw new Error("gateway must stay behind permission enforcement");
      },
    },
    idempotencyKey: "intended-assignee-denied-0001",
    intendedAssigneeUserId: "user-tech",
    orderId,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      memberships: [
        {
          id: "membership-front-desk",
          permissionRole: {
            key: "billing-only",
            label: "Billing only",
            permissionIds: ["billing:issue"],
            roleType: "custom",
          },
          roles: ["front_desk"],
          status: "active",
          userId: "user-front-desk",
          workspaceId,
        },
      ],
      users: [{ id: "user-front-desk", status: "active" }],
    }),
    workspaceId,
  });

  expect(result).toEqual({
    denialReason: "permission_missing",
    ok: false,
    status: 403,
  });
  expect(called).toBe(false);
});

test("intended assignee mock replays identical commands and rejects changed payloads", async () => {
  const gateway = createMockOrderIntendedAssigneeGateway();
  const input = {
    actorUserId: "user-vet",
    expectedOrderUpdatedAt,
    gateway,
    idempotencyKey: "intended-assignee-command-0001",
    intendedAssigneeUserId: "user-tech",
    orderId,
    workspaceId,
  };
  const first = await saveOrderIntendedAssignee(input);
  const replay = await saveOrderIntendedAssignee(input);
  const conflict = await saveOrderIntendedAssignee({
    ...input,
    intendedAssigneeUserId: "user-admin",
  });

  expect(first).toEqual(replay);
  expect(first).toMatchObject({
    enforcedBy: "order-intended-assignee",
    ok: true,
    state: { intendedAssigneeUserId: "user-tech", orderId },
  });
  expect(conflict).toEqual({
    error: "idempotency_conflict",
    ok: false,
    status: 409,
  });
});

test("Supabase intended-assignee gateway preserves scope, actor, CAS, and idempotency", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data:
          functionName === "clair_list_order_intended_assignees"
            ? [{ displayName: "송하윤", title: "테크니션", userId: "user-tech" }]
            : {
                commandId: "command-1",
                intendedAssigneeUserId: "user-tech",
                orderId,
                updatedAt: "2026-09-02T09:01:00.000Z",
              },
        error: null,
      };
    },
  } as SupabaseOrderIntendedAssigneeRpcClient;
  const gateway = createSupabaseOrderIntendedAssigneeGateway(client);

  await gateway.list({ orderId, workspaceId });
  await gateway.save({
    actorUserId: "user-vet",
    expectedOrderUpdatedAt,
    idempotencyKey: "intended-assignee-command-0002",
    intendedAssigneeUserId: "user-tech",
    orderId,
    workspaceId,
  });

  expect(calls).toEqual([
    {
      functionName: "clair_list_order_intended_assignees",
      args: { p_order_id: orderId, p_workspace_id: workspaceId },
    },
    {
      functionName: "clair_save_order_intended_assignee",
      args: {
        p_actor_user_id: "user-vet",
        p_expected_order_updated_at: expectedOrderUpdatedAt,
        p_idempotency_key: "intended-assignee-command-0002",
        p_intended_assignee_user_id: "user-tech",
        p_order_id: orderId,
        p_workspace_id: workspaceId,
      },
    },
  ]);
});

test("intended-assignee route is authenticated and exposes only server candidates", async ({
  request,
}) => {
  const route = `/api/workspaces/${workspaceId}/chart/orders/${orderId}/intended-assignee`;
  expect((await request.get(route)).status()).toBe(401);

  const listed = await request.get(route, {
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(listed.status()).toBe(200);
  await expect(listed.json()).resolves.toMatchObject({
    assignees: [
      { displayName: "송하윤", userId: "user-tech" },
      { displayName: "송민재", userId: "user-admin" },
    ],
    enforcedBy: "order-intended-assignee",
    ok: true,
  });

  const saved = await request.patch(route, {
    data: {
      expectedOrderUpdatedAt,
      idempotencyKey: "intended-assignee-route-0001",
      intendedAssigneeUserId: "user-tech",
    },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(saved.status()).toBe(200);
  await expect(saved.json()).resolves.toMatchObject({
    enforcedBy: "order-intended-assignee",
    ok: true,
    state: { intendedAssigneeUserId: "user-tech", orderId },
  });
});

test("migration revalidates destination capability and applies assignment atomically on confirmation", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260902150055_plan_order_work_lifecycle_and_rpc_boundary.sql",
    ),
    "utf8",
  );
  expect(migration).toContain("public.clair_list_order_intended_assignees");
  expect(migration).toContain("public.clair_save_order_intended_assignee");
  expect(migration).toContain("p_expected_order_updated_at");
  expect(migration).toContain("raise exception 'revision_conflict'");
  expect(migration).toContain("raise exception 'assignee_ineligible'");
  expect(migration).toContain("private.clair_queue_permission_for_destination");
  expect(migration).toContain("private.clair_apply_intended_assignee_on_confirmation");
  expect(migration).toContain("'source', 'confirmed_intended_assignee'");
  expect(migration).toContain("order_intended_assignee_commands_immutable_trg");
  expect(migration).toContain(
    "alter table public.order_intended_assignee_commands enable row level security",
  );
  expect(migration).toContain(
    "revoke all on public.order_intended_assignee_commands",
  );
  expect(migration).not.toContain(
    "grant select on public.order_intended_assignee_commands to authenticated",
  );
});
