import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartOrderPrebillingOverrideGateway,
  createSupabaseChartOrderPrebillingOverrideGateway,
  saveChartOrderPrebillingOverride,
  type SupabaseChartOrderPrebillingOverrideRpcClient,
} from "../src/features/chart/server-order-prebilling-override-core";

const workspaceId = "clair-demo";
const validInput = {
  encounterId: "encounter-001",
  expectedVersion: 0,
  idempotencyKey: "prebilling-test-command-0001",
  orderId: "order-001",
  override: { billingName: "CBC 확정 청구명" },
};

test("prebilling override requires an actor with chart:update and billing:issue", async () => {
  let gatewayCalled = false;
  const result = await saveChartOrderPrebillingOverride({
    actorUserId: "user-chart-only",
    ...validInput,
    gateway: {
      async save() {
        gatewayCalled = true;
        throw new Error("gateway must not run without billing:issue");
      },
    },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-chart-only", status: "active" }],
      memberships: [
        {
          id: "membership-chart-only",
          workspaceId,
          userId: "user-chart-only",
          roles: [],
          permissionRole: {
            key: "chart-only",
            label: "Chart only",
            permissionIds: ["chart:update"],
            roleType: "custom",
          },
          status: "active",
        },
      ],
    }),
    workspaceId,
  });

  expect(result).toEqual({
    denialReason: "permission_missing",
    ok: false,
    status: 403,
  });
  expect(gatewayCalled).toBe(false);
});

test("prebilling override validates CAS input and supported fields", async () => {
  const result = await saveChartOrderPrebillingOverride({
    actorUserId: "user-admin",
    encounterId: validInput.encounterId,
    expectedVersion: -1,
    idempotencyKey: "short",
    orderId: validInput.orderId,
    override: { billingQuantity: 0 },
    workspaceId,
  });

  expect(result).toEqual({ error: "invalid_input", ok: false, status: 400 });
});

test("mock prebilling gateway replays an identical command and rejects changed content", async () => {
  const gateway = createMockChartOrderPrebillingOverrideGateway();
  const first = await saveChartOrderPrebillingOverride({
    actorUserId: "user-admin",
    ...validInput,
    gateway,
    workspaceId,
  });
  const replay = await saveChartOrderPrebillingOverride({
    actorUserId: "user-admin",
    ...validInput,
    gateway,
    workspaceId,
  });
  const conflict = await saveChartOrderPrebillingOverride({
    actorUserId: "user-admin",
    ...validInput,
    gateway,
    override: { billingName: "다른 청구명" },
    workspaceId,
  });

  expect(first).toEqual(replay);
  expect(first).toMatchObject({
    ok: true,
    override: { billingName: "CBC 확정 청구명", versionNo: 1 },
  });
  expect(conflict).toEqual({
    error: "idempotency_conflict",
    ok: false,
    status: 409,
  });
});

test("Supabase prebilling gateway keeps actor, scope, CAS, and patch in one RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          adjustmentAmountKrw: -500,
          adjustmentPercent: -5,
          adjustmentReason: "직원 할인",
          adjustmentSource: "amount",
          baseAmountKrw: 10000,
          billingName: "CBC",
          billingQuantity: 2,
          billingReflectionEnabled: true,
          chargeAmountKrw: 9500,
          orderId: "95000000-0000-4000-8000-000000000101",
          versionNo: 3,
        },
        error: null,
      };
    },
  } as SupabaseChartOrderPrebillingOverrideRpcClient;
  const gateway = createSupabaseChartOrderPrebillingOverrideGateway(client);

  const result = await gateway.save({
    actorUserId: "49110000-0000-4000-8000-000000000003",
    encounterId: "00000000-0000-4000-8000-000000000003",
    expectedVersion: 2,
    idempotencyKey: "prebilling-rpc-command-0001",
    orderId: "95000000-0000-4000-8000-000000000101",
    override: {
      adjustmentAmountKrw: -500,
      adjustmentReason: "직원 할인",
      adjustmentSource: "amount",
    },
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({ ok: true, override: { versionNo: 3 } });
  expect(calls).toEqual([
    {
      functionName: "clair_save_chart_order_prebilling_override",
      args: {
        p_actor_user_id: "49110000-0000-4000-8000-000000000003",
        p_encounter_id: "00000000-0000-4000-8000-000000000003",
        p_expected_version: 2,
        p_idempotency_key: "prebilling-rpc-command-0001",
        p_order_id: "95000000-0000-4000-8000-000000000101",
        p_override: {
          adjustmentAmountKrw: -500,
          adjustmentReason: "직원 할인",
          adjustmentSource: "amount",
        },
        p_workspace_id: "workspace-clair-cheongdam",
      },
    },
  ]);
});

test("prebilling route keeps identity and permission enforcement server-owned", async ({
  request,
}) => {
  const route = `/api/workspaces/${workspaceId}/chart/order-prebilling-overrides`;
  const unauthenticated = await request.post(route, { data: validInput });
  expect(unauthenticated.status()).toBe(401);

  const saved = await request.post(route, {
    data: validInput,
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });
  expect(saved.status()).toBe(200);
  await expect(saved.json()).resolves.toMatchObject({
    enforcedBy: "chart-order-prebilling-override",
    ok: true,
    override: { billingName: "CBC 확정 청구명", versionNo: 1 },
  });
});

test("migration makes prebilling history immutable and blocks charging unresolved reviews", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql",
    ),
    "utf8",
  );

  expect(migration).toContain("create table if not exists public.order_prebilling_overrides");
  expect(migration).toContain("request_sha256 text not null");
  expect(migration).toContain("private.clair_reject_prebilling_override_mutation");
  expect(migration).toContain("adjustment_reason_not_allowed");
  expect(migration).toContain("billing_snapshot_immutable");
  expect(migration).toContain("billing_review_required");
  expect(migration).toContain("'order-prebilling-override-' || v_previous.id::text");
  expect(migration).toContain("'source', 'order-prebilling-override-v1'");
  expect(migration).toContain("private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue')");
  expect(migration).not.toMatch(
    /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|postgres(?:ql)?:\/\/[^"]+:[^@"]+@/,
  );
});
