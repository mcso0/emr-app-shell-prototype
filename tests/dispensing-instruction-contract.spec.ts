import { expect, test } from "@playwright/test";
import { instructionCommandSchema, instructionCompletionConfirmation } from "../src/features/fulfillment/instruction-contract";
import { executeInstructionRequest } from "../src/features/fulfillment/server-instruction";
import { syntheticInstruction } from "../src/features/dispensing/instruction-fixtures";
import type { TaskInstructionReview } from "../src/features/fulfillment/task-instruction-review-contract";
import { createInstructionView, getDispensingRerequestChanges, getInstructionStatusLabel } from "../src/features/dispensing/instruction-view-model";

const command = { action: "complete_all" as const, commandId: "00000000-0000-4000-8000-000000000001", expectedRevision: "revision-a" };

test("group commands cannot smuggle a single-item target or actor", () => {
  expect(instructionCommandSchema.safeParse({ ...command, itemId: "other-item" }).success).toBe(false);
  expect(instructionCommandSchema.safeParse({ ...command, actorId: "another-user" }).success).toBe(false);
  expect(instructionCommandSchema.safeParse({ ...command, startWork: true }).success).toBe(false);
  expect(instructionCommandSchema.safeParse({ ...command, action: "claim", startWork: false }).success).toBe(false);
  expect(instructionCommandSchema.safeParse({ ...command, action: "claim", startWork: true }).success).toBe(true);
  expect(instructionCommandSchema.safeParse({ ...command, action: "edit_instruction", instruction: "x".repeat(5001) }).success).toBe(false);
});

test("request passes only scoped identities to session RPC and validates returned data", async () => {
  const calls: unknown[] = [];
  const result = await executeInstructionRequest({ workspaceId: "workspace-a", workItemId: "item-a", command,
    client: { rpc: async (name, args) => { calls.push({ name, args }); return { data: syntheticInstruction, error: null }; } } });
  expect(result.ok).toBe(true);
  expect(calls).toEqual([{ name: "clair_mutate_fulfillment_instruction", args: { p_workspace_id: "workspace-a", p_work_item_id: "item-a", p_command: command } }]);
  const invalid = await executeInstructionRequest({ workspaceId: "workspace-a", workItemId: "item-a", client: { rpc: async () => ({ data: {}, error: null }) } });
  expect(invalid).toEqual({ ok: false, status: 500, error: "instruction_unavailable" });
});

for (const [message, status] of [["permission_missing", 403], ["work_item_unavailable", 404], ["revision_conflict", 409], ["actual_execution_result_required", 409], ["billing_locked", 409], ["treatment_medication_link_required", 409], ["treatment_medication_link_invalid", 409]] as const) {
  test(`RPC ${message} remains a failed command`, async () => {
    const result = await executeInstructionRequest({ workspaceId: "workspace-a", workItemId: "item-a", command,
      client: { rpc: async () => ({ data: null, error: { message } }) } });
    expect(result).toEqual({ ok: false, status, error: message });
  });
}

test("completion confirmation excludes cancelled and completed items", () => {
  expect(instructionCompletionConfirmation(syntheticInstruction).unfinished).toBe(2);
  expect(instructionCompletionConfirmation(syntheticInstruction, syntheticInstruction.items[0].id).title).toBe("이 항목을 완료할까요?");
});

test("document summary waits for explicit set finalization", () => {
  const document = structuredClone(syntheticInstruction);
  document.finalized = false;
  document.items.forEach((item) => { item.status = "completed"; });
  expect(getInstructionStatusLabel(document)).toBe("진행중");
  document.finalized = true;
  expect(getInstructionStatusLabel(document)).toBe("완료");
  document.finalized = false;
  document.items[0].status = "in_progress";
  expect(getInstructionStatusLabel(document)).toBe("진행중");
  document.items.forEach((item) => { item.status = "requested"; });
  expect(getInstructionStatusLabel(document)).toBe("대기중");
});

