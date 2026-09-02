import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { createMockChartOrderBillingSummaryFromMutationRows } from "../src/features/chart/chart-order-billing-summary-contract";
import {
  chartOrderExecutionMutationActions,
  createMockChartOrderExecutionMutationGateway,
  createSupabaseChartOrderExecutionMutationGateway,
  mutateChartOrderExecution,
  type SupabaseChartOrderExecutionMutationRpcClient,
} from "../src/features/chart/server-order-execution-mutation-core";

const workspaceId = "clair-demo";
const validInput = {
  action: "amend" as const,
  changes: {
    detailInputs: { specimenType: "serum" },
    detailSchemaVersion: 1,
  },
  expectedRevisionNo: 1,
  idempotencyKey: "phase5-amend-test-0001",
  orderId: "order-phase5-1",
  reason: "검사 지시를 수정합니다",
};

test("execution mutation validates reason, revision, idempotency, and action payload", async () => {
  const result = await mutateChartOrderExecution({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "priority_change",
      changes: { priority: "high" },
      expectedRevisionNo: -1,
      idempotencyKey: "short",
      orderId: " ",
      reason: "x",
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: {
      changes: expect.any(String),
      expectedRevisionNo: expect.any(String),
      idempotencyKey: expect.any(String),
      orderId: expect.any(String),
      reason: expect.any(String),
    },
  });
});

test("re-request rejects a non-positive actual dispense reconfirmation", async () => {
  const result = await mutateChartOrderExecution({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "re_request",
      changes: { actualDispenseQuantity: 0 },
      expectedRevisionNo: 1,
      idempotencyKey: "phase5-rerequest-actual-invalid-0001",
      orderId: "order-phase5-1",
      reason: "실조제량을 다시 확인합니다",
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: { changes: "실조제량은 0보다 큰 숫자여야 합니다." },
  });
});

