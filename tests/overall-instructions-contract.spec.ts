import { expect, test } from "@playwright/test";
import { overallInstructionsCommandSchema } from "../src/features/chart/overall-instructions-contract";
import { createInstructionDraft, getInstructionChanges, hasUnresolvedEmptyInstruction, instructionConflicts } from "../src/features/chart/overall-instructions-draft";
import { syntheticOverallInstructions } from "../src/features/chart/overall-instructions-fixtures";
import { executeOverallInstructionsRequest } from "../src/features/chart/server-overall-instructions";
import { executeTaskInstructionReview } from "../src/features/fulfillment/server-task-instruction-review";
const id = "51000000-0000-4000-8000-000000000003";
const change = { scope: "overall" as const, expectedRevision: 0, operation: "set" as const, instruction: "합성 지시" };
test("rejects duplicate scopes, injected identities, invalid categories, blank and overlength instructions", () => {
  const command = { commandId: id, changes: [change] };
  expect(overallInstructionsCommandSchema.safeParse(command).success).toBe(true);
  for (const invalid of [{ ...command, actorId: id }, { ...command, changes: [change, change] }, { ...command, changes: [{ ...change, scope: "lab" }] }, { ...command, changes: [{ ...change, instruction: "  \n" }] }, { ...command, changes: [{ ...change, instruction: "x".repeat(5001) }] }, { ...command, changes: [{ ...change, expectedRevision: -1 }] }, { ...command, changes: [{ ...change, operation: "delete" }] }]) {
    expect(overallInstructionsCommandSchema.safeParse(invalid).success).toBe(false);
  }
});
test("layout-only changes do not create instructions; saved content cannot silently become blank", () => {
  const empty = structuredClone(syntheticOverallInstructions);
  expect(getInstructionChanges(empty, [{ scope: "overall", text: "" }], [])).toEqual([]);
  const saved = { ...empty, current: [{ ...change, revision: 1, instruction: "기존", deleted: false, actorName: null, createdAt: null }] };
  expect(hasUnresolvedEmptyInstruction(saved, [{ scope: "overall", text: "" }])).toBe(true);
  expect(getInstructionChanges(saved, [], ["overall"])).toEqual([{ scope: "overall", expectedRevision: 1, operation: "delete" }]);
  expect(getInstructionChanges(saved, createInstructionDraft(saved), [])).toEqual([]);
});
test("unrelated scope edits do not conflict and tombstone revisions remain significant", () => {
  const base = structuredClone(syntheticOverallInstructions);
  const current = { scope: "imaging" as const, revision: 2, instruction: "", deleted: true, actorName: null, createdAt: null };
  const latest = { ...base, current: [current] };
  expect(instructionConflicts(base, latest, [change])).toEqual([]);
  expect(instructionConflicts(base, latest, [{ ...change, scope: "imaging" }])).toEqual(["imaging"]);
});
test("server passes only scoped request to RPC and rejects invalid response", async () => {
  const calls: unknown[] = [];
  const command = { commandId: id, changes: [change] };
  const target = { workspaceId: "workspace-synthetic", chartId: syntheticOverallInstructions.chartId };
  const result = await executeOverallInstructionsRequest({ ...target, command, client: { rpc: async (name, args) => { calls.push({ name, args }); return { data: syntheticOverallInstructions, error: null }; } } });
  expect(result.ok).toBe(true);
  expect(calls).toEqual([{ name: "clair_apply_overall_instructions", args: { p_workspace_id: target.workspaceId, p_chart_id: target.chartId, p_command: command } }]);
  expect((await executeOverallInstructionsRequest({ ...target, client: { rpc: async () => ({ data: {}, error: null }) } })).ok).toBe(false);
});
for (const [error, status] of [["permission_missing", 403], ["chart_unavailable", 404], ["revision_conflict", 409], ["idempotency_conflict", 409], ["signed_chart_read_only", 409], ["terminal_orders", 409], ["no_confirmed_orders", 409]] as const) {
  test(`server preserves ${error} rejection`, async () => {
    expect(await executeOverallInstructionsRequest({ workspaceId: "workspace-synthetic", chartId: syntheticOverallInstructions.chartId, client: { rpc: async () => ({ data: null, error: { message: error } }) } })).toEqual({ ok: false, status, error });
  });
}

