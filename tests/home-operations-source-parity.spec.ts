import { expect, test, type APIRequestContext } from "@playwright/test";

const workspaceId = "clair-demo";
const operatingDate = "2026-05-01";
const encounterId = "encounter-kong-260501";

const frontDeskHeaders = { "x-clair-demo-session-user-id": "user-front-desk" };
const vetHeaders = { "x-clair-demo-session-user-id": "user-vet" };
const techHeaders = { "x-clair-demo-session-user-id": "user-tech" };
const adminHeaders = { "x-clair-demo-session-user-id": "user-admin" };

const replayOrders = [
  { orderId: "order-kong-cbc", queueType: "lab", expectedBadge: "CBC 검사" },
  { orderId: "order-kong-abdomen", queueType: "imaging", expectedBadge: "영상" },
  { orderId: "order-kong-maropitant", queueType: "dispensing", expectedBadge: "조제" },
  { orderId: "order-kong-fluid", queueType: "treatment", expectedBadge: "처치" },
] as const;

test("source-created work appears in Home operations with the source queue card contract", async ({
  request,
}) => {
  const appointment = await request.post(
    `/api/workspaces/${workspaceId}/reception/appointments`,
    {
      data: {
        assignedVeterinarianId: "user-vet-doyun",
        durationMinutes: 20,
        guardianId: "guardian-jung-harin",
        patientId: "patient-dubu",
        reservationMemo: "HOME-PR-012 예약 source parity",
        scheduledStartAt: `${operatingDate}T12:20:00+09:00`,
      },
      headers: frontDeskHeaders,
    },
  );
  expect(appointment.status()).toBe(201);
  const appointmentBody = await appointment.json() as {
    appointment: { id: string };
    ok: true;
  };

  const confirmed = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    {
      data: {
        action: "confirm",
        encounterId,
        orderIds: replayOrders.map((order) => order.orderId),
      },
      headers: vetHeaders,
    },
  );
  expect(confirmed.status()).toBe(200);
  const confirmedBody = await confirmed.json() as {
    fulfillmentWorkItems?: Array<{ id: string; orderId: string; queueType: string }>;
    ok: true;
  };
  expect(confirmedBody.fulfillmentWorkItems).toEqual(
    expect.arrayContaining(
      replayOrders.map((order) =>
        expect.objectContaining({
          orderId: order.orderId,
          queueType: order.queueType,
        }),
      ),
    ),
  );

  const sourceWorkItems = await Promise.all(
    replayOrders.map((order) => readSourceWorkItem(request, order.queueType, order.orderId)),
  );

  const billing = await request.patch(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates`,
    {
      data: {
        encounterId,
        orderIds: replayOrders.map((order) => order.orderId),
      },
      headers: techHeaders,
    },
  );
  expect(billing.status()).toBe(200);
  const billingBody = await billing.json() as {
    candidates: Array<{ invoiceId: string; orderId: string }>;
    ok: true;
  };
  expect(billingBody.candidates.map((candidate) => candidate.orderId).sort()).toEqual(
    replayOrders.map((order) => order.orderId).sort(),
  );

  const home = await request.get(
    `/api/workspaces/${workspaceId}/operations/work-items?date=${operatingDate}&scope=all`,
    { headers: adminHeaders },
  );
  expect(home.status()).toBe(200);
  const homeBody = await home.json() as {
    items: Array<Record<string, unknown>>;
    ok: true;
    sourceStatus: string;
  };
  expect(homeBody.ok).toBe(true);
  expect(homeBody.sourceStatus).toBe("live");

  const appointmentItem = findHomeItem(homeBody.items, "appointment", appointmentBody.appointment.id);
  expect(appointmentItem).toMatchObject({
    patientName: "두부",
    queueCardSecondLineText: "HOME-PR-012 예약 source parity",
    receptionType: "예약",
    sourceType: "appointment",
  });
  expect(appointmentItem.queueCardEventText).toContain("예약");

  for (const [index, sourceWorkItem] of sourceWorkItems.entries()) {
    const replayOrder = replayOrders[index];
    const homeItem = findHomeItem(homeBody.items, replayOrder.queueType, sourceWorkItem.id);
    const sourceSnapshot = sourceWorkItem.sourceSnapshot as Record<string, unknown>;
    expect(homeItem).toMatchObject({
      patientName: sourceSnapshot.patientName,
      queueCardSecondLineBadgeLabel: replayOrder.expectedBadge,
      queueCardSecondLineText: sourceSnapshot.orderDisplayName,
      sourceId: sourceWorkItem.id,
      sourceType: replayOrder.queueType,
      title: sourceSnapshot.orderDisplayName,
    });
  }

  const billingItem = findHomeItem(homeBody.items, "billing", "invoice-kong-260501");
  expect(billingItem).toMatchObject({
    patientName: "콩이",
    requesterName: "수납",
    sourceType: "billing",
    teamQueueLabel: "수납팀 큐",
  });
  expect(String(billingItem.queueCardSecondLineText)).toContain("오더");
});

async function readSourceWorkItem(
  request: APIRequestContext,
  queueType: typeof replayOrders[number]["queueType"],
  orderId: string,
) {
  const response = await request.get(
    `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=${queueType}&encounterId=${encounterId}&orderId=${orderId}`,
    { headers: techHeaders },
  );
  expect(response.status()).toBe(200);
  const body = await response.json() as {
    ok: true;
    workItems: Array<{
      id: string;
      sourceSnapshot: Record<string, unknown>;
    }>;
  };
  expect(body.workItems).toHaveLength(1);
  return body.workItems[0];
}

function findHomeItem(
  items: Array<Record<string, unknown>>,
  sourceType: string,
  sourceId: string,
) {
  const item = items.find(
    (candidate) =>
      candidate.sourceType === sourceType &&
      candidate.sourceId === sourceId,
  );
  expect(item, `${sourceType}:${sourceId} should appear in Home operations`).toBeTruthy();
  return item!;
}
