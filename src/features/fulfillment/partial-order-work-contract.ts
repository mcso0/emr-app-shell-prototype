import { z } from "zod";
export const partialWorkNoteSchema = z.object({ taskId: z.uuid(), attemptNo: z.number().int().positive(), note: z.string(), actorName: z.string().nullable(), createdAt: z.string() });
export const partialWorkSchema = z.object({ taskId: z.uuid(), revision: z.number().int(), canRecord: z.boolean(), notes: z.array(partialWorkNoteSchema) });
export const partialWorkCommandSchema = z.object({ commandId: z.uuid(), expectedRevision: z.number().int().nonnegative(), note: z.string().trim().min(1).max(2000) }).strict();
