import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartOrderActionGateway,
  createSupabaseChartOrderActionGateway,
  saveChartOrderAction,
} from "../src/features/chart/server-order-action-persistence-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";
const orderId = "order-kong-maropitant";
const migrationPath = "supabase/migrations/20260519220000_chart_order_action_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const validConfirmInput = {
  action: "confirm" as const,
  encounterId,
  orderIds: [orderId],
};

test("order action route confirms selected orders via mock fallback and reads after save", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    { data: validConfirmInput }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const saved = await request.patch(`/api/workspaces/${workspaceId}/chart/order-actions`, {
    data: validConfirmInput,
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json() as {
    ok: true;
    fulfillmentWorkItems?: Array<{
      id: string;
      orderId: string;
      queueType: string;
      sourceSnapshot: { orderDisplayName: string };
      status: string;
    }>;
    orderActions: Array<{
      billingCandidateStatus: string;
      confirmedAt?: string;
      confirmedByUserId?: string;
      orderConfirmationStatus: string;
      orderId: string;
      status: string;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("chart-order-action-persistence");
  expect(savedBody.orderActions).toEqual(expect.arrayContaining([
    expect.objectContaining({
      billingCandidateStatus: "not_requested",
      confirmedByUserId: "user-vet",
      orderConfirmationStatus: "confirmed",
      orderId,
      status: "confirmed",
    }),
  ]));
  expect(savedBody.orderActions[0]?.confirmedAt).toBeTruthy();
  expect(savedBody.fulfillmentWorkItems).toEqual([
    expect.objectContaining({
      id: `fulfill-${orderId}`,
      orderId,
      queueType: "dispensing",
      sourceSnapshot: expect.objectContaining({
        orderDisplayName: "Maropitant 16mg T",
      }),
      status: "requested",
    }),
  ]);

  const fulfillmentRead = await request.get(
    `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing&encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(fulfillmentRead.status()).toBe(200);
  const fulfillmentReadBody = await fulfillmentRead.json() as {
    ok: true;
    workItems: Array<{ id: string; orderId: string }>;
  };
  expect(fulfillmentReadBody.workItems).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: `fulfill-${orderId}`, orderId }),
  ]));

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-actions?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as {
    ok: true;
    orderActions: Array<{ orderConfirmationStatus: string; orderId: string }>;
  };
  expect(readBody.orderActions.find((row) => row.orderId === orderId)?.orderConfirmationStatus).toBe("confirmed");
});

test("order action core submits billing candidates separately from confirmation", async () => {
  const gateway = createMockChartOrderActionGateway(undefined, () => "2026-05-19T16:00:00.000Z");
  const result = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "bill",
      encounterId,
      orderIds: [orderId],
    },
    gateway,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(result.ok ? result.orderActions : []).toEqual(expect.arrayContaining([
    expect.objectContaining({
      billingCandidateId: `billcand-${orderId}`,
      billingCandidateStatus: "candidate_created",
      orderConfirmationStatus: "draft",
      orderId,
      updatedAt: "2026-05-19T16:00:00.000Z",
    }),
  ]));
  expect(result.ok ? result.fulfillmentWorkItems : undefined).toBeUndefined();
});

test("order action core rejects missing order ids, permission gaps, and encounter scope mismatches", async () => {
  const invalid = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: { action: "confirm", encounterId, orderIds: [] },
  });
  expect(invalid).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { orderIds: "오더를 선택해 주세요." },
  });

  const frontDeskDenied = await saveChartOrderAction({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validConfirmInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-front-desk",
          workspaceId,
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
  });
  expect(frontDeskDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: validConfirmInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet-other",
          workspaceId: "other-workspace",
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
  });
  expect(crossWorkspaceDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_unavailable",
  });
});

test("order action Supabase gateway keeps action, actor, workspace, encounter, and selected orders in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartOrderActionGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_action ?? "read"}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id ?? "read"}`);
      return {
        data: [
          {
            billingCandidateId: "billcand-00000000-0000-4000-8000-000000000301",
            billingCandidateStatus: "candidate_created",
            confirmedAt: null,
            confirmedByUserId: null,
            encounterId,
            orderConfirmationStatus: "draft",
            orderId: "00000000-0000-4000-8000-000000000301",
            status: "requested",
            updatedAt: "2026-05-19T16:00:00.000Z",
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.saveOrderAction({
    action: "bill",
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    orderIds: ["00000000-0000-4000-8000-000000000301"],
  });

  expect(calls).toEqual([
    `clair_save_chart_order_action:bill:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    orderActions: [{ billingCandidateStatus: "candidate_created" }],
  });
});

test("order action persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("create or replace function public.clair_get_chart_order_actions");
  expect(migration).toContain("create or replace function public.clair_save_chart_order_action");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("order_confirmation_status");
  expect(migration).toContain("billing_candidate_status");
  expect(migration).toContain("confirmed_by_user_id");
  expect(migration).toContain("confirmed_at");
  expect(migration).toContain("order_events");
  expect(migration).toContain("grant execute on function public.clair_save_chart_order_action");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
