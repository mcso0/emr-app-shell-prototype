import { isExecutionRecord, isExecutionUuid } from "@/features/fulfillment/execution-result-contract";

export type ChartActualType = "system_exam" | "consultation" | "other";
export type ChartActualRecord = { performedAt: string; selfPerformed: true; payload: Record<string, string> };
export type ChartActualRecords = Record<string, ChartActualRecord>;
export const isChartActualType = (value: unknown): value is ChartActualType =>
  value === "system_exam" || value === "consultation" || value === "other";
export const isActualTimestamp = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
export function parseChartActualPayload(type: ChartActualType, value: unknown): Record<string, string> | null {
  if (!isExecutionRecord(value)) return null;
  const keys = type === "system_exam" ? ["findingSummary"] : ["performedActivity", "outcome"];
  if (Object.keys(value).length !== keys.length || keys.some(key => typeof value[key] !== "string"
    || !(value[key] as string).trim() || (value[key] as string).length > 4000)) return null;
  return value as Record<string, string>;
}
export function parseChartActualRecords(value: unknown): ChartActualRecords | null {
  if (value === undefined) return {};
  if (!isExecutionRecord(value) || Object.keys(value).length > 500) return null;
  for (const [id, record] of Object.entries(value)) {
    if (!isExecutionUuid(id) || !isExecutionRecord(record) || Object.keys(record).length !== 3
      || record.selfPerformed !== true || !isActualTimestamp(record.performedAt)
      || !(parseChartActualPayload("system_exam", record.payload) || parseChartActualPayload("other", record.payload))) return null;
  }
  return value as ChartActualRecords;
}
export type ChartActualVersion = { id: string; version: number; previousResultId: string | null; payload: Record<string, string>;
  performedByUserId: string; performedAt: string; recordedByUserId: string; recordedAt: string; amendmentReason: string | null };
export type ChartActualContext = { workspaceId: string; taskId: string; orderId: string; attemptNo: number;
  clinicalOrderType: ChartActualType; planSha256: string; planSnapshot: Record<string, unknown>; canAmend: boolean; results: ChartActualVersion[] };
export function parseChartActualContext(value: unknown, workspaceId: string, taskId: string): ChartActualContext | null {
  if (!isExecutionRecord(value) || value.workspaceId !== workspaceId || value.taskId !== taskId
    || !isExecutionUuid(value.orderId) || !isChartActualType(value.clinicalOrderType)
    || !Number.isSafeInteger(value.attemptNo) || Number(value.attemptNo) < 1
    || typeof value.planSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.planSha256)
    || !isExecutionRecord(value.planSnapshot) || typeof value.canAmend !== "boolean" || !Array.isArray(value.results)) return null;
  let previous: string | null = null;
  const seen = new Set<string>();
  for (const [index, result] of value.results.entries()) {
    if (!isExecutionRecord(result) || !isExecutionUuid(result.id) || result.version !== index + 1
      || seen.has(result.id) || result.previousResultId !== previous || !parseChartActualPayload(value.clinicalOrderType, result.payload)
      || !isExecutionUuid(result.performedByUserId) || !isExecutionUuid(result.recordedByUserId)
      || !isActualTimestamp(result.performedAt) || !isActualTimestamp(result.recordedAt)
      || (index === 0 ? result.amendmentReason !== null : typeof result.amendmentReason !== "string" || !result.amendmentReason.trim())) return null;
    previous = result.id;
    seen.add(result.id);
  }
  return value as ChartActualContext;
}
