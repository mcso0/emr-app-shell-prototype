import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartOrderExecutionReadGateway,
  createSupabaseChartOrderExecutionReadGateway,
  mapChartOrderExecutionReadModel,
  readChartOrderExecution,
  type ChartOrderExecutionReadModel,
  type SupabaseChartOrderExecutionReadRpcClient,
} from "../src/features/chart/server-order-execution-read-model-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";

const validExecution: ChartOrderExecutionReadModel = {
  workspaceId,
  encounterId,
  tasks: [
    {
      taskId: "task-1",
      orderId: "order-1",
      parentTaskId: null,
      taskRole: "execution",
      clinicalOrderType: "clinical_lab",
      destinationModule: "lab",
      status: "in_progress",
      assignedToUserId: null,
      assignedToDisplayName: null,
      assignedByUserId: null,
      assignedAt: null,
      priority: "urgent",
      attemptNo: 1,
      requestCycle: 1,
      reRequestedFromTaskId: null,
      effectiveSnapshot: { orderName: "CBC" },
      resultSnapshot: null,
      detailedPhase: null,
      pausedFromPhase: null,
      rowRevision: 1,
      startedByUserId: null,
      startedAt: "2026-08-26T00:01:00.000Z",
      completedAt: null,
      returnedAt: null,
      cancelledAt: null,
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:01:00.000Z",
    },
  ],
  events: [
    {
      eventId: "event-1",
      taskId: "task-1",
      taskAttemptNo: 1,
      orderId: "order-1",
      eventType: "started",
      actorUserId: "user-vet",
      reason: null,
      beforeValues: { status: "pending" },
      afterValues: { status: "in_progress" },
      commandId: "command-1",
      lifecycleCommandId: null,
      createdAt: "2026-08-26T00:01:00.000Z",
    },
  ],
  revisions: [],
  queues: [
    {
      workItemId: "queue-1",
      orderId: "order-1",
      taskId: "task-1",
      taskAttemptNo: 1,
      destinationModule: "lab",
      queueType: "lab",
      queueStatus: "in_progress",
      assignedToUserId: null,
      detailedPhase: null,
      requestCycle: 1,
      rowRevision: 1,
      updatedAt: "2026-08-26T00:01:00.000Z",
    },
  ],
  billingCandidates: [
    {
      billingCandidateId: "billcand-order-1",
      orderId: "order-1",
      taskId: "task-1",
      taskAttemptNo: 1,
      status: "candidate_created",
      amount: 45000,
      invoiceLineId: null,
      updatedAt: "2026-08-26T00:00:00.000Z",
    },
  ],
  reconciliation: {
    aggregateQueueCount: 0,
    confirmedAtomicCount: 1,
    destinationlessQueueCount: 0,
    draftArtifactCount: 0,
    duplicateBillingCandidateCount: 0,
    duplicateQueueCount: 0,
    duplicateTaskCount: 0,
    executionTaskCount: 1,
    missingTaskCount: 0,
    orphanBillingCandidateCount: 0,
    orphanQueueCount: 0,
    orphanTaskCount: 0,
  },
};

test("chart execution read model requires chart:view in the exact workspace", async () => {
  const permissionAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-vet", status: "active" }],
    memberships: [
      {
        id: "membership-other",
        workspaceId: "other-workspace",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
  let gatewayCalls = 0;
  const result = await readChartOrderExecution({
    actorUserId: "user-vet",
    workspaceId,
    encounterId,
    permissionAdapter,
    gateway: {
      async readExecution() {
        gatewayCalls += 1;
        return { ok: true, execution: validExecution };
      },
    },
  });

  expect(result).toEqual({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
  expect(gatewayCalls).toBe(0);
});

test("read model preserves the Order -> Task -> Queue/Billing trace", async () => {
  const result = await readChartOrderExecution({
    actorUserId: "user-vet",
    workspaceId,
    encounterId,
    gateway: createMockChartOrderExecutionReadGateway(validExecution),
  });

  expect(result).toMatchObject({
    ok: true,
    enforcedBy: "chart-order-execution-read-model",
    execution: {
      tasks: [{ taskId: "task-1", orderId: "order-1" }],
      queues: [{ taskId: "task-1", orderId: "order-1" }],
      billingCandidates: [{ taskId: "task-1", orderId: "order-1" }],
      reconciliation: { missingTaskCount: 0, orphanQueueCount: 0 },
    },
  });
});

test("Supabase read gateway validates the complete RPC envelope", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return { data: validExecution, error: null };
    },
  } as SupabaseChartOrderExecutionReadRpcClient;
  const gateway = createSupabaseChartOrderExecutionReadGateway(client);

  await expect(gateway.readExecution({ workspaceId, encounterId })).resolves.toEqual({
    ok: true,
    execution: validExecution,
  });
  expect(calls).toEqual([
    {
      functionName: "clair_get_chart_order_execution_read_model",
      args: { p_encounter_id: encounterId, p_workspace_id: workspaceId },
    },
  ]);
  expect(
    mapChartOrderExecutionReadModel({
      ...validExecution,
      tasks: [{ ...validExecution.tasks[0], destinationModule: "foreign" }],
    }),
  ).toBeNull();
});

test("order execution read route keeps identity and workspace enforcement server-owned", async ({
  request,
}) => {
  const route = `/api/workspaces/${workspaceId}/chart/order-execution?encounterId=${encounterId}`;
  const unauthenticated = await request.get(route);
  expect(unauthenticated.status()).toBe(401);

  const allowed = await request.get(route, {
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(allowed.status()).toBe(200);
  await expect(allowed.json()).resolves.toMatchObject({
    ok: true,
    enforcedBy: "chart-order-execution-read-model",
    execution: { workspaceId, encounterId },
  });
});

test("Phase 8 SQL exposes scoped history and all reconciliation invariants", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260825243000_chart_order_downstream_read_models.sql",
    ),
    "utf8",
  );
  const route = await readFile(
    path.join(
      process.cwd(),
      "src/app/api/workspaces/[workspaceId]/chart/order-execution/route.ts",
    ),
    "utf8",
  );

  for (const contract of [
    "clair_get_chart_order_execution_read_model",
    "private.clair_is_active_workspace_member",
    "private.clair_current_user_has_workspace_permission",
    "'chart:view'",
    "'billing:view'",
    "'missingTaskCount'",
    "'duplicateTaskCount'",
    "'duplicateQueueCount'",
    "'duplicateBillingCandidateCount'",
    "'destinationlessQueueCount'",
    "'aggregateQueueCount'",
    "'orphanTaskCount'",
    "'orphanQueueCount'",
    "'orphanBillingCandidateCount'",
    "'draftArtifactCount'",
  ]) {
    expect(migration).toContain(contract);
  }
  expect(route).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(route).toContain("createSupabaseChartOrderExecutionReadGateway");
});
