import type { LabResult, LabResultRow } from "@/types/emr-domain";
import { evaluateLabProfileValue, isLabProfileRule } from "./result-profile-contract";

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const optionalText = (v: unknown) => typeof v === "string" ? v : undefined;

// All selectors must match. The requested work item is not a patient-result ID.
export function parsePersistedLabResult(value: unknown, expected: {
  workspaceId: string; orderId: string; workItemId: string; encounterId: string;
}, base: LabResult): LabResult | null {
  if (!record(value) || value.ok !== true || value.workspaceId !== expected.workspaceId
    || value.orderId !== expected.orderId || value.workItemId !== expected.workItemId || value.encounterId !== expected.encounterId
    || typeof value.resultId !== "string" || !value.resultId || !Number.isSafeInteger(value.entryWriteRevision)
    || Number(value.entryWriteRevision) < 0 || !Array.isArray(value.rows) || value.rows.length === 0
    || !record(value.resultDefinitionSnapshot) || ![1, 2].includes(Number(value.resultDefinitionSnapshot.schemaVersion))) return null;
  const v2 = value.resultDefinitionSnapshot.schemaVersion === 2;
  const rows: LabResultRow[] = [];
  for (const raw of value.rows) {
    if (!record(raw) || typeof raw.id !== "string" || !raw.id || typeof raw.analyteName !== "string"
      || !(raw.value === null || typeof raw.value === "string")
      || !["numeric", "text", "coded"].includes(String(raw.resultValueKind))
      || !["low", "normal", "high", "critical", "abnormal", "not_judged"].includes(String(raw.judgment))) return null;
    if (v2) {
      if (!isLabProfileRule(raw.interpretationRule) || raw.resultValueKind !== raw.interpretationRule.resultValueKind
        || !["value", "instrument_no_result"].includes(String(raw.resultPresence))
        || !["exact", "less_than", "greater_than"].includes(String(raw.qualifier))
        || !(raw.deviceFlag === null || typeof raw.deviceFlag === "string")
        || raw.unit !== raw.interpretationRule.unit || raw.decimalScale !== raw.interpretationRule.decimalScale) return null;
      const evaluated = evaluateLabProfileValue(raw.interpretationRule, {
        value: raw.value as string | null, resultState: raw.resultPresence as "value" | "instrument_no_result",
        qualifier: raw.qualifier as "exact" | "less_than" | "greater_than", deviceFlag: raw.deviceFlag as string | null,
      });
      if (!evaluated.valid || evaluated.judgment !== raw.judgment || evaluated.state !== raw.resultState) return null;
    }
    rows.push({ id: raw.id, analyteName: raw.analyteName, value: optionalText(raw.value), unit: optionalText(raw.unit),
      referenceRange: optionalText(raw.referenceRange), judgment: raw.judgment as LabResultRow["judgment"],
      resultValueKind: raw.resultValueKind as LabResultRow["resultValueKind"], note: optionalText(raw.note),
      decimalScale: typeof raw.decimalScale === "number" ? raw.decimalScale : undefined,
      labTestItemId: optionalText(raw.labTestItemId), required: raw.required === true,
      ...(v2 ? { interpretationRule: raw.interpretationRule as LabResultRow["interpretationRule"],
        resultState: raw.resultState as LabResultRow["resultState"], resultPresence: raw.resultPresence as LabResultRow["resultPresence"],
        qualifier: raw.qualifier as LabResultRow["qualifier"], deviceFlag: optionalText(raw.deviceFlag) } : {}),
    });
  }
  if (new Set(rows.map(row => row.id)).size !== rows.length) return null;
  const profile = value.resultDefinitionSnapshot.resultProfile;
  if (v2 && (!record(profile) || !record(profile.device) || typeof profile.profileKey !== "string"
    || profile.clinicalUseAllowed !== false || profile.integrationStatus !== "not_integrated")) return null;
  return { ...base, id: value.resultId, rows, entryWriteRevision: Number(value.entryWriteRevision),
    resultDefinitionOrigin: "canonical", resultDefinitionSnapshotSha256: optionalText(value.resultDefinitionSnapshotSha256),
    resultProfileLabel: v2 && record(profile) && record(profile.device)
      ? `${profile.profileKey} r${profile.revision}${record(profile.workspaceOverride) ? ` · 병원 정상범위 v${profile.workspaceOverride.revision}` : ""} · ${profile.device.name} · 수동 입력 / 장비 미연동 / 합성 테스트용` : undefined,
  };
}
