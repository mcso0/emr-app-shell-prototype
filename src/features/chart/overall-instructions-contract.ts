import { z } from "zod";

export const instructionScopeSchema = z.enum([
  "overall", "consultation", "clinical_lab", "imaging", "external_lab",
  "dispensing", "treatment", "hospitalization", "system_exam", "other",
]);
export type InstructionScope = z.infer<typeof instructionScopeSchema>;
export const instructionScopeLabels: Record<InstructionScope, string> = {
  overall: "전체 오더 지시", consultation: "진료 지시", clinical_lab: "임상 지시",
  imaging: "영상 지시", external_lab: "원외검사 지시", dispensing: "조제 지시",
  treatment: "처치 지시", hospitalization: "입원 지시", system_exam: "계통검사 지시", other: "기타 지시",
};
export const instructionRevisionSchema = z.object({
  scope: instructionScopeSchema, revision: z.number().int().nonnegative(),
  instruction: z.string(), deleted: z.boolean(), legacy: z.boolean().optional(),
  actorName: z.string().nullable(), createdAt: z.string().nullable(),
});
export type InstructionRevision = z.infer<typeof instructionRevisionSchema>;
export const overallInstructionsSchema = z.object({
  chartId: z.uuid(), canEdit: z.boolean(),
  readOnlyReason: z.enum(["permission_missing", "signed_chart_read_only", "encounter_read_only", "no_confirmed_orders", "terminal_orders"]).nullable(),
  eligibleScopes: z.array(instructionScopeSchema), current: z.array(instructionRevisionSchema),
  history: z.array(instructionRevisionSchema.extend({ actorId: z.uuid(), applyId: z.uuid().nullable() })),
});
export type OverallInstructions = z.infer<typeof overallInstructionsSchema>;
const changeBase = { scope: instructionScopeSchema, expectedRevision: z.number().int().nonnegative() };
export const overallInstructionChangeSchema = z.discriminatedUnion("operation", [
  z.object({ ...changeBase, operation: z.literal("set"), instruction: z.string().max(5000).refine(text => text.trim().length > 0) }).strict(),
  z.object({ ...changeBase, operation: z.literal("delete") }).strict(),
]);
export const overallInstructionsCommandSchema = z.object({
  commandId: z.uuid(), changes: z.array(overallInstructionChangeSchema).min(1).max(10),
}).strict().refine(command => new Set(command.changes.map(change => change.scope)).size === command.changes.length);
export type OverallInstructionsCommand = z.infer<typeof overallInstructionsCommandSchema>;
export const overallInstructionsTargetSchema = z.object({ workspaceId: z.string().trim().min(1), chartId: z.uuid() });