test("order mutations require order:update and legacy billing correction is not an execution action", async () => {
  const vetAmend = await mutateChartOrderExecution({
    actorUserId: "user-vet",
    workspaceId,
    input: validInput,
  });
  expect(vetAmend).toMatchObject({ ok: true, status: 200 });

  expect(chartOrderExecutionMutationActions).not.toContain("billing_correct");
  const frontDeskAmend = await mutateChartOrderExecution({
    actorUserId: "user-front-desk",
    workspaceId,
    input: {
      ...validInput,
      idempotencyKey: "phase5-amend-test-0002",
    },
  });
  expect(frontDeskAmend).toEqual({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("execution mutation does not expose billing Summary without chart:view", async () => {
  let gatewayCalled = false;
  const result = await mutateChartOrderExecution({
    actorUserId: "user-order-update-only",
    workspaceId,
    input: validInput,
    gateway: {
      async mutateOrderExecution() {
        gatewayCalled = true;
        throw new Error("gateway must not run without chart:view");
      },
    },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-order-update-only", status: "active" }],
      memberships: [
        {
          id: "membership-order-update-only",
          workspaceId,
          userId: "user-order-update-only",
          roles: [],
          permissionRole: {
            key: "order-update-only",
            label: "Order update only",
            roleType: "custom",
            permissionIds: ["order:update"],
          },
          status: "active",
        },
      ],
    }),
  });

  expect(result).toEqual({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
  expect(gatewayCalled).toBe(false);
});

test("execution mutation route keeps identity and capability enforcement server-owned", async ({
  request,
}) => {
  const route = `/api/workspaces/${workspaceId}/chart/order-execution-mutations`;
  const unauthenticated = await request.post(route, { data: validInput });
  expect(unauthenticated.status()).toBe(401);
  expect(unauthenticated.headers()["server-timing"]).toMatch(
    /^session;dur=\d+\.\d, permission;dur=0\.0, rpc;dur=0\.0, total;dur=\d+\.\d$/,
  );

  const amended = await request.post(route, {
    data: validInput,
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(amended.status()).toBe(200);
  expect(amended.headers()["server-timing"]).toMatch(
    /^session;dur=\d+\.\d, permission;dur=\d+\.\d, rpc;dur=\d+\.\d, total;dur=\d+\.\d$/,
  );
  await expect(amended.json()).resolves.toMatchObject({
    ok: true,
    enforcedBy: "chart-order-execution-mutation",
    mutation: {
      action: "amend",
      confirmedSnapshotPreserved: true,
      revisionNo: 2,
    },
  });

  const legacyBillingCorrection = await request.post(route, {
    data: {
      ...validInput,
      action: "billing_correct",
      changes: { quantity: 2, unitPrice: 9000 },
      idempotencyKey: "phase5-route-billing-0001",
    },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(legacyBillingCorrection.status()).toBe(400);
  await expect(legacyBillingCorrection.json()).resolves.toMatchObject({
    ok: false,
    error: "invalid_input",
    fieldErrors: { action: expect.any(String) },
  });
});

test("mock mutation gateway replays the same command and rejects a changed request", async () => {
  const gateway = createMockChartOrderExecutionMutationGateway(
    () => "2026-08-26T00:00:00.000Z"
  );
  const first = await mutateChartOrderExecution({
    actorUserId: "user-admin",
    workspaceId,
    input: validInput,
    gateway,
  });
  const replay = await mutateChartOrderExecution({
    actorUserId: "user-admin",
    workspaceId,
    input: { ...validInput, idempotencyKey: ` ${validInput.idempotencyKey} ` },
    gateway,
  });
  const conflict = await mutateChartOrderExecution({
    actorUserId: "user-admin",
    workspaceId,
    input: {
      ...validInput,
      changes: { detailInputs: { specimenType: "plasma" } },
    },
    gateway,
  });

  expect(first).toEqual(replay);
  expect(conflict).toEqual({
    ok: false,
    status: 409,
    denialReason: "idempotency_conflict",
  });
});

test("Supabase gateway dispatches the actor-bound mutation RPC once", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          action: "re_request",
          affectedTasks: [
            { attemptNo: 2, effect: "linked_attempt_created", taskId: "task-2" },
          ],
          billingImpact: {},
          confirmedSnapshotPreserved: true,
          order: { revisionNo: 2 },
          orderId: "95000000-0000-4000-8000-000000000101",
          orderRevisionId: "95000000-0000-4000-8000-000000000201",
          revisionNo: 2,
          billingSummary: createMockChartOrderBillingSummaryFromMutationRows({
            encounterId: "00000000-0000-4000-8000-000000000003",
            etag: '"billing-re-request"',
            rows: [],
            workspaceId: "workspace-clair-cheongdam",
          }),
        },
        error: null,
      };
    },
  } as SupabaseChartOrderExecutionMutationRpcClient;
  const gateway = createSupabaseChartOrderExecutionMutationGateway(client);

  const result = await gateway.mutateOrderExecution({
    action: "re_request",
    actorUserId: "49110000-0000-4000-8000-000000000003",
    changes: {},
    expectedRevisionNo: 1,
    idempotencyKey: "phase5-rerequest-test-0001",
    orderId: "95000000-0000-4000-8000-000000000101",
    reason: "완료 결과를 보존하고 다시 요청합니다",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    ok: true,
    mutation: {
      action: "re_request",
      confirmedSnapshotPreserved: true,
      revisionNo: 2,
    },
  });
  expect(calls).toEqual([
    {
      functionName: "clair_mutate_chart_order_execution",
      args: {
        p_action: "re_request",
        p_actor_user_id: "49110000-0000-4000-8000-000000000003",
        p_changes: {},
        p_expected_revision_no: 1,
        p_idempotency_key: "phase5-rerequest-test-0001",
        p_order_id: "95000000-0000-4000-8000-000000000101",
        p_reason: "완료 결과를 보존하고 다시 요청합니다",
        p_workspace_id: "workspace-clair-cheongdam",
      },
    },
  ]);
});

test("Phase 5 SQL keeps immutable history, linked attempts, scoped RLS, and revision outbox", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260825242000_chart_order_revision_attempt_contract.sql"
    ),
    "utf8"
  );
  const route = await readFile(
    path.join(
      process.cwd(),
      "src/app/api/workspaces/[workspaceId]/chart/order-execution-mutations/route.ts"
    ),
    "utf8"
  );

  for (const contract of [
    "create or replace function public.clair_mutate_chart_order_execution",
    "set_child_independent_mutation_forbidden",
    "confirmed_snapshot_immutable",
    "re_requested_from_task_id",
    "order.execution_changed",
    "order_execution_outbox_origin_check",
    "billingCorrectionRevisionId",
    "execution_attempt_not_reopened",
    "private.clair_is_active_workspace_member",
    "private.clair_current_user_has_workspace_permission",
  ]) {
    expect(migration).toContain(contract);
  }
  expect(route).toContain("export async function POST");
  expect(route).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(route).toContain("createSupabaseChartOrderExecutionMutationGateway");
  expect(route).toContain("chart_order_execution_mutation");
});

test("Plan/Order lifecycle SQL reconfirms actual dispense into the linked attempt", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260902150055_plan_order_work_lifecycle_and_rpc_boundary.sql",
    ),
    "utf8",
  );

  for (const contract of [
    "actualDispenseQuantity",
    "actual_dispense_reconfirmation_required",
    "order_actual_dispense_overrides",
    "sourceSnapshotReconfirmed",
    "v_order.confirmed_snapshot is not distinct from (v_before -> 'confirmedSnapshot')",
  ]) {
    expect(migration).toContain(contract);
  }
});
