import { type OverallInstructions, type OverallInstructionsCommand } from "./overall-instructions-contract";
import { InstructionRequestError, type OverallInstructionsClient } from "./overall-instructions-client";

export const syntheticOverallInstructions: OverallInstructions = {
  chartId: "51000000-0000-4000-8000-000000000001", canEdit: true, readOnlyReason: null,
  eligibleScopes: ["overall", "consultation", "clinical_lab", "imaging", "dispensing", "treatment", "other"], current: [], history: [],
};
/** Synthetic, in-memory transport for isolated stories/tests. Never used by the chart. */
export function createSyntheticInstructionsClient({ saved = false, readOnly = false, legacy = false, mode = "normal" }: {
  saved?: boolean; readOnly?: boolean; legacy?: boolean; mode?: "normal" | "failed-load" | "failed-save" | "lost-response" | "conflict";
} = {}): OverallInstructionsClient {
  let document = structuredClone(syntheticOverallInstructions);
  const results = new Map<string, OverallInstructions>();
  let attempted = false;
  const actorId = "51000000-0000-4000-8000-000000000002";
  if (saved || legacy) {
    const item = { scope: legacy ? "dispensing" as const : "overall" as const, legacy, revision: 1, instruction: "합성 검증용 공통 지시입니다.", deleted: false, actorName: "합성 작성자", createdAt: "2026-11-01T03:00:00Z" };
    document.current = [item]; document.history = [{ ...item, actorId, applyId: "51000000-0000-4000-8000-000000000003" }];
  }
  if (readOnly) { document.canEdit = false; document.readOnlyReason = "terminal_orders"; }
  function applyChanges(command: OverallInstructionsCommand) {
    const next = structuredClone(document);
    for (const change of command.changes) {
      const previous = next.current.find(item => item.scope === change.scope);
      if ((previous?.revision ?? 0) !== change.expectedRevision) throw new InstructionRequestError("revision_conflict");
      const item = { scope: change.scope, revision: change.expectedRevision + 1, instruction: change.operation === "delete" ? "" : change.instruction, deleted: change.operation === "delete", actorName: "합성 작성자", createdAt: "2026-11-01T04:00:00Z" };
      next.current = [...next.current.filter(entry => entry.scope !== change.scope), item];
      next.history.unshift({ ...item, actorId, applyId: command.commandId });
    }
    document = next; results.set(command.commandId, structuredClone(next)); return structuredClone(next);
  }
  return {
    async load() { if (mode === "failed-load") throw new InstructionRequestError("instruction_unavailable"); return structuredClone(document); },
    async apply(command) {
      if (!document.canEdit) throw new InstructionRequestError("terminal_orders");
      if (results.has(command.commandId)) return structuredClone(results.get(command.commandId)!);
      if (mode === "failed-save") throw new InstructionRequestError("invalid_input");
      if (mode === "conflict" && !attempted) {
        attempted = true;
        applyChanges({ commandId: "51000000-0000-4000-8000-000000000004", changes: [{ ...command.changes[0], operation: "set", instruction: "다른 합성 작성자가 변경한 지시입니다." }] });
        throw new InstructionRequestError("revision_conflict");
      }
      const next = applyChanges(command);
      if (mode === "lost-response" && !attempted) { attempted = true; throw new InstructionRequestError("instruction_unavailable", true); }
      return next;
    },
  };
}
