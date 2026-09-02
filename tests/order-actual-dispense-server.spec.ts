import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockOrderActualDispenseGateway,
  createSupabaseOrderActualDispenseGateway,
  saveOrderActualDispense,
  type SupabaseOrderActualDispenseRpcClient,
} from "../src/features/chart/server-order-actual-dispense-core";

const workspaceId = "clair-demo";
const orderId = "95000000-0000-4000-8000-000000000101";
const expectedOrderUpdatedAt = "2026-09-02T09:00:00.000Z";

test("actual dispense override stays behind chart:update", async () => {
  let called = false;
  const result = await saveOrderActualDispense({
    actorUserId: "user-front-desk",
    actualQuantity: 1.5,
    expectedOrderUpdatedAt,
    gateway: {
      async save() {
        called = true;
        throw new Error("gateway must stay behind permission enforcement");
      },
    },
    idempotencyKey: "actual-dispense-denied-0001",
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
    reason: "포장 단위 보정",
    workspaceId,
  });

  expect(result).toEqual({
    denialReason: "permission_missing",
    ok: false,
    status: 403,
  });
  expect(called).toBe(false);
});

test("actual dispense mock replays identical commands and rejects changed payloads", async () => {
  const gateway = createMockOrderActualDispenseGateway();
  const input = {
    actorUserId: "user-vet",
    actualQuantity: 1.5,
    expectedOrderUpdatedAt,
    gateway,
    idempotencyKey: "actual-dispense-command-0001",
    orderId,
    reason: "포장 단위 보정",
    workspaceId,
  };
  const first = await saveOrderActualDispense(input);
  const replay = await saveOrderActualDispense(input);
  const conflict = await saveOrderActualDispense({
    ...input,
    actualQuantity: 2,
  });

  expect(first).toEqual(replay);
  expect(first).toMatchObject({
    enforcedBy: "order-actual-dispense",
    ok: true,
    state: { actualDispenseQuantity: 1.5, orderId, versionNo: 1 },
  });
  expect(conflict).toEqual({
    error: "idempotency_conflict",
    ok: false,
    status: 409,
  });
});

test("actual dispense gateway preserves actor, workspace, CAS, reason, and idempotency", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          actualDispenseOverride: { reason: "포장 단위 보정", versionNo: 1 },
          actualDispenseQuantity: 1.5,
          actualDispenseSource: "manual_override",
          actualDispenseUnit: "mL",
          orderId,
          overrideId: "override-1",
          requiresReconfirmation: false,
          updatedAt: "2026-09-02T09:01:00.000Z",
          versionNo: 1,
        },
        error: null,
      };
    },
  } as SupabaseOrderActualDispenseRpcClient;
  const gateway = createSupabaseOrderActualDispenseGateway(client);

  await gateway.save({
    actorUserId: "user-vet",
    actualQuantity: 1.5,
    expectedOrderUpdatedAt,
    idempotencyKey: "actual-dispense-command-0002",
    orderId,
    reason: "포장 단위 보정",
    workspaceId,
  });

  expect(calls).toEqual([
    {
      functionName: "clair_save_order_actual_dispense_override",
      args: {
        p_actual_quantity: 1.5,
        p_actor_user_id: "user-vet",
        p_expected_order_updated_at: expectedOrderUpdatedAt,
        p_idempotency_key: "actual-dispense-command-0002",
        p_order_id: orderId,
        p_reason: "포장 단위 보정",
        p_workspace_id: workspaceId,
      },
    },
  ]);
});

test("actual dispense route authenticates and returns an append-only command result", async ({
  request,
}) => {
  const route = `/api/workspaces/${workspaceId}/chart/orders/${orderId}/actual-dispense`;
  expect((await request.patch(route, { data: {} })).status()).toBe(401);

  const saved = await request.patch(route, {
    data: {
      actualQuantity: 1.5,
      expectedOrderUpdatedAt,
      idempotencyKey: "actual-dispense-route-0001",
      reason: "포장 단위 보정",
    },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(saved.status()).toBe(200);
  await expect(saved.json()).resolves.toMatchObject({
    enforcedBy: "order-actual-dispense",
    ok: true,
    state: { actualDispenseQuantity: 1.5, orderId, versionNo: 1 },
  });
});

test("migration owns calculation, override history, confirmation gating, and snapshot freeze", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260902150055_plan_order_work_lifecycle_and_rpc_boundary.sql",
    ),
    "utf8",
  );
  expect(migration).toContain("private.clair_compute_plan_order_dispense_projection");
  expect(migration).toContain("public.order_actual_dispense_overrides");
  expect(migration).toContain("public.clair_save_order_actual_dispense_override");
  expect(migration).toContain("actual_dispense_overrides_immutable_trg");
  expect(migration).toContain("raise exception 'actual_dispense_confirmation_blocked'");
  expect(migration).toContain("raise exception 'actual_dispense_reconfirmation_required'");
  expect(migration).toContain("'reconfirmedAt', v_now");
  expect(migration).toContain("'clair.confirmed_snapshot_mutation_id'");
  expect(migration).toContain("'calculationOutputs', orders.calculation_outputs");
  expect(migration).toContain("'source', 'plan-order-calculation-confirmation-v1'");
});
