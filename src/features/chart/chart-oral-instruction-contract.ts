import { z } from "zod";

export const oralInstructionSchema = z.object({
  chartId: z.uuid(),
  revision: z.number().int().nonnegative(),
  instruction: z.string(),
  canEdit: z.boolean().optional(),
  history: z.array(z.object({ revision: z.number().int(), instruction: z.string(), actorId: z.string(), actorName: z.string().nullable().optional(), createdAt: z.string() })),
  snapshots: z.array(z.object({ taskId: z.string(), orderName: z.string().optional(), attemptNo: z.number().int().optional(), phase: z.enum(["requested", "completed"]), revision: z.number().int(), instruction: z.string(), capturedAt: z.string() })).optional(),
});
export type OralInstruction = z.infer<typeof oralInstructionSchema>;
export const oralInstructionCommandSchema = z.object({ expectedRevision: z.number().int().nonnegative(), instruction: z.string().max(5000) }).strict();

export const oralInstructionTargetSchema = z.object({ workspaceId: z.string().trim().min(1), chartId: z.uuid() });