test("history preserves every common instruction change and actual field values", () => {
  const document = structuredClone(syntheticInstruction);
  document.changes.push({ id: "common-1", orderId: document.rootOrderId, createdAt: "2026-10-27T02:00:00Z", actorName: "합성 작성자", changeType: "amendment", before: { instruction: "이전" }, after: { instruction: "다음" } });
  document.changes.push({ ...document.changes.at(-1)!, id: "common-2", createdAt: "2026-10-27T03:00:00Z", before: { instruction: "다음" }, after: { instruction: "" } });
  const view = createInstructionView(document);
  expect(view.events.filter(event => event.changes[0].field === "instruction").map(event => event.changes[0])).toEqual([
    { itemId: document.rootOrderId, field: "instruction", before: "이전", after: "다음" },
    { itemId: document.rootOrderId, field: "instruction", before: "다음", after: "" },
  ]);
  expect(view.orders[0].items[0].previous?.dose).toBe("0.25");
  expect(view.orders[0].items[0].dose).toBe("0.5");
});

test("the dispensing instruction and history show the saved course request over the legacy total", () => {
  const document = structuredClone(syntheticInstruction);
  const item = document.items[0];
  const before = {
    ...item.plan,
    calculationOutputs: { plannedPracticalTotalQuantity: 4, actualDispenseUnit: "tablet" },
  };
  const after = {
    ...before,
    calculationOutputs: { plannedPracticalTotalQuantity: 6, actualDispenseUnit: "tablet" },
  };
  item.plan = after;
  document.changes.push({
    id: "request-quantity", orderId: item.orderId, createdAt: "2026-10-27T04:00:00Z",
    actorName: "합성 작성자", changeType: "amendment", before, after,
  });
  const view = createInstructionView(document);
  expect(view.orders[0].items[0]).toMatchObject({ total: "6", totalUnit: "TAB", previous: { total: "4" } });
  expect(view.events.find(event => event.id === "request-quantity")?.changes).toEqual([
    { itemId: item.id, field: "total", before: "4", after: "6" },
  ]);
  expect(view.orders[0].items[1]).toMatchObject({ total: "3", totalUnit: "T" });
});

test("dispensing change review keeps set items and successive edits separate", () => {
  const document = structuredClone(syntheticInstruction);
  const [first, second] = document.items;
  first.attemptNo = 3;
  second.attemptNo = 2;
  const editedAt = "2026-11-09T11:47:00.123456+00:00";
  const earlier = "2026-11-09T11:40:00.123456+00:00";
  const revision = (orderId: string, createdAt: string, before: string, after: string) => ({
    id: `${orderId}-${createdAt}`, orderId, createdAt, actorName: null, changeType: "re_request",
    before: { detailInputs: { frequency: before } }, after: { detailInputs: { frequency: after } },
  });
  const firstRevision = revision(first.orderId, editedAt, "bid", "tid");
  document.changes = [
    revision(first.orderId, earlier, "sid", "bid"),
    firstRevision,
    revision(second.orderId, editedAt, "tid", "qid"),
  ];
  const review = (item: typeof first, createdAt: string, reason: string): TaskInstructionReview => ({
    taskId: item.taskId, previous: null, snapshots: [], requiresAcknowledgement: true,
    current: {
      chartId: "synthetic-chart", scope: "dispensing", versions: {}, versionKey: "a".repeat(64),
      entries: [{ orderId: item.orderId, scope: "dispensing", kind: "clinical_edit", revision: 2,
        instruction: `복용 주기 변경\n사유: ${reason}`, deleted: false, actorName: null, createdAt }],
    },
  });
  const reviews = [review(second, editedAt, "둘째 품목 변경"), review(first, editedAt, "첫째 품목 변경")];
  const changes = getDispensingRerequestChanges(document, reviews);
  expect(changes.get(first.taskId)).toMatchObject({
    orderName: first.name, reason: "첫째 품목 변경", fields: [{ key: "frequency", before: "bid", after: "tid" }],
  });
  expect(changes.get(second.taskId)).toMatchObject({
    orderName: second.name, reason: "둘째 품목 변경", fields: [{ key: "frequency", before: "tid", after: "qid" }],
  });
  expect(getDispensingRerequestChanges(document, [review(first, earlier, "이전 변경")]).get(first.taskId)).toBeNull();
  expect(getDispensingRerequestChanges(document, [review(first, editedAt, "여러 줄\n사유: 원문")]).get(first.taskId)).toBeNull();
  document.changes.push({ ...firstRevision, id: "duplicate" });
  expect(getDispensingRerequestChanges(document, reviews).get(first.taskId)).toBeNull();
});

