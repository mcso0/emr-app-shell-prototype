import { expect, test } from "@playwright/test";
import { buildChartActualRecords } from "../src/features/chart/chart-actual-confirmation";
import { parseChartActualRecords, parseChartActualContext, type ChartActualContext } from "../src/features/chart/chart-actual-contract";
import { amendChartActual, readChartActual, type ChartActualRpcClient } from "../src/features/chart/server-chart-actual-core";

const id = "97070000-0000-4000-8000-000000000001";
const stamp = "2026-09-06T00:00:00.000Z";
const actual = { performedAt: stamp, selfPerformed: true, payload: { findingSummary: "Explicit synthetic observation" } };
const context: ChartActualContext = { workspaceId: "clair-demo", taskId: id, orderId: id, attemptNo: 1,
  clinicalOrderType: "system_exam", planSha256: "a".repeat(64), planSnapshot: { detailInputs: { examMethod: "시진" } }, canAmend: true,
  results: [{ id, version: 1, previousResultId: null, payload: actual.payload, performedByUserId: id, performedAt: stamp,
    recordedByUserId: id, recordedAt: stamp, amendmentReason: null }] };

test("chart actual confirmation is blank by default and never borrows planned instructions", () => {
  const rows = [{ orderId: id, name: "Synthetic", type: "system_exam" as const, findingSummary: "Explicit synthetic observation" }];
  expect(buildChartActualRecords(rows, {})).toBeNull();
  expect(buildChartActualRecords(rows, { [id]: { performedAt: "2026-09-06T09:00", selfPerformed: false } })).toBeNull();
  expect(buildChartActualRecords(rows, { [id]: { performedAt: "2026-09-06T09:00", selfPerformed: true } })?.[id].payload).toEqual(actual.payload);
  expect(buildChartActualRecords([{ ...rows[0], type: "consultation" }], { [id]: { performedAt: "2026-09-06T09:00", selfPerformed: true } })).toBeNull();
});
test("DTO rejects missing attestation, timezone, findings and actor authority", () => {
  expect(parseChartActualRecords({ [id]: actual })).toEqual({ [id]: actual });
  for (const record of [{ ...actual, selfPerformed: false }, { ...actual, performedAt: "2026-09-06T09:00" },
    { ...actual, payload: { findingSummary: "" } }, { ...actual, actorUserId: id },
    { ...actual, payload: { performedActivity: "planned only" } }, { ...actual, payload: { instructionSummary: "planned" } }]) {
    expect(parseChartActualRecords({ [id]: record })).toBeNull();
  }
  expect(parseChartActualRecords({ foreign: actual })).toBeNull();
});
test("history parser binds task/workspace and validates append-only links", () => {
  expect(parseChartActualContext(context, "clair-demo", id)).toEqual(context);
  expect(parseChartActualContext({ ...context, workspaceId: "foreign" }, "clair-demo", id)).toBeNull();
  expect(parseChartActualContext({ ...context, results: [{ ...context.results[0], version: 2 }] }, "clair-demo", id)).toBeNull();
  expect(parseChartActualContext({ ...context, results: [...context.results, { ...context.results[0], id: "97070000-0000-4000-8000-000000000002", version: 2, previousResultId: id, amendmentReason: "Synthetic correction" }] }, "clair-demo", id)).not.toBeNull();
});
test("chart amendment uses bound actor and SQL CAS without accepting identity authority", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: ChartActualRpcClient = { rpc: async (name, args) => { calls.push({ name, args }); return { data: context, error: null }; } };
  const input = { commandId: id, expectedResultVersion: 1, expectedPlanSha256: context.planSha256, performedAt: stamp,
    payload: actual.payload, amendmentReason: "Synthetic correction" };
  expect(await amendChartActual({ client, actorUserId: id, workspaceId: "clair-demo", taskId: id, input })).toMatchObject({ ok: true });
  expect(calls[1]).toMatchObject({ name: "clair_amend_chart_actual_result", args: { p_actor_user_id: id, p_expected_result_version: 1, p_payload: actual.payload } });
  calls.length = 0;
  expect(await amendChartActual({ client, actorUserId: id, workspaceId: "clair-demo", taskId: id, input: { ...input, actorUserId: id } })).toMatchObject({ ok: false, status: 400 });
  expect(calls).toHaveLength(0);
  expect(await readChartActual({ client: { rpc: async () => ({ data: { ...context, workspaceId: "foreign" }, error: null }) }, workspaceId: "clair-demo", taskId: id })).toMatchObject({ ok: false, status: 502 });
  expect(await readChartActual({ client: { rpc: async () => { throw Error("private source"); } }, workspaceId: "clair-demo", taskId: id })).toEqual({ ok: false, status: 500, error: "chart_actual_unavailable" });
});
