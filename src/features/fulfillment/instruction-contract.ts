import { z } from "zod";
import { oralInstructionSchema } from "@/features/chart/chart-oral-instruction-contract";

const id = z.string().min(1);
const snapshot = z.record(z.string(), z.unknown());
export const instructionCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("edit_instruction"),
      commandId: z.uuid(),
      expectedRevision: id,
      instruction: z.string().max(5000),
    })
    .strict(),
  z
    .object({
      action: z.enum(["claim", "start", "resume", "unassign", "complete_all"]),
      commandId: z.uuid(),
      expectedRevision: id,
    })
    .strict(),
  z
    .object({
      action: z.enum(["complete", "reopen", "start_item"]),
      commandId: z.uuid(),
      expectedRevision: id,
      itemId: id,
    })
    .strict(),
  z
    .object({
      action: z.literal("assign"),
      commandId: z.uuid(),
      expectedRevision: id,
      itemId: id,
      assigneeId: id,
    })
    .strict(),
]);

export const instructionItemSchema = z.object({
  id,
  orderId: id,
  taskId: id,
  attemptNo: z.number().int().positive(),
  revision: z.number().int().positive(),
  name: z.string(),
  status: z.enum([
    "requested",
    "in_progress",
    "paused",
    "completed",
    "cancelled",
    "returned",
  ]),
  assigneeId: id.nullable(),
  assigneeName: z.string().nullable(),
  instruction: z.string(),
  plan: snapshot,
  sourceSnapshot: snapshot,
  canAssign: z.boolean(),
  canComplete: z.boolean(),
  canReopen: z.boolean(),
  resultRequired: z.boolean(),
  hasResult: z.boolean(),
});

export const instructionDocumentSchema = z.object({
  oralInstruction: oralInstructionSchema.nullable().optional(),
  rootOrderId: id,
  rootTaskId: id,
  name: z.string(),
  isSet: z.boolean(),
  queueType: z.enum(["dispensing", "treatment"]),
  revision: id,
  mainAssigneeId: id.nullable(),
  mainAssigneeName: z.string().nullable(),
  instruction: z.string(),
  finalized: z.boolean(),
  canClaim: z.boolean(),
  canStart: z.boolean(),
  canResume: z.boolean(),
  canUnassign: z.boolean(),
  canCompleteAll: z.boolean(),
  canEditInstruction: z.boolean(),
  items: z.array(instructionItemSchema),
  changes: z.array(
    z.object({
      id,
      orderId: id,
      createdAt: z.string(),
      actorName: z.string().nullable(),
      changeType: z.string(),
      before: snapshot,
      after: snapshot,
    }),
  ),
});

export type InstructionDocument = z.infer<typeof instructionDocumentSchema>;
export type InstructionItem = z.infer<typeof instructionItemSchema>;
export type InstructionCommand = z.infer<typeof instructionCommandSchema>;

export function instructionCompletionConfirmation(
  document: InstructionDocument,
  itemId?: string,
) {
  const items = itemId
    ? document.items.filter((item) => item.id === itemId)
    : document.items;
  const unfinished = items.filter(
    (item) => !["completed", "cancelled", "returned"].includes(item.status),
  ).length;
  return {
    title:
      itemId && document.isSet ? "이 항목을 완료할까요?" : "오더를 완료할까요?",
    description:
      !itemId && unfinished > 0
        ? `미완료 항목 ${unfinished}개도 함께 완료됩니다.`
        : document.isSet && itemId
          ? "이 항목의 작업을 완료합니다. 세트 오더는 상단에서 완료해 주세요."
          : "오더의 작업을 완료합니다.",
    unfinished,
  };
}

export const instructionErrorMessages: Record<string, string> = {
  instruction_ack_required: "최신 지시사항을 확인한 뒤 다시 시도해 주세요.",
  revision_conflict:
    "다른 사용자가 오더를 변경했어요. 최신 내용을 확인한 뒤 다시 시도해 주세요.",
  permission_missing:
    "현재 담당자에게 작업 권한이 있어요. 담당 상태를 확인해 주세요.",
  actual_execution_result_required: "수행 결과를 먼저 기록해 주세요.",
  billing_locked: "수납에 반영된 오더는 완료를 해제할 수 없어요.",
  work_item_unavailable: "이 오더를 더 이상 찾을 수 없어요.",
  invalid_transition:
    "현재 상태에서는 이 작업을 할 수 없어요. 오더를 새로 확인해 주세요.",
  idempotency_conflict:
    "요청 내용을 확인할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.",
};