test("set instruction is composed for its own children without overwriting individual notes", () => {
  const doc = structuredClone(syntheticInstruction);
  doc.instruction = "세트 지시";
  doc.items[0].instruction = "개별 지시";
  const view = createInstructionView(doc);
  expect(view.orders[0].items[0].setInstruction).toBe("세트 지시");
  expect(view.orders[0].items[0].note).toContain("개별 지시");
  expect(doc.items[0].instruction).toBe("개별 지시");
  doc.isSet = false;
  expect(createInstructionView(doc).orders[0].items[0].setInstruction).toBeUndefined();
});

// A chart-wide instruction is separate from order commands and cannot accept an actor override.
test("chart oral instruction validates its scope, revision and bounded text", async () => {
  const { oralInstructionCommandSchema, oralInstructionTargetSchema } = await import("../src/features/chart/chart-oral-instruction-contract");
  expect(oralInstructionCommandSchema.safeParse({ expectedRevision: 0, instruction: "" }).success).toBe(true);
  for (const command of [
    { expectedRevision: -1, instruction: "a" },
    { expectedRevision: 0, instruction: "a".repeat(5001) },
    { expectedRevision: 0, instruction: "a", actorId: "other" },
  ]) expect(oralInstructionCommandSchema.safeParse(command).success).toBe(false);
  expect(oralInstructionTargetSchema.safeParse({ workspaceId: "", chartId: "other" }).success).toBe(false);
});

test("instruction notes include explicit memos without leaking calculation/internal fields", () => {
  const doc = structuredClone(syntheticInstruction);
  doc.items[0].plan = { detailSchemaVersion: 1, detailInputs: {
    doseBasis: "patient", compoundNote: "합성 조제 메모", guardianNote: "합성 보호자 메모",
    taperSchedule: "합성 단계 지시", extraLabelSpeciesReason: "internal",
  } };
  doc.items[0].instruction = "개별 지시";
  const before = structuredClone(doc);
  const item = createInstructionView(doc).orders[0].items[0];
  expect(item.note).toContain("오더별 지시: 개별 지시");
  expect(item.note).toContain("조제 메모: 합성 조제 메모");
  expect(item.note).toContain("보호자 전달 메모: 합성 보호자 메모");
  expect(item.note).not.toContain("patient");
  expect(item.note).not.toContain("internal");
  expect(doc).toEqual(before);
});

test("explicit treatment fields retain planned quantities and instructions without internal identifiers", () => {
  const doc = structuredClone(syntheticInstruction);
  doc.queueType = "treatment";
  doc.items[0].plan = { detailSchemaVersion: 3, detailInputs: {
    method: "합성 처치", site: "합성 부위", plannedProcedureCount: 2, procedureCountUnit: "session",
    plannedAmount: 3, plannedAmountUnit: "ml", administrationPolicy: "direct_quantity",
    productReference: "합성 제품", linkedMedicationOrderId: "internal-order-id", procedureKind: "device_session",
    stagedInstructions: "합성 단계별 지시", exceptions: "합성 중단 조건",
  } };
  const note = createInstructionView(doc).orders[0].items[0].note;
  expect(note).toContain("시행 예정 횟수: 2");
  expect(note).toContain("시행 계수 단위: 회");
  expect(note).toContain("예정 사용·투여량: 3");
  expect(note).toContain("예정량 단위: ml");
  expect(note).toContain("합성 단계별 지시");
  expect(note).not.toMatch(/internal-order-id|device_session|direct_quantity/);
});


test("takeover requires a bounded reason and rejects recipient or actor injection", () => {
  const takeover = { action: "takeover", commandId: command.commandId, expectedRevision: "revision-a", reason: "교대 인계" };
  expect(instructionCommandSchema.safeParse(takeover).success).toBe(true);
  expect(instructionCommandSchema.safeParse({ ...takeover, reason: "합".repeat(1000) }).success).toBe(true);
  for (const invalid of [
    { ...takeover, reason: " \n " }, { ...takeover, reason: "합".repeat(1001) },
    { ...takeover, reason: undefined }, { ...takeover, actorId: "other" },
    { ...takeover, recipientId: "other" }, { ...takeover, itemId: "other" },
    { ...takeover, assigneeId: "other" }, { ...takeover, action: "claim" },
  ]) expect(instructionCommandSchema.safeParse(invalid).success).toBe(false);
});
