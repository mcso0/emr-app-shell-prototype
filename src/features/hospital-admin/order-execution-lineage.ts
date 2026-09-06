// Transport validation only. Source cells are persisted provenance, never a
// fallback value for the current workspace or an old confirmed plan.
export type ExecutionFieldCell = {
  present: boolean;
  policyPresent: boolean;
  value?: unknown;
  policy?: string;
};
export type ExecutionFieldSource = {
  cell: ExecutionFieldCell;
  masterRevision: number;
  presetRevision: number;
  presetId: string;
  sha256: string;
};
export type ExecutionSourceBaseline = Record<string, ExecutionFieldSource>;
export type ExecutionFieldConflict = {
  base: ExecutionFieldCell | null;
  local: ExecutionFieldCell;
  incoming: ExecutionFieldSource;
};
export type ExecutionMergeConflicts = Record<string, ExecutionFieldConflict | {
  masterRevision: number;
  presetRevision: number;
  clinicalOrderType?: string;
  detailSchemaVersion?: number;
  proposedValues?: Record<string, unknown>;
  proposedPolicies?: Record<string, unknown>;
}>;

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const fieldKey = (v: string) => /^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(v);
const policies = new Set(["preset_fixed", "derived_from_profile", "schema_default",
  "workspace_resolved", "runtime_resolved", "required_manual", "not_applicable"]);
function isCell(v: unknown): v is ExecutionFieldCell {
  return record(v) && typeof v.present === "boolean" && typeof v.policyPresent === "boolean" &&
    Object.hasOwn(v, "value") === v.present && Object.hasOwn(v, "policy") === v.policyPresent &&
    (!v.policyPresent || (typeof v.policy === "string" && policies.has(v.policy)));
}
function isSource(v: unknown): v is ExecutionFieldSource {
  return record(v) && isCell(v.cell) && revision(v.masterRevision) && revision(v.presetRevision) &&
    typeof v.presetId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.presetId) &&
    typeof v.sha256 === "string" && /^[0-9a-f]{64}$/.test(v.sha256);
}
export function parseExecutionSourceBaseline(value: unknown): ExecutionSourceBaseline | undefined | null {
  if (value === undefined) return undefined; // Older history has no field lineage.
  if (!record(value) || Object.entries(value).some(([k, v]) => !fieldKey(k) || !isSource(v))) return null;
  return structuredClone(value) as ExecutionSourceBaseline;
}
export function parseExecutionMergeConflicts(value: unknown): ExecutionMergeConflicts | undefined | null {
  if (value === undefined) return undefined;
  if (!record(value)) return null;
  for (const [key, conflict] of Object.entries(value)) {
    if (!record(conflict)) return null;
    if (key === "$schema") {
      if (!revision(conflict.masterRevision) || !revision(conflict.presetRevision) ||
        typeof conflict.clinicalOrderType !== "string" || !revision(conflict.detailSchemaVersion)) return null;
    } else if (key === "$contract") {
      if (!revision(conflict.masterRevision) || !revision(conflict.presetRevision) ||
        !record(conflict.proposedValues) || !record(conflict.proposedPolicies)) return null;
    } else if (!fieldKey(key) || !(conflict.base === null || isCell(conflict.base)) ||
      !isCell(conflict.local) || !isSource(conflict.incoming)) return null;
  }
  return structuredClone(value) as ExecutionMergeConflicts;
}
export function parseExecutionCustomizedFields(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(v => typeof v !== "string" ||
    !(["*", "defaultDetailInputs", "default_detail_inputs"].includes(v) ||
      (v.startsWith("defaultDetailInputs.") && fieldKey(v.slice("defaultDetailInputs.".length))))) ||
    new Set(value).size !== value.length) return null;
  return [...value];
}
