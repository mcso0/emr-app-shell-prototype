import { type InstructionScope, type OverallInstructions, type OverallInstructionsCommand } from "./overall-instructions-contract";

export type InstructionDraft = { scope: InstructionScope; text: string };
export function createInstructionDraft(document: OverallInstructions): InstructionDraft[] {
  return document.current.filter(item => !item.deleted && item.instruction.trim()).map(item => ({ scope: item.scope, text: item.instruction }));
}
/** Empty layout changes are not clinical revisions. Deletion is explicit. */
export function getInstructionChanges(document: OverallInstructions, fields: InstructionDraft[], deleted: InstructionScope[], promoteLegacy = true): OverallInstructionsCommand["changes"] {
  const current = new Map(document.current.map(item => [item.scope, item]));
  return [
    ...fields.filter(field => ((promoteLegacy && current.get(field.scope)?.legacy) || field.text !== (current.get(field.scope)?.deleted ? "" : current.get(field.scope)?.instruction ?? "")) && field.text.length > 0)
      .map(field => ({ scope: field.scope, expectedRevision: current.get(field.scope)?.revision ?? 0, operation: "set" as const, instruction: field.text })),
    ...deleted.filter(scope => current.has(scope) && !current.get(scope)!.deleted)
      .map(scope => ({ scope, expectedRevision: current.get(scope)!.revision, operation: "delete" as const })),
  ];
}
export function hasUnresolvedEmptyInstruction(document: OverallInstructions, fields: InstructionDraft[]) {
  return fields.some(field => (field.text.length > 0 && !field.text.trim()) || (!field.text && document.current.some(item => item.scope === field.scope && !item.deleted && item.instruction)));
}
/** Rebase only untouched scopes. Preserve changed fields until the user resolves conflicts. */
export function instructionConflicts(base: OverallInstructions, latest: OverallInstructions, changes: OverallInstructionsCommand["changes"]) {
  return changes.filter(change => (latest.current.find(item => item.scope === change.scope)?.revision ?? 0) !== (base.current.find(item => item.scope === change.scope)?.revision ?? 0)).map(change => change.scope);
}
