import { expect, test } from "@playwright/test";
import { instructionCommandSchema, instructionCompletionConfirmation } from "../src/features/fulfillment/instruction-contract";
import { executeInstructionRequest } from "../src/features/fulfillment/server-instruction";
import { syntheticInstruction } from "../src/features/dispensing/instruction-fixtures";
import { createInstructionView, getInstructionStatusLabel } from "../src/features/dispensing/instruction-view-model";

const command = { action: "complete_all" as const, commandId: "00000000-0000-4000-8000-000000000001", expectedRevision: "revision-a" };

test("group commands cannot smuggle a single-item target or actor", () => {
  expect(instructionCommandSchema.safeParse({ ...command, itemId: "other-item" }).success).toBe(false);
  expect(instructionCommandSchema.safeParse({ ...command, actorId: "another-user" }).success).toBe(false);
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

for (const [message, status] of [["permission_missing", 403], ["work_item_unavailable", 404], ["revision_conflict", 409], ["actual_execution_result_required", 409], ["billing_locked", 409]] as const) {
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
