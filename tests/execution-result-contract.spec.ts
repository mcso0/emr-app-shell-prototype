import { expect, test } from "@playwright/test";
import { parseExecutionPayload, parseExecutionCommand, parseExecutionContext, type ExecutionContext } from "../src/features/fulfillment/execution-result-contract";
import { readExecutionContext, recordExecutionResult, type ExecutionRpcClient } from "../src/features/fulfillment/server-execution-result-core";

const id = "97080000-0000-4000-8000-000000000001";
const context: ExecutionContext = { workspaceId: "clair-demo", workItemId: id, taskId: id, orderId: id, encounterId: id,
  attemptNo: 2, workItemRevision: 3, clinicalOrderType: "dispensing", status: "in_progress", isCurrentAttempt: true,
  planSnapshot: { detailInputs: { totalQuantity: 8 } }, planSha256: "a".repeat(64), resultRequired: true, canRecord: true, results: [] };
const command = { expectedRevision: 3, expectedPlanSha256: "a".repeat(64), expectedResultVersion: 0, commandId: id,
  performedAt: "2026-09-06T00:00:00.000Z", payload: { preparedQuantity: 7.5, preparedUnit: "tablet" }, varianceReason: "Synthetic difference" };

test("typed actual payloads reject unknown authority, missing units, nonfinite quantities and invalid acquired views", () => {
  expect(parseExecutionPayload("dispensing", command.payload)).toEqual(command.payload);
  for (const payload of [{ preparedQuantity: NaN, preparedUnit: "tablet" }, { preparedQuantity: -1, preparedUnit: "tablet" },
    { preparedQuantity: 1 }, { ...command.payload, performedByUserId: id }, { ...command.payload, preparedUnit: "" }]) {
    expect(parseExecutionPayload("dispensing", payload)).toBeNull();
  }
  expect(parseExecutionPayload("treatment", { performedProcedure: "Synthetic activity", outcome: "Recorded", administeredAmount: 1 })).toBeNull();
  expect(parseExecutionPayload("treatment", { performedProcedure: "Synthetic activity", outcome: "Recorded", administeredAmount: 1, administeredUnit: "mL" })).not.toBeNull();
  expect(parseExecutionPayload("imaging", { acquiredViews: [], performedProtocol: "Synthetic", quality: "diagnostic", findings: "Recorded", interpretation: "Recorded" })).toBeNull();
});

test("command input excludes client-supplied actor/type and requires explicit timestamp, CAS and command UUID", () => {
  expect(parseExecutionCommand(command)).toEqual(command);
  for (const patch of [{ actorUserId: id }, { clinicalOrderType: "dispensing" }, { expectedResultVersion: -1 },
    { expectedRevision: 0 }, { performedAt: "2026-09-06T12:00" }, { commandId: "fake" }, { expectedPlanSha256: "stale" }]) {
    expect(parseExecutionCommand({ ...command, ...patch })).toBeNull();
  }
});

test("treatment V2 requires actual counts, typed measurements and explicit device settings without filling from plan", () => {
  const plan = { detailSchemaVersion: 2, detailInputs: { procedureKind: "measurement", plannedProcedureCount: 1,
    procedureCountUnit: "session", measurementUnit: "mmHg", deviceProtocol: "TONOVET Plus manual synthetic fixture" } };
  const actual = { performedProcedure: "Manual synthetic reading", outcome: "Recorded", performedCount: 1,
    performedCountUnit: "session", measurementValue: 12, measurementUnit: "mmHg", deviceIdentity: "Synthetic TONOVET device",
    deviceSettingsPolicy: "not_adjustable" };
  expect(parseExecutionPayload("treatment", actual, plan)).toEqual(actual);
  for (const key of ["performedCount", "measurementValue", "deviceIdentity", "deviceSettingsPolicy"]) {
    const invalid: Record<string, unknown> = { ...actual }; delete invalid[key];
    expect(parseExecutionPayload("treatment", invalid, plan)).toBeNull();
  }
  expect(parseExecutionPayload("treatment", { ...actual, deviceParameters: [{ name: "setting", value: 1, unit: "unit" }] }, plan)).toBeNull();
  const settings = { ...actual, deviceSettingsPolicy: "recorded_parameters", deviceParameters: [{ name: "fixture duration", value: 1, unit: "min" }] };
  expect(parseExecutionPayload("treatment", settings, plan)).not.toBeNull();
  for (const parameters of [[{ name: "setting", value: "1", unit: "unit" }], [{ name: "setting", value: 1 }],
    [{ name: "setting", value: NaN, unit: "unit" }], [{ name: "same", value: 1, unit: "unit" }, { name: " same ", value: 2, unit: "unit" }]]) {
    expect(parseExecutionPayload("treatment", { ...settings, deviceParameters: parameters }, plan)).toBeNull();
  }
  expect(parseExecutionPayload("treatment", { performedProcedure: "Old V1", outcome: "Saved" }, { detailSchemaVersion: 1 })).not.toBeNull();
  expect(parseExecutionPayload("treatment", actual, { ...plan, detailInputs: { procedureKind: "monitoring" } })).toBeNull();
});

