import { isExecutionRecord as record, isExecutionUuid as uuid } from "../fulfillment/execution-result-contract";
import type { LabProfileRpcClient } from "./server-result-profile-core";

export type AtomicLabRetestInput = { requestId: string; resultId: string; rowId: string; expectedEntryWriteRevision: number;
  reason: string; specimenDecision: "new_specimen" | "reuse_specimen"; specimenReference: string;
  billingPolicy: "no_charge" | "catalog_price"; profileVersionId: string; deviceId: string };
export function parseAtomicLabRetestInput(input: unknown): AtomicLabRetestInput | null {
  if (!record(input) || Object.keys(input).sort().join(",") !== "billingPolicy,deviceId,expectedEntryWriteRevision,profileVersionId,reason,requestId,resultId,rowId,specimenDecision,specimenReference"
    || !uuid(input.requestId) || !uuid(input.profileVersionId) || !uuid(input.deviceId)
    || !Number.isSafeInteger(input.expectedEntryWriteRevision) || Number(input.expectedEntryWriteRevision) < 1
    || !["new_specimen", "reuse_specimen"].includes(String(input.specimenDecision)) || !["no_charge", "catalog_price"].includes(String(input.billingPolicy))
    || ["resultId", "rowId", "reason", "specimenReference"].some(key => typeof input[key] !== "string" || !(input[key] as string).trim())
    || String(input.reason).length > 2000 || String(input.specimenReference).length > 200 || String(input.resultId).length > 500 || String(input.rowId).length > 500) return null;
  return input as AtomicLabRetestInput;
}
const allowedErrors = new Set(["workspace_membership_missing", "permission_missing", "lab_result_not_found", "lab_result_revision_conflict", "lab_retest_prior_result_required",
  "lab_retest_atomic_order_required", "catalog_item_not_found", "encounter_unavailable", "lab_retest_catalog_billing_unavailable", "lab_result_profile_binding_required", "lab_retest_idempotency_conflict"]);
export async function createAtomicLabRetest(client: LabProfileRpcClient, workspaceId: string, value: unknown) {
  const input = parseAtomicLabRetestInput(value);
  if (!workspaceId.trim() || !input) return { ok: false as const, status: 400, error: "invalid_lab_retest_request" };
  try {
    const { data, error } = await client.rpc("clair_create_lab_atomic_retest", { p_workspace_id: workspaceId, p_input: input });
    if (error) return { ok: false as const, status: ["workspace_membership_missing", "permission_missing"].includes(error.message ?? "") ? 403 : 409,
      error: allowedErrors.has(error.message ?? "") ? error.message! : "lab_retest_request_failed" };
    if (!record(data) || data.ok !== true || data.workspaceId !== workspaceId || data.requestId !== input.requestId
      || !uuid(data.orderId) || !uuid(data.encounterId) || !uuid(data.priorOrderId) || data.confirmationStatus !== "draft") return { ok: false as const, status: 502, error: "invalid_lab_retest_response" };
    return { ok: true as const, status: 200, workspaceId, orderId: data.orderId, encounterId: data.encounterId,
      priorOrderId: data.priorOrderId, confirmationStatus: "draft" as const };
  } catch { return { ok: false as const, status: 503, error: "lab_retest_request_failed" }; }
}
