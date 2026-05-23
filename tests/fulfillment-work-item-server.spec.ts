import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockFulfillmentWorkItemGateway,
  createSupabaseFulfillmentWorkItemGateway,
  syncFulfillmentWorkItemsFromOrders,
  updateFulfillmentWorkItem,
} from "../src/features/fulfillment/server-fulfillment-work-item-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const orderId = "order-coco-maropitant";
const workItemId = `fulfill-${orderId}`;
const migrationPath = "supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("fulfillment work item routes sync from chart orders, read by queue, and mutate lifecycle", async ({
  request,
}) => {
  const unauthenticated = await request.post(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/sync-from-orders`,
    { data: { encounterId, orderIds: [orderId] } }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const synced = await request.post(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/sync-from-orders`,
    {
      data: { encounterId, orderIds: [orderId] },
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    }
  );
  expect(synced.status()).toBe(200);
  const syncedBody = await synced.json() as {
    ok: true;
    enforcedBy: string;
    workItems: Array<{
      id: string;
      orderId: string;
      queueType: string;
      sourceSnapshot: { orderDisplayName: string; patientName?: string };
      status: string;
    }>;
  };
  expect(syncedBody.enforcedBy).toBe("fulfillment-work-item-persistence");
  expect(syncedBody.workItems).toEqual([
    expect.objectContaining({
      id: workItemId,
      orderId,
      queueType: "dispensing",
      sourceSnapshot: expect.objectContaining({
        orderDisplayName: "Maropitant 16mg T",
        patientName: "코코",
      }),
      status: "requested",
    }),
  ]);

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing&encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as {
    ok: true;
    workItems: Array<{ id: string; orderId: string }>;
  };
  expect(readBody.workItems).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: workItemId, orderId }),
  ]));

  const frontDeskDenied = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
    {
      data: { status: "accepted" },
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    }
  );
  expect(frontDeskDenied.status()).toBe(403);
  await expectJson(frontDeskDenied, { ok: false, denialReason: "permission_missing" });

  const accepted = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
    {
      data: { status: "accepted", assignedToUserId: "user-tech" },
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    }
  );
  expect(accepted.status()).toBe(200);

  const invalidCompletion = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
    {
      data: { status: "completed" },
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    }
  );
  expect(invalidCompletion.status()).toBe(409);
  await expectJson(invalidCompletion, { ok: false, denialReason: "invalid_transition" });

  const inProgress = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
    {
      data: { status: "in_progress" },
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    }
  );
  expect(inProgress.status()).toBe(200);

  const completed = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
    {
      data: { status: "completed" },
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    }
  );
  expect(completed.status()).toBe(200);
  const completedBody = await completed.json() as {
    ok: true;
    workItems: Array<{ completedAt?: string | null; status: string }>;
  };
  expect(completedBody.workItems[0]).toMatchObject({
    status: "completed",
  });
  expect(completedBody.workItems[0]?.completedAt).toEqual(expect.any(String));
});

test("fulfillment core enforces chart sync permission and workspace encounter scope", async () => {
  const frontDeskDenied = await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-front-desk",
    workspaceId,
    input: { encounterId, orderIds: [orderId] },
  });
  expect(frontDeskDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: { encounterId, orderIds: [orderId] },
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

test("fulfillment core blocks terminal-state transitions", async () => {
  const gateway = createMockFulfillmentWorkItemGateway(undefined, () => "2026-05-23T09:44:00.000Z");
  await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-vet",
    workspaceId,
    input: { encounterId, orderIds: [orderId] },
    gateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "accepted" },
    gateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "in_progress" },
    gateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "completed" },
    gateway,
  });

  const reopenDenied = await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "returned" },
    gateway,
  });
  expect(reopenDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "invalid_transition",
  });
});

test("fulfillment Supabase gateway preserves actor, workspace, encounter, selected orders, and transition payload", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseFulfillmentWorkItemGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id ?? args.p_work_item_id}:${args.p_actor_user_id ?? "read"}`);
      return {
        data: [
          {
            id: "00000000-0000-4000-8000-000000000901",
            workspaceId,
            encounterId,
            orderId: "00000000-0000-4000-8000-000000000301",
            orderType: "lab",
            queueType: "lab",
            status: "requested",
            priority: "normal",
            requestedByUserId: "00000000-0000-4000-8000-000000000002",
            assignedToUserId: null,
            dueAt: null,
            completedAt: null,
            cancelledAt: null,
            returnedAt: null,
            reason: null,
            sourceSnapshot: { orderDisplayName: "CBC 검사", billingReflectionEnabled: true, detail: {} },
            createdAt: "2026-05-23T09:44:00.000Z",
            updatedAt: "2026-05-23T09:44:00.000Z",
          },
        ],
        error: null,
      };
    },
  });

  const synced = await gateway.syncFromOrders({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId: "00000000-0000-4000-8000-000000000101",
    orderIds: ["00000000-0000-4000-8000-000000000301"],
  });
  const updated = await gateway.updateWorkItem({
    actorUserId: "00000000-0000-4000-8000-000000000003",
    workspaceId,
    workItemId: "00000000-0000-4000-8000-000000000901",
    status: "accepted",
    assignedToUserId: "00000000-0000-4000-8000-000000000003",
  });

  expect(calls).toEqual([
    `clair_sync_fulfillment_work_items_from_orders:${workspaceId}:00000000-0000-4000-8000-000000000101:00000000-0000-4000-8000-000000000002`,
    `clair_update_fulfillment_work_item:${workspaceId}:00000000-0000-4000-8000-000000000901:00000000-0000-4000-8000-000000000003`,
  ]);
  expect(synced).toMatchObject({ ok: true, workItems: [{ queueType: "lab" }] });
  expect(updated).toMatchObject({ ok: true, workItems: [{ status: "requested" }] });
});

test("fulfillment migration defines local-first schema/RPC boundary without secrets", () => {
  expect(migration).toContain("create table if not exists public.order_fulfillment_work_items");
  expect(migration).toContain("workspace_id text not null references public.workspaces");
  expect(migration).toContain("order_id uuid not null references public.orders");
  expect(migration).toContain("source_snapshot jsonb");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("create or replace function public.clair_list_fulfillment_work_items");
  expect(migration).toContain("create or replace function public.clair_sync_fulfillment_work_items_from_orders");
  expect(migration).toContain("create or replace function public.clair_update_fulfillment_work_item");
  expect(migration).toContain("private.clair_fulfillment_transition_allowed");
  expect(migration).toContain("grant execute on function public.clair_update_fulfillment_work_item");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
