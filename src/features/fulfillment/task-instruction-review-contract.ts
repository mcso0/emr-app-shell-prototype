import { z } from "zod";
import { instructionRevisionSchema, instructionScopeSchema } from "@/features/chart/overall-instructions-contract";

export const effectiveInstructionsSchema = z.object({
  chartId: z.uuid(), scope: instructionScopeSchema,
  entries: z.array(instructionRevisionSchema),
  versions: z.record(z.string(), z.number().int().nonnegative()),
  versionKey: z.string().regex(/^[a-f0-9]{64}$/),
});
export const taskInstructionReviewSchema = z.object({
  taskId: z.uuid().optional(), orderId: z.uuid().optional(), current: effectiveInstructionsSchema.nullable(), previous: effectiveInstructionsSchema.nullable(),
  requiresAcknowledgement: z.boolean(),
  snapshots: z.array(z.object({ phase: z.enum(["requested", "completed"]), legacy: z.boolean().optional(), document: effectiveInstructionsSchema, capturedAt: z.string(), taskId: z.uuid().optional(), attemptNo: z.number().int().positive().optional(), requestCycle: z.number().int().positive().optional() })),
}).refine(item => Boolean(item.taskId) !== Boolean(item.orderId));
export const instructionReviewListSchema = z.array(taskInstructionReviewSchema);
export const instructionReviewTasksSchema = z.array(z.uuid()).min(1).max(100);
export const instructionAcknowledgementSchema = z.union([
  z.object({ taskId: z.uuid(), versionKey: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ orderId: z.uuid(), versionKey: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
]);
export type TaskInstructionReview = z.infer<typeof taskInstructionReviewSchema>;
export type EffectiveInstructions = z.infer<typeof effectiveInstructionsSchema>;

export const instructionReviewTargetId = (item: TaskInstructionReview) => (item.taskId ?? item.orderId)!;