test("RPC response cannot substitute another chart", async () => {
  const result = await executeOverallInstructionsRequest({ workspaceId: "workspace-synthetic", chartId: syntheticOverallInstructions.chartId,
    client: { rpc: async () => ({ data: { ...syntheticOverallInstructions, chartId: id }, error: null }) } });
  expect(result.ok).toBe(false);
});
test("readding deleted content still creates an explicit set change", () => {
  const document = { ...syntheticOverallInstructions, current: [{ scope: "overall" as const, revision: 3, instruction: "old tombstone text", deleted: true, actorName: null, createdAt: null }] };
  expect(getInstructionChanges(document, [{ scope: "overall", text: "old tombstone text" }], [])).toEqual([{ scope: "overall", expectedRevision: 3, operation: "set", instruction: "old tombstone text" }]);
});

test("legacy promotion is explicit on Apply, while viewing is not an unsaved edit", () => {
  const document = { ...syntheticOverallInstructions, current: [{ scope: "dispensing" as const, revision: 4, instruction: "기존 경구제 지시", deleted: false, legacy: true, actorName: null, createdAt: null }] };
  const fields = createInstructionDraft(document);
  expect(getInstructionChanges(document, fields, [], false)).toEqual([]);
  expect(getInstructionChanges(document, fields, [])).toEqual([{ scope: "dispensing", expectedRevision: 4, operation: "set", instruction: "기존 경구제 지시" }]);
});
test("browser and SQL use the same UTF16 instruction limit", () => {
  expect(overallInstructionsCommandSchema.safeParse({ commandId: id, changes: [{ ...change, instruction: "😀".repeat(2500) }] }).success).toBe(true);
  expect(overallInstructionsCommandSchema.safeParse({ commandId: id, changes: [{ ...change, instruction: "😀".repeat(2501) }] }).success).toBe(false);
});
const emptyReview = { taskId: id, current: null, previous: null, snapshots: [], requiresAcknowledgement: false };
test("review response cannot substitute, duplicate or omit requested task identity", async () => {
  for (const data of [[{ ...emptyReview, taskId: syntheticOverallInstructions.chartId }], [emptyReview, emptyReview], [], [{ ...emptyReview, taskId: undefined, orderId: id }]]) {
    const result = await executeTaskInstructionReview({ workspaceId: "workspace-synthetic", taskIds: [id], client: { rpc: async () => ({ data, error: null }) } });
    expect(result.ok).toBe(false);
  }
});
test("review rejects forged acknowledgement identity and mixed task/order selectors before RPC", async () => {
  let calls = 0;
  const client = { rpc: async () => { calls++; return { data: emptyReview, error: null }; } };
  for (const acknowledgement of [{ taskId: id, actorId: id, versionKey: "a".repeat(64) }, { taskId: id, orderId: id, versionKey: "a".repeat(64) }, { taskId: id, versionKey: "forged" }]) {
    expect((await executeTaskInstructionReview({ workspaceId: "workspace-synthetic", acknowledgement, client })).status).toBe(400);
  }
  expect((await executeTaskInstructionReview({ workspaceId: "workspace-synthetic", taskIds: [id], orderIds: [id], client })).status).toBe(400);
  expect(calls).toBe(0);
});
test("pre-confirmation order review uses real order identity and session-derived RPC actor", async () => {
  const calls: unknown[] = [];
  const review = { ...emptyReview, taskId: undefined, orderId: id };
  const result = await executeTaskInstructionReview({ workspaceId: "workspace-synthetic", acknowledgement: { orderId: id, versionKey: "a".repeat(64) },
    client: { rpc: async (name, args) => { calls.push({ name, args }); return { data: review, error: null }; } } });
  expect(result.ok).toBe(true);
  expect(calls).toEqual([{ name: "clair_acknowledge_order_instructions", args: { p_workspace_id: "workspace-synthetic", p_order_id: id, p_version_key: "a".repeat(64) } }]);
});
test("stale review acknowledgement preserves conflict for UI recovery", async () => {
  expect(await executeTaskInstructionReview({ workspaceId: "workspace-synthetic", acknowledgement: { taskId: id, versionKey: "a".repeat(64) }, client: { rpc: async () => ({ data: null, error: { message: "instruction_version_conflict" } }) } })).toEqual({ ok: false, status: 409, error: "instruction_version_conflict" });
});
