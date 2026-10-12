import { expect, test } from "@playwright/test";

import { resolveWorkspacePermission } from "../src/features/auth/permission-resolver";
import {
  createDemoFulfillmentPermissionAdapter,
  createMockFulfillmentWorkItemGateway,
  resetMockFulfillmentWorkItemState,
  updateFulfillmentWorkItem,
  type FulfillmentWorkItem,
  type FulfillmentWorkItemAction,
} from "../src/features/fulfillment/server-fulfillment-work-item-core";
import { mockStaffUsers } from "../src/mocks/emr-domain";

const workspaceId = "clair-demo";
const seededActor = "user-tech-hayun";
let commandSequence = 0;

test.beforeEach(() => {
  resetMockFulfillmentWorkItemState();
  commandSequence = 0;
});

async function readItem(orderId: string, queueType: "lab" | "dispensing" | "imaging") {
  const result = await createMockFulfillmentWorkItemGateway().listWorkItems({ workspaceId, queueType, orderId });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Synthetic work item read failed");
  const item = result.workItems.find(row => row.orderId === orderId);
  expect(item).toBeDefined();
  return item!;
}

function command(item: FulfillmentWorkItem, actorUserId: string | null, action: FulfillmentWorkItemAction, assignedToUserId?: string) {
  commandSequence += 1;
  return updateFulfillmentWorkItem({
    actorUserId, workspaceId, workItemId: item.id,
    input: { action, assignedToUserId, expectedRevision: item.rowRevision,
      reason: action === "handoff" ? "Synthetic assignee handoff verification" : undefined,
      commandId: `00000000-0000-4000-8000-${String(commandSequence).padStart(12, "0")}` },
  });
}

async function allowedCommand(item: FulfillmentWorkItem, actorUserId: string, action: FulfillmentWorkItemAction, assignedToUserId?: string) {
  const result = await command(item, actorUserId, action, assignedToUserId);
  expect(result).toMatchObject({ ok: true, status: 200 });
  if (!result.ok) throw new Error("Synthetic owner command failed");
  const updated = result.workItems.find(row => row.id === item.id);
  expect(updated).toBeDefined();
  return updated!;
}

test("seeded technician registration keeps its existing role and one-workspace scope", () => {
  const staff = mockStaffUsers.find(user => user.id === seededActor);
  expect(staff).toMatchObject({ workspaceId, role: "technician" });
  const adapter = createDemoFulfillmentPermissionAdapter();
  const technician = resolveWorkspacePermission(adapter, { sessionUserId: "user-tech", workspaceId });
  const seeded = resolveWorkspacePermission(adapter, { sessionUserId: seededActor, workspaceId, requiredPermission: "lab:complete" });
  expect(seeded).toMatchObject({ allowed: true, assignedRoles: ["technician"], hasFullWorkspaceAccess: false });
  expect(seeded.effectivePermissionIds).toEqual(technician.effectivePermissionIds);
  expect(resolveWorkspacePermission(adapter, { sessionUserId: seededActor, workspaceId, requiredPermission: "chart:update" }))
    .toMatchObject({ allowed: false, denialReason: "permission_missing" });
  expect(resolveWorkspacePermission(adapter, { sessionUserId: seededActor, workspaceId: "workspace-foreign", requiredPermission: "lab:complete" }))
    .toMatchObject({ allowed: false, denialReason: "workspace_membership_missing" });
});

test("seeded current assignee completes its in-progress lab work through default authorization", async () => {
  const item = await readItem("order-kong-cbc", "lab");
  expect(item).toMatchObject({ assignedToUserId: seededActor, status: "in_progress" });
  const completed = await allowedCommand(item, seededActor, "complete");
  expect(completed).toMatchObject({ status: "completed", assignedToUserId: seededActor, rowRevision: item.rowRevision + 1 });
});

test("non-assignee technician and administrator cannot execute seeded owned work", async () => {
  const item = await readItem("order-kong-cbc", "lab");
  for (const actor of ["user-tech", "user-admin"]) {
    expect(await command(item, actor, "complete"))
      .toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  }
  expect(await readItem(item.orderId, "lab")).toMatchObject({ status: item.status, rowRevision: item.rowRevision, assignedToUserId: seededActor });
});

test("unknown and unauthenticated actors remain denied without mutating seeded work", async () => {
  const item = await readItem("order-kong-cbc", "lab");
  expect(await command(item, "user-tech-unknown", "complete"))
    .toMatchObject({ ok: false, status: 403, denialReason: "workspace_membership_missing" });
  expect(await command(item, null, "complete"))
    .toMatchObject({ ok: false, status: 401, denialReason: "unauthenticated" });
  expect(await readItem(item.orderId, "lab")).toMatchObject({ rowRevision: item.rowRevision, status: item.status });
});

test("unassigned work rejects execution and claimed work still requires start before completion", async () => {
  const item = await readItem("order-kong-abdomen", "imaging");
  expect(item).toMatchObject({ assignedToUserId: null, status: "requested" });
  expect(await command(item, seededActor, "start"))
    .toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  const claimed = await allowedCommand(item, seededActor, "claim");
  expect(claimed).toMatchObject({ assignedToUserId: seededActor, status: "requested" });
  expect(await command(claimed, seededActor, "complete"))
    .toMatchObject({ ok: false, status: 409, denialReason: "invalid_transition" });
});

test("assignment cancellation removes the previous assignee execution authority", async () => {
  const item = await readItem("order-kong-maropitant", "dispensing");
  expect(item).toMatchObject({ assignedToUserId: seededActor, status: "requested" });
  const cancelled = await allowedCommand(item, seededActor, "unassign");
  expect(cancelled).toMatchObject({ assignedToUserId: null, status: "requested" });
  expect(await command(cancelled, seededActor, "start"))
    .toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  expect(await readItem(item.orderId, "dispensing")).toMatchObject({ rowRevision: cancelled.rowRevision, assignedToUserId: null });
});

test("handoff revokes the seeded previous owner and grants execution only to the new assignee", async () => {
  // Use a separate encounter from the completed positive fixture's lifecycle state.
  const item = await readItem("order-coco-cbc", "lab");
  const transferred = await allowedCommand(item, seededActor, "handoff", "user-tech");
  expect(transferred).toMatchObject({ assignedToUserId: "user-tech", status: "in_progress" });
  expect(await command(transferred, seededActor, "complete"))
    .toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  const completed = await allowedCommand(transferred, "user-tech", "complete");
  expect(completed).toMatchObject({ assignedToUserId: "user-tech", status: "completed", rowRevision: transferred.rowRevision + 1 });
});
