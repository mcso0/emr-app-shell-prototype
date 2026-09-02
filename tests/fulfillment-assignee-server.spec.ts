import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createSupabaseFulfillmentEligibleAssigneeGateway,
  readFulfillmentEligibleAssignees,
  type SupabaseFulfillmentEligibleAssigneeRpcClient,
} from "../src/features/fulfillment/server-fulfillment-assignee-core";

test("eligible-assignee gateway maps only named active candidates from the DB RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: [
          {
            department: "진료지원",
            displayName: "송하윤",
            title: "테크니션",
            userId: "49110000-0000-4000-8000-000000000004",
          },
        ],
        error: null,
      };
    },
  } as SupabaseFulfillmentEligibleAssigneeRpcClient;
  const result = await readFulfillmentEligibleAssignees({
    actorUserId: "49110000-0000-4000-8000-000000000003",
    gateway: createSupabaseFulfillmentEligibleAssigneeGateway(client),
    workItemId: "96000000-0000-4000-8000-000000000101",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    assignees: [{ displayName: "송하윤", title: "테크니션" }],
    enforcedBy: "fulfillment-eligible-assignees",
    ok: true,
  });
  expect(calls).toEqual([
    {
      functionName: "clair_list_fulfillment_eligible_assignees",
      args: {
        p_work_item_id: "96000000-0000-4000-8000-000000000101",
        p_workspace_id: "workspace-clair-cheongdam",
      },
    },
  ]);
});

test("eligible-assignee route is authenticated and returns display identities", async ({
  request,
}) => {
  const route = "/api/workspaces/clair-demo/fulfillment/work-items/work-item-demo/assignees";
  const unauthenticated = await request.get(route);
  expect(unauthenticated.status()).toBe(401);

  const unauthorized = await request.get(route, {
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(unauthorized.status()).toBe(403);
  await expect(unauthorized.json()).resolves.toMatchObject({
    denialReason: "permission_missing",
    ok: false,
  });

  const response = await request.get(route, {
    headers: { "x-clair-demo-session-user-id": "user-tech" },
  });
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    assignees: [
      { displayName: "송하윤", userId: "user-tech" },
      { displayName: "송민재", userId: "user-admin" },
    ],
    enforcedBy: "fulfillment-eligible-assignees",
    ok: true,
  });
});

test("eligible-assignee SQL derives the queue capability and rechecks every candidate", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260902150055_plan_order_work_lifecycle_and_rpc_boundary.sql",
    ),
    "utf8",
  );
  expect(migration).toContain("public.clair_list_fulfillment_eligible_assignees");
  expect(migration).toContain("private.clair_queue_permission_for_destination");
  expect(migration).toContain(
    "private.clair_user_has_workspace_permission(\n        p_workspace_id, app_user.id, v_permission",
  );
  expect(migration).toContain("membership.status = 'active'");
  expect(migration).toContain("app_user.status = 'active'");
});
