import { expect, test } from "@playwright/test";

const workspaceId = "clair-demo";

test("lab result entry save emits scoped clinical-result notification for veterinarian review", async ({
  request,
}) => {
  const clientSessionId = "lab-result-entry-clinical-notification";
  const resultId = "lab-result-kong-cbc-notification";
  const orderId = "order-kong-cbc";

  const saved = await request.post(
    `/api/workspaces/${workspaceId}/lab-imaging/result-entries`,
    {
      data: {
        encounterId: "encounter-kong-260501",
        orderId,
        resultId,
        rows: [
          {
            analyteName: "WBC",
            id: "row-wbc",
            judgment: "high",
            referenceRange: "6.0-17.0",
            unit: "K/uL",
            value: "19.2",
          },
        ],
        workItemId: `fulfill-${orderId}`,
      },
      headers: {
        "x-clair-demo-client-session-id": clientSessionId,
        "x-clair-demo-session-user-id": "user-tech",
      },
    },
  );

  expect(saved.status()).toBe(200);
  await expectJson(saved, {
    ok: true,
    emittedNotifications: { clinicalResultCompleted: 1 },
    enforcedBy: "lab-result-entry-server-boundary",
  });

  const vetFeed = await request.get(
    `/api/workspaces/${workspaceId}/notifications?filter=all&limit=50`,
    {
      headers: {
        "x-clair-demo-client-session-id": clientSessionId,
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );

  expect(vetFeed.status()).toBe(200);
  const vetBody = (await vetFeed.json()) as {
    ok: true;
    counts: { badge: number; unread: number };
    notifications: Array<{
      badgeCount: boolean;
      detail: string;
      eventKey: string;
      sourceEntityId: string | null;
      sourceRoute: string | null;
      title: string;
    }>;
  };
  expect(vetBody.notifications).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        badgeCount: true,
        eventKey: "clinical_result_completed",
        sourceEntityId: resultId,
        sourceRoute: `/w/${workspaceId}/lab?modulePanel=open&labResultId=${resultId}`,
      }),
    ]),
  );
  const emitted = vetBody.notifications.find(
    (notification) =>
      notification.eventKey === "clinical_result_completed" &&
      notification.sourceEntityId === resultId,
  );
  expect(emitted?.title).toContain("검사 결과가 도착했습니다");
  expect(emitted?.detail).not.toContain("19.2");
  expect(vetBody.counts.badge).toBeGreaterThanOrEqual(1);

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
        eventKey: "clinical_result_completed",
        sourceEntityId: resultId,
      }),
    ]),
  );
});

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  expect(await response.json()).toMatchObject(expected);
}
