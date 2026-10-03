import { expect, test } from "@playwright/test";
import {
  createSupabaseFulfillmentWorkItemGateway,
  readFulfillmentWorkItems,
  type FulfillmentQueueType,
} from "../src/features/fulfillment/server-fulfillment-work-item-core";

const patientId = "99300000-0000-4000-8000-000000000032";
const workItemId = "99300000-0000-4000-8000-000000000041";
function row(id: string, createdAt: string, dueAt: string | null, status = "requested") {
  return {
    id, workspaceId: "clair-demo", patientId,
    encounterId: "99300000-0000-4000-8000-000000000033",
    orderId: "99300000-0000-4000-8000-000000000031",
    orderType: "lab", queueType: "lab", status, priority: "normal",
    requestedByUserId: "user-vet", requestCycle: 1, rowRevision: 1,
    createdAt, updatedAt: createdAt, dueAt,
    sourceSnapshot: { orderDisplayName: "Synthetic CBC", billingReflectionEnabled: true,
      detail: { fixture: "preserve" }, frozenOrderSnapshot: { fixture: "preserve" } },
  };
}

test("each queue passes operating date and patient scope to the DB and preserves summary and snapshot", async () => {
  for (const queueType of ["lab", "dispensing", "treatment"] satisfies FulfillmentQueueType[]) {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const data = ["requested", "in_progress", "paused", "completed", "cancelled", "returned"].map(
      (status, index) => ({ ...row(`${workItemId}-${index}`, "2025-01-01T00:00Z", "2026-10-02T15:00Z", status), queueType, orderType: queueType }),
    );
    const gateway = createSupabaseFulfillmentWorkItemGateway({ async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args }); return { data, error: null };
    } });
    const result = await readFulfillmentWorkItems({ actorUserId: "user-tech", workspaceId: "clair-demo",
      filters: { queueType, date: "2026-10-03", patientId }, gateway });
    expect(calls).toEqual([{ name: "clair_list_fulfillment_work_items_v2", args: {
      p_workspace_id: "clair-demo", p_queue_type: queueType, p_date: "2026-10-03", p_patient_id: patientId,
      p_encounter_id: undefined, p_order_id: undefined, p_status: undefined, p_work_item_id: undefined,
    } }]);
    expect(result.ok && result.summary).toMatchObject({ totalCount: 6, activeCount: 4,
      statusCounts: { requested: 1, in_progress: 1, paused: 1, completed: 1, cancelled: 1, returned: 1 } });
    expect(result.ok && result.workItems.map(item => item.sourceSnapshot)).toEqual(data.map(item => item.sourceSnapshot));
  }
});

test("Seoul midnight is half-open and dueAt precedes createdAt; undated history keeps old unfinished work", async () => {
  const data = [
    row("before", "2026-10-02T14:59:59.999Z", null),
    row("start", "2026-10-02T15:00:00Z", null),
    row("end", "2026-10-03T14:59:59.999Z", null, "completed"),
    row("next", "2026-10-03T15:00:00Z", null),
    row("due", "2025-01-01T00:00Z", "2026-10-02T15:00Z", "cancelled"),
    row("prior-due", "2026-10-02T16:00Z", "2026-10-02T14:59:59Z"),
  ];
  const gateway = createSupabaseFulfillmentWorkItemGateway({ async rpc() { return { data, error: null }; } });
  const selected = await gateway.listWorkItems({ workspaceId: "clair-demo", queueType: "lab", date: "2026-10-03" });
  expect(selected.ok && selected.workItems.map(item => item.id)).toEqual(["start", "end", "due"]);
  const history = await gateway.listWorkItems({ workspaceId: "clair-demo", queueType: "lab", patientId });
  expect(history.ok && history.workItems).toHaveLength(6);
});

test("exact work item lookup passes id without date and missing v2 fails without a broad fallback", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const gateway = createSupabaseFulfillmentWorkItemGateway({ async rpc(_name: string, args: Record<string, unknown>) {
    calls.push(args); return { data: null, error: { message: "Could not find the function" } };
  } });
  expect(await gateway.listWorkItems({ workspaceId: "clair-demo", queueType: "lab", workItemId })).toEqual({ ok: false, status: 500, error: "db_read_failed" });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ p_work_item_id: workItemId, p_date: undefined });
});
