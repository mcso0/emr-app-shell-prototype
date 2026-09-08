import { expect, test } from "@playwright/test";
import { createSupabaseFulfillmentWorkItemGateway } from "../src/features/fulfillment/server-fulfillment-work-item-core";
const workspaceId = "clair-demo";

test("treatment dependency start failures retain actionable conflict codes", async () => {
  for (const denialReason of ["treatment_medication_link_required", "treatment_medication_link_invalid"]) {
    const gateway = createSupabaseFulfillmentWorkItemGateway({ rpc: async () => ({ data: null, error: { message: denialReason } }) });
    expect(await gateway.updateWorkItem({ workspaceId, actorUserId: "00000000-0000-4000-8000-000000000001",
      workItemId: "97081000-0000-4000-8000-000000000031", action: "start", expectedRevision: 1,
      commandId: "97081000-0000-4000-8000-000000000032" })).toEqual({ ok: false, status: 409, denialReason });
  }
});