test("context rejects foreign identities, malformed versions and altered plan hash", () => {
  expect(parseExecutionContext(context, "clair-demo", id)).toEqual(context);
  expect(parseExecutionContext({ ...context, workspaceId: "foreign" }, "clair-demo", id)).toBeNull();
  expect(parseExecutionContext(context, "clair-demo", id, "97080000-0000-4000-8000-000000000009")).toBeNull();
  const record = { id, version: 1, previousResultId: null, schemaVersion: 1, payload: command.payload,
    performedByUserId: id, performedAt: command.performedAt, recordedByUserId: id, recordedAt: command.performedAt,
    varianceReason: "Synthetic difference", amendmentReason: null, planSha256: context.planSha256 };
  expect(parseExecutionContext({ ...context, results: [record] }, "clair-demo", id)).not.toBeNull();
  expect(parseExecutionContext({ ...context, results: [{ ...record, version: 2 }] }, "clair-demo", id)).toBeNull();
  expect(parseExecutionContext({ ...context, results: [{ ...record, planSha256: "b".repeat(64) }] }, "clair-demo", id)).toBeNull();
});

test("gateway fails closed for network/foreign/permission errors with no fallback result", async () => {
  const client = (data: unknown, message?: string): ExecutionRpcClient => ({ rpc: async () => ({ data, error: message ? { message } : null }) });
  expect(await readExecutionContext({ client: client({ ...context, workspaceId: "foreign" }), workspaceId: "clair-demo", workItemId: id })).toMatchObject({ ok: false, status: 502 });
  expect(await readExecutionContext({ client: client(null, "permission_missing"), workspaceId: "clair-demo", workItemId: id })).toMatchObject({ ok: false, status: 403 });
  expect(await readExecutionContext({ client: { rpc: async () => { throw Error("private server detail"); } }, workspaceId: "clair-demo", workItemId: id })).toEqual({ ok: false, status: 500, error: "execution_request_failed" });
});

test("writer derives type from context, binds session actor and delegates authoritative CAS/retry", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: ExecutionRpcClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data: context, error: null }; } };
  expect(await recordExecutionResult({ client, actorUserId: id, workspaceId: "clair-demo", workItemId: id, input: command })).toMatchObject({ ok: true });
  expect(calls).toHaveLength(2);
  expect(calls[1]).toMatchObject({ name: "clair_record_order_execution_result", args: { p_actor_user_id: id, p_expected_revision: 3,
    p_expected_result_version: 0, p_expected_plan_sha256: context.planSha256, p_payload: command.payload, p_command_id: id } });
  calls.length = 0;
  expect(await recordExecutionResult({ client, actorUserId: id, workspaceId: "clair-demo", workItemId: id, input: { ...command, actorUserId: "spoof" } })).toMatchObject({ ok: false, status: 400 });
  expect(calls).toHaveLength(0);
});

test("treatment V3 retains explicit actual requirements and actionable dependency failures", async () => {
  const plan = { detailSchemaVersion: 3, detailInputs: { procedureKind: "administration", administrationPolicy: "separate_medication_order" } };
  const actual = { performedProcedure: "Synthetic explicit treatment", outcome: "Synthetic explicit outcome", performedCount: 1, performedCountUnit: "session" };
  expect(parseExecutionPayload("treatment", actual, plan)).toEqual(actual);
  expect(parseExecutionPayload("treatment", { performedProcedure: "Synthetic", outcome: "Synthetic" }, plan)).toBeNull();
  for (const error of ["treatment_medication_link_required", "treatment_medication_link_invalid"]) {
    const client: ExecutionRpcClient = { rpc: async name => name === "clair_get_order_execution_context"
      ? { data: { ...context, clinicalOrderType: "treatment", planSnapshot: plan }, error: null }
      : { data: null, error: { message: error } } };
    expect(await recordExecutionResult({ client, actorUserId: id, workspaceId: "clair-demo", workItemId: id, input: { ...command, payload: actual } }))
      .toMatchObject({ ok: false, status: 409, error });
  }
});
