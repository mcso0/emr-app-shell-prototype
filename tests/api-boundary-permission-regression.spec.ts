import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { readFileSync } from "node:fs";

const workspaceId = "clair-demo";
const otherWorkspaceId = "other-workspace";

type BoundaryCase = {
  data?: Record<string, unknown>;
  expectedDenial: string;
  expectedStatus: number;
  headers?: Record<string, string>;
  method: "get" | "patch" | "post";
  name: string;
  path: string;
};

const vetHeaders = { "x-clair-demo-session-user-id": "user-vet" };
const techHeaders = { "x-clair-demo-session-user-id": "user-tech" };
const frontDeskHeaders = { "x-clair-demo-session-user-id": "user-front-desk" };

test("lab, billing, and fulfillment API boundaries deny unauthenticated and unauthorized requests", async ({
  request,
}) => {
  const cases: BoundaryCase[] = [
    {
      expectedDenial: "unauthenticated",
      expectedStatus: 401,
      method: "get",
      name: "lab result entry read requires an authenticated actor",
      path: `/api/workspaces/${workspaceId}/lab-imaging/result-entries?resultId=den459-missing`,
    },
    {
      data: {
        encounterId: "encounter-kong-260501",
        orderId: "order-kong-cbc",
        resultId: "den459-result",
        rows: [{ analyteName: "WBC", id: "den459-wbc", value: "21.4" }],
        workItemId: "19431000-0000-4000-8000-000000000001",
      },
      expectedDenial: "unauthenticated",
      expectedStatus: 401,
      method: "post",
      name: "lab result entry save requires an authenticated actor",
      path: `/api/workspaces/${workspaceId}/lab-imaging/result-entries`,
    },
    {
      expectedDenial: "unauthenticated",
      expectedStatus: 401,
      method: "get",
      name: "fulfillment queue read requires an authenticated actor",
      path: `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing`,
    },
    {
      data: { assignedToUserId: "user-front-desk", status: "accepted" },
      expectedDenial: "permission_missing",
      expectedStatus: 403,
      headers: frontDeskHeaders,
      method: "patch",
      name: "front desk cannot mutate fulfillment work items",
      path: `/api/workspaces/${workspaceId}/fulfillment/work-items/fulfill-order-coco-maropitant`,
    },
    {
      expectedDenial: "workspace_membership_missing",
      expectedStatus: 403,
      headers: techHeaders,
      method: "get",
      name: "fulfillment read is scoped to the actor workspace membership",
      path: `/api/workspaces/${otherWorkspaceId}/fulfillment/work-items?queueType=dispensing`,
    },
    {
      expectedDenial: "unauthenticated",
      expectedStatus: 401,
      method: "get",
      name: "billing invoice-line read requires an authenticated actor",
      path: `/api/workspaces/${workspaceId}/billing/invoice-lines?invoiceId=invoice-kong-260501`,
    },
    {
      data: {
        action: "complete_payment",
        invoiceId: "invoice-kong-260501",
        paymentMethod: "card",
      },
      expectedDenial: "permission_missing",
      expectedStatus: 403,
      headers: vetHeaders,
      method: "patch",
      name: "veterinarian cannot mutate payment status",
      path: `/api/workspaces/${workspaceId}/billing/payment-status`,
    },
    {
      data: {
        invoiceIds: ["invoice-kong-260501"],
        paymentMethod: "card",
      },
      expectedDenial: "workspace_membership_missing",
      expectedStatus: 403,
      headers: vetHeaders,
      method: "post",
      name: "non-member actor cannot prepare guardian checkout",
      path: `/api/workspaces/${workspaceId}/billing/guardian-checkout`,
    },
  ];

  for (const boundaryCase of cases) {
    await test.step(boundaryCase.name, async () => {
      const response = await sendBoundaryRequest(request, boundaryCase);
      expect(response.status(), boundaryCase.name).toBe(boundaryCase.expectedStatus);
      await expectJson(response, {
        ok: false,
        denialReason: boundaryCase.expectedDenial,
      });
    });
  }
});

test("permission boundary source stays server-side for connected demo APIs", () => {
  const labResultRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts",
    "utf8",
  );
  const fulfillmentReadRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/fulfillment/work-items/route.ts",
    "utf8",
  );
  const fulfillmentMutationRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]/route.ts",
    "utf8",
  );
  const billingPaymentRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/billing/payment-status/route.ts",
    "utf8",
  );

  for (const source of [
    labResultRoute,
    fulfillmentReadRoute,
    fulfillmentMutationRoute,
    billingPaymentRoute,
  ]) {
    expect(source).toContain("readServerSession");
    expect(source).toContain("resolveRoleUpdateActorIdentity");
    expect(source).not.toMatch(/localStorage|sessionStorage|window\./);
  }

  expect(labResultRoute).toContain('requiredPermission: "lab:view"');
  expect(labResultRoute).toContain('requiredPermission: "lab:complete"');
  expect(fulfillmentReadRoute).toContain("readFulfillmentWorkItems");
  expect(fulfillmentMutationRoute).toContain("updateFulfillmentWorkItem");
  expect(billingPaymentRoute).toContain("saveBillingPaymentStatus");
});

async function sendBoundaryRequest(
  request: APIRequestContext,
  boundaryCase: BoundaryCase,
) {
  const options = {
    data: boundaryCase.data,
    headers: boundaryCase.headers,
  };

  if (boundaryCase.method === "get") {
    return request.get(boundaryCase.path, { headers: boundaryCase.headers });
  }

  if (boundaryCase.method === "post") {
    return request.post(boundaryCase.path, options);
  }

  return request.patch(boundaryCase.path, options);
}

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
