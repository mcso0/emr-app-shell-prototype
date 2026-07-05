import { expect, test } from "@playwright/test";

const workspaceId = "clair-demo";

test("order recheck request emits scoped role-queue notification for target clinical staff", async ({
  request,
}) => {
  const clientSessionId = "order-recheck-request-notification";
  const orderId = "order-kong-cbc-recheck";
  const sourceRoute = `/w/${workspaceId}/lab?modulePanel=open&orderId=${orderId}`;

  const created = await request.post(
    `/api/workspaces/${workspaceId}/notifications/order-recheck-requests`,
    {
      data: {
        orderLabel: "CBC 검체",
        patientLabel: "콩이",
        reason: "검체 상태와 장비 flag",
        recipient: {
          kind: "role_queue",
          id: "lab",
          label: "임상병리검사",
        },
        requesterLabel: "담당 수의사",
        requesterRoleLabel: "수의사",
        sourceDomain: "lab",
        sourceEntityId: orderId,
        sourceKind: "order",
        sourceRoute,
      },
      headers: {
        "x-clair-demo-client-session-id": clientSessionId,
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );

  expect(created.status()).toBe(200);
  await expectJson(created, {
    ok: true,
    emittedNotifications: { orderRecheckRequested: 1 },
    enforcedBy: "order-recheck-request-notification-boundary",
  });

  const labFeed = await request.get(
    `/api/workspaces/${workspaceId}/notifications?filter=all&limit=50`,
    {
      headers: {
        "x-clair-demo-client-session-id": clientSessionId,
        "x-clair-demo-session-user-id": "user-tech",
      },
    },
  );

  expect(labFeed.status()).toBe(200);
  const labBody = (await labFeed.json()) as {
    ok: true;
    counts: { badge: number };
    notifications: Array<{
      detail: string;
      eventKey: string;
      sourceEntityId: string | null;
      sourceRoute: string | null;
      title: string;
    }>;
  };
  expect(labBody.notifications).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        eventKey: "order_recheck_requested",
        sourceEntityId: orderId,
        sourceRoute,
      }),
    ]),
  );
  const emitted = labBody.notifications.find(
    (notification) =>
      notification.eventKey === "order_recheck_requested" &&
      notification.sourceEntityId === orderId,
  );
  expect(emitted?.title).toContain("CBC 검체 재확인을 진행해 주세요");
  expect(emitted?.detail).toContain("검체 상태와 장비 flag");
  expect(labBody.counts.badge).toBeGreaterThanOrEqual(1);

  const deskFeed = await request.get(
    `/api/workspaces/${workspaceId}/notifications?filter=all&limit=50`,
    {
      headers: {
        "x-clair-demo-client-session-id": clientSessionId,
        "x-clair-demo-session-user-id": "user-front-desk",
      },
    },
  );

  expect(deskFeed.status()).toBe(200);
  const deskBody = (await deskFeed.json()) as {
    ok: true;
    notifications: Array<{ eventKey: string; sourceEntityId: string | null }>;
  };
  expect(deskBody.notifications).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        eventKey: "order_recheck_requested",
        sourceEntityId: orderId,
      }),
    ]),
  );
});

test("order recheck request denies non-clinical requester", async ({ request }) => {
  const denied = await request.post(
    `/api/workspaces/${workspaceId}/notifications/order-recheck-requests`,
    {
      data: {
        orderLabel: "CBC 검체",
        reason: "검체 상태",
        recipient: { kind: "role_queue", id: "lab", label: "임상병리검사" },
        sourceDomain: "lab",
        sourceEntityId: "order-denied-recheck",
        sourceKind: "order",
        sourceRoute: `/w/${workspaceId}/lab?modulePanel=open&orderId=order-denied-recheck`,
      },
      headers: {
        "x-clair-demo-client-session-id": "order-recheck-request-denied",
        "x-clair-demo-session-user-id": "user-front-desk",
      },
    },
  );

  expect(denied.status()).toBe(403);
  await expectJson(denied, {
    ok: false,
    denialReason: "permission_missing",
  });
});

test("order recheck request denies unavailable direct-user recipient", async ({
  request,
}) => {
  const denied = await request.post(
    `/api/workspaces/${workspaceId}/notifications/order-recheck-requests`,
    {
      data: {
        orderLabel: "CBC 검체",
        reason: "검체 상태",
        recipient: {
          kind: "user",
          id: "user-not-in-workspace",
          label: "미등록 담당자",
        },
        requesterLabel: "담당 수의사",
        sourceDomain: "lab",
        sourceEntityId: "order-unavailable-recipient-recheck",
        sourceKind: "order",
        sourceRoute: `/w/${workspaceId}/lab?modulePanel=open&orderId=order-unavailable-recipient-recheck`,
      },
      headers: {
        "x-clair-demo-client-session-id": "order-recheck-recipient-denied",
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );

  expect(denied.status()).toBe(400);
  await expectJson(denied, {
    ok: false,
    error: "recipient_unavailable",
  });
});

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  expect(await response.json()).toMatchObject(expected);
}
