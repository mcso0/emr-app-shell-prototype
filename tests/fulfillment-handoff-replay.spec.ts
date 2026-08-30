import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";

import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";
const a3Migration = readFileSync(
  "supabase/migrations/20260819150622_clinical_master_phase1a3_order_authority.sql",
  "utf8",
);

const replayOrders = [
  { orderId: "order-kong-cbc", queueType: "lab", expectedLineTotal: 35000 },
  { orderId: "order-kong-abdomen", queueType: "imaging", expectedLineTotal: 77000 },
  { orderId: "order-kong-maropitant", queueType: "dispensing", expectedLineTotal: 4500 },
  { orderId: "order-kong-fluid", queueType: "treatment", expectedLineTotal: 18000 },
] as const;

test("A3 fulfillment handoff freezes source snapshots and omits the enrichment writer", () => {
  expect(a3Migration).toContain("frozenOrderSnapshot");
  expect(a3Migration).toContain("on conflict (workspace_id, order_id)");
  expect(a3Migration).toContain("assigned_to_user_id = excluded.assigned_to_user_id");
  expect(a3Migration).not.toContain(
    "create or replace function public.clair_enrich_fulfillment_work_item_snapshots",
  );
});

test("fulfillment handoff replays chart confirmation through queues, lifecycle, and billing", async ({
  request,
}) => {
  const currentEtag = await readChartActionEtag(request);
  const confirmed = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: {
      action: "confirm",
      encounterId,
      expectedEtag: currentEtag,
      idempotencyKey: "fulfillment-replay-confirm-1",
      orderIds: replayOrders.map((order) => order.orderId),
    },
    headers: {
      [chartOrderExpectedEtagHeader]: currentEtag,
      "x-clair-demo-session-user-id": "user-vet",
    },
  });
  expect(confirmed.status()).toBe(200);
  const confirmedBody = await confirmed.json() as {
    ok: true;
    confirmationCommandId?: string;
    queueProjectionIds?: string[];
    tasks?: unknown[];
  };
  expect(confirmedBody).toMatchObject({
    confirmationCommandId: "fulfillment-replay-confirm-1",
    queueProjectionIds: [],
    tasks: [],
  });

  const retryEtag = await readChartActionEtag(request);
  const confirmedAgain = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: {
      action: "confirm",
      encounterId,
      expectedEtag: retryEtag,
      idempotencyKey: "fulfillment-replay-confirm-2",
      orderIds: replayOrders.map((order) => order.orderId),
    },
    headers: {
      [chartOrderExpectedEtagHeader]: retryEtag,
      "x-clair-demo-session-user-id": "user-vet",
    },
  });
  expect(confirmedAgain.status()).toBe(200);

  const directCompleteDeniedWorkItem = await readWorkItem(request, "dispensing", "order-kong-maropitant");
  const directCompleteDenied = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${directCompleteDeniedWorkItem.id}`,
    {
      data: { status: "completed" },
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    }
  );
  if (directCompleteDeniedWorkItem.status === "requested" || directCompleteDeniedWorkItem.status === "accepted") {
    expect(directCompleteDenied.status()).toBe(409);
    await expectJson(directCompleteDenied, { ok: false, denialReason: "invalid_transition" });
  } else {
    expect(directCompleteDenied.status()).toBe(200);
  }

  for (const replayOrder of replayOrders) {
    const workItem = await readWorkItem(request, replayOrder.queueType, replayOrder.orderId);
    const completedBody = await advanceWorkItemToCompleted(request, workItem.id, workItem.status);
    if (replayOrder.queueType === "lab" || replayOrder.queueType === "imaging") {
      expect(completedBody.downstreamSync).toMatchObject({
        billingCandidateCount: 0,
        billingSkippedReason: "vet_review_required",
        lifecycleStatus: "completed",
      });
    }
  }

  const lifecycleReadBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-lifecycle?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(lifecycleReadBack.status()).toBe(200);
  const lifecycleBody = await lifecycleReadBack.json() as {
    ok: true;
    lifecycles: Array<{ orderId: string; status: string }>;
  };
  for (const replayOrder of replayOrders) {
    expect(lifecycleBody.lifecycles.find((row) => row.orderId === replayOrder.orderId)?.status).toBe("completed");
  }

  const billingReadBack = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(billingReadBack.status()).toBe(200);
  const billingBody = await billingReadBack.json() as {
    ok: true;
    candidates: Array<{ lineTotal: number; orderId: string }>;
  };
  for (const replayOrder of replayOrders.filter(
    (order) => order.queueType === "dispensing" || order.queueType === "treatment",
  )) {
    expect(billingBody.candidates.find((candidate) => candidate.orderId === replayOrder.orderId)).toMatchObject({
      lineTotal: replayOrder.expectedLineTotal,
    });
  }
  const reviewed = await request.patch(
    `/api/workspaces/${workspaceId}/chart/result-review-billing`,
    {
      data: {
        encounterId,
        orderIds: replayOrders
          .filter((order) => order.queueType === "lab" || order.queueType === "imaging")
          .map((order) => order.orderId),
      },
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    }
  );
  expect(reviewed.status()).toBe(200);
  const reviewedBody = await reviewed.json() as {
    ok: true;
    billingCandidates: Array<{ orderId: string }>;
    enforcedBy: string;
  };
  expect(reviewedBody.enforcedBy).toBe("fulfillment-vet-review-billing-gate");
  expect(reviewedBody.billingCandidates.map((candidate) => candidate.orderId).sort()).toEqual(
    ["order-kong-abdomen", "order-kong-cbc"]
  );

  const billingAfterReview = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(billingAfterReview.status()).toBe(200);
  const billingAfterReviewBody = await billingAfterReview.json() as {
    ok: true;
    candidates: Array<{ lineTotal: number; orderId: string }>;
  };
  for (const replayOrder of replayOrders) {
    expect(billingAfterReviewBody.candidates.find((candidate) => candidate.orderId === replayOrder.orderId)).toMatchObject({
      lineTotal: replayOrder.expectedLineTotal,
    });
  }
});

test("fulfillment handoff replay keeps tenant and role boundaries closed", async ({ request }) => {
  const currentEtag = await readChartActionEtag(request);
  const frontDeskDenied = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: {
      action: "confirm",
      encounterId,
      expectedEtag: currentEtag,
      idempotencyKey: "fulfillment-replay-frontdesk-denied",
      orderIds: ["order-kong-fluid"],
    },
    headers: {
      [chartOrderExpectedEtagHeader]: currentEtag,
      "x-clair-demo-session-user-id": "user-front-desk",
    },
  });
  expect(frontDeskDenied.status()).toBe(403);
  await expectJson(frontDeskDenied, { ok: false, denialReason: "permission_missing" });

  const otherWorkspaceDenied = await request.patch(`/api/workspaces/other-workspace/chart/order-actions`, {
    data: {
      action: "confirm",
      encounterId,
      expectedEtag: currentEtag,
      idempotencyKey: "fulfillment-replay-foreign-denied",
      orderIds: ["order-kong-fluid"],
    },
    headers: {
      [chartOrderExpectedEtagHeader]: currentEtag,
      "x-clair-demo-session-user-id": "user-vet",
    },
  });
  expect(otherWorkspaceDenied.status()).toBe(403);
  await expectJson(otherWorkspaceDenied, { ok: false, denialReason: "workspace_membership_missing" });
});

async function readChartActionEtag(request: APIRequestContext) {
  const response = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-actions?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok: true; etag: string };
  expect(body.etag).toMatch(/^"[0-9a-f]{64}"$/);
  return body.etag;
}

async function readWorkItem(
  request: APIRequestContext,
  queueType: typeof replayOrders[number]["queueType"],
  orderId: string
) {
  const response = await request.get(
    `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=${queueType}&encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(response.status()).toBe(200);
  const body = await response.json() as {
    ok: true;
    workItems: Array<{ id: string; orderId: string; status: string }>;
  };
  const matches = body.workItems.filter((item) => item.orderId === orderId);
  expect(matches).toHaveLength(1);
  return matches[0];
}

async function advanceWorkItemToCompleted(
  request: APIRequestContext,
  workItemId: string,
  initialStatus: string
) {
  const statuses = initialStatus === "requested"
    ? ["accepted", "in_progress", "completed"]
    : initialStatus === "accepted"
      ? ["in_progress", "completed"]
      : ["completed"];

  for (const status of statuses) {
    const response = await request.patch(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
      {
        data: { status, assignedToUserId: "user-tech" },
        headers: { "x-clair-demo-session-user-id": "user-tech" },
      }
    );
    expect(response.status()).toBe(200);
    if (status === "completed") {
      return await response.json() as {
        downstreamSync?: {
          billingCandidateCount: number;
          billingSkippedReason?: string;
          lifecycleStatus?: string;
        };
        ok: true;
      };
    }
  }
  throw new Error("completion status was not reached");
}

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
