import { expect, test, type APIRequestContext } from "@playwright/test";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";

const replayOrders = [
  { orderId: "order-kong-cbc", queueType: "lab", expectedLineTotal: 35000 },
  { orderId: "order-kong-abdomen", queueType: "imaging", expectedLineTotal: 77000 },
  { orderId: "order-kong-maropitant", queueType: "dispensing", expectedLineTotal: 4500 },
  { orderId: "order-kong-fluid", queueType: "treatment", expectedLineTotal: 18000 },
] as const;

test("fulfillment handoff replays chart confirmation through queues, lifecycle, and billing", async ({
  request,
}) => {
  const confirmed = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: { action: "confirm", encounterId, orderIds: replayOrders.map((order) => order.orderId) },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(confirmed.status()).toBe(200);
  const confirmedBody = await confirmed.json() as {
    ok: true;
    fulfillmentWorkItems?: Array<{ id: string; orderId: string; queueType: string }>;
  };
  expect(confirmedBody.fulfillmentWorkItems).toEqual(expect.arrayContaining(
    replayOrders.map((order) => expect.objectContaining({
      orderId: order.orderId,
      queueType: order.queueType,
    }))
  ));

  const confirmedAgain = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: { action: "confirm", encounterId, orderIds: replayOrders.map((order) => order.orderId) },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
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
  expect(directCompleteDenied.status()).toBe(409);
  await expectJson(directCompleteDenied, { ok: false, denialReason: "invalid_transition" });

  for (const replayOrder of replayOrders) {
    const workItem = await readWorkItem(request, replayOrder.queueType, replayOrder.orderId);
    await advanceWorkItemToCompleted(request, workItem.id, workItem.status);
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
  for (const replayOrder of replayOrders) {
    expect(billingBody.candidates.find((candidate) => candidate.orderId === replayOrder.orderId)).toMatchObject({
      lineTotal: replayOrder.expectedLineTotal,
    });
  }
});

test("fulfillment handoff replay keeps tenant and role boundaries closed", async ({ request }) => {
  const frontDeskDenied = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: { action: "confirm", encounterId, orderIds: ["order-kong-fluid"] },
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(frontDeskDenied.status()).toBe(403);
  await expectJson(frontDeskDenied, { ok: false, denialReason: "permission_missing" });

  const otherWorkspaceDenied = await request.patch(`/api/workspaces/other-workspace/chart/order-actions`, {
    data: { action: "confirm", encounterId, orderIds: ["order-kong-fluid"] },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(otherWorkspaceDenied.status()).toBe(403);
  await expectJson(otherWorkspaceDenied, { ok: false, denialReason: "workspace_membership_missing" });
});

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
  }
}

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
