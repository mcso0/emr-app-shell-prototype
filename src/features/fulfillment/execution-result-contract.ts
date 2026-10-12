export const executionResultFields = {
  dispensing: [
    { key: "preparedQuantity", label: "실제 준비수량", type: "number", required: true },
    { key: "preparedUnit", label: "실제 준비 단위", type: "text", required: true },
  ],
  treatment: [
    { key: "performedProcedure", label: "실제 시행한 처치", type: "text", required: true },
    { key: "site", label: "실제 시행 부위", type: "text" },
    { key: "performedCount", label: "실제 시행 횟수", type: "number" },
    { key: "performedCountUnit", label: "실제 횟수 단위", type: "text" },
    { key: "measurementValue", label: "실제 측정값", type: "signed_number" },
    { key: "measurementUnit", label: "실제 측정 단위", type: "text" },
    { key: "deviceIdentity", label: "실제 사용 장비·모델", type: "text" },
    { key: "deviceSettingsPolicy", label: "장비 설정 기록 방식", type: "device_policy" },
    { key: "deviceParameters", label: "실제 장비 설정값", type: "measurements" },
    { key: "observations", label: "실제 관찰 기록 (한 줄에 하나)", type: "lines" },
    { key: "materialIdentity", label: "실제 사용 재료·제품", type: "text" },
    { key: "administeredAmount", label: "실제 투여량 (투여한 경우)", type: "number" },
    { key: "administeredUnit", label: "실제 투여 단위", type: "text" },
    { key: "outcome", label: "시행 결과", type: "text", required: true },
  ],
  imaging: [
    { key: "acquisitionDisposition", label: "영상 수행 구분", type: "imaging_disposition", required: true },
    { key: "acquiredViews", label: "실제 획득·검토한 영상 뷰 (한 줄에 하나)", type: "lines", required: true },
    { key: "performedProtocol", label: "실제 촬영·판독 프로토콜", type: "text", required: true },
    { key: "quality", label: "영상 품질", type: "quality", required: true },
    { key: "findings", label: "영상 소견", type: "text", required: true },
    { key: "interpretation", label: "판독 결과", type: "text", required: true },
  ],
  hospitalization: [
    { key: "performedActivity", label: "실제 수행한 입원 업무", type: "text", required: true },
    { key: "outcome", label: "수행 결과", type: "text", required: true },
  ],
  consultation: [
    { key: "performedActivity", label: "실제 수행한 진료", type: "text", required: true },
    { key: "outcome", label: "진료 결과", type: "text", required: true },
  ],
  other: [
    { key: "performedActivity", label: "실제 수행한 업무", type: "text", required: true },
    { key: "outcome", label: "수행 결과", type: "text", required: true },
  ],
} satisfies Record<string, Array<{ key: string; label: string; type: string; required?: boolean }>>;

export type ExecutionResultType = keyof typeof executionResultFields;
export type ExecutionMeasurement = { name: string; value: number; unit: string };
export type ExecutionResultPayload = Record<string, string | number | string[] | ExecutionMeasurement[]>;
export type ExecutionResultVersion = {
  id: string; version: number; previousResultId: string | null; schemaVersion: 1;
  payload: ExecutionResultPayload; performedByUserId: string; performedAt: string;
  recordedByUserId: string; recordedAt: string; varianceReason: string | null;
  amendmentReason: string | null; planSha256: string;
};
export type ExecutionContext = {
  workspaceId: string; workItemId: string; taskId: string; attemptNo: number;
  orderId: string; encounterId: string; clinicalOrderType: ExecutionResultType;
  workItemRevision: number; status: string; isCurrentAttempt: boolean;
  planSnapshot: Record<string, unknown>; planSha256: string;
  resultRequired: boolean; canRecord: boolean; results: ExecutionResultVersion[];
};
export type ExecutionResultCommand = {
  expectedRevision: number; expectedPlanSha256: string; expectedResultVersion: number;
  commandId: string; performedAt: string; payload: ExecutionResultPayload;
  varianceReason?: string | null; amendmentReason?: string | null;
};

export const isExecutionRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const isExecutionUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const sha = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const integer = (v: unknown, min: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min;
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const reason = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim().length > 0 && v.trim().length <= 500);
export function isExecutionResultType(value: unknown): value is ExecutionResultType {
  return typeof value === "string" && Object.hasOwn(executionResultFields, value);
}

export function getExecutionResultFields(context: Pick<ExecutionContext, "clinicalOrderType" | "planSnapshot">) {
  const plan = isExecutionRecord(context.planSnapshot.detailInputs) ? context.planSnapshot.detailInputs : {};
  const required = new Set<string>();
  if (context.clinicalOrderType === "treatment" && [2, 3].includes(Number(context.planSnapshot.detailSchemaVersion))) {
    required.add("performedCount"); required.add("performedCountUnit");
    if (plan.procedureKind === "measurement") { required.add("measurementValue"); required.add("measurementUnit"); }
    if (plan.deviceProtocol && plan.procedureKind !== "monitoring") { required.add("deviceIdentity"); required.add("deviceSettingsPolicy"); }
    if (plan.procedureKind === "monitoring") required.add("observations");
    if (plan.administrationPolicy === "direct_quantity") { required.add("materialIdentity"); required.add("administeredAmount"); required.add("administeredUnit"); }
  }
  return executionResultFields[context.clinicalOrderType].map(field => ({ ...field, required: ("required" in field && field.required) || required.has(field.key) }));
}

export function parseExecutionPayload(type: ExecutionResultType, value: unknown, planSnapshot?: Record<string, unknown>): ExecutionResultPayload | null {
  if (!isExecutionRecord(value) || JSON.stringify(value).length > 32000) return null;
  const fields: ReadonlyArray<{ key: string; type: string; required?: boolean }> = executionResultFields[type];
  if (Object.keys(value).some(key => key !== "note" && !fields.some(field => field.key === key))) return null;
  for (const field of [...fields, { key: "note", type: "text" }]) {
    const v = value[field.key];
    if (v === undefined && !field.required) continue;
    if (field.type === "number" || field.type === "signed_number") {
      if (typeof v !== "number" || !Number.isFinite(v) || v < (field.type === "number" ? 0 : -1000000) || v > 1000000) return null;
    } else if (field.type === "measurements") {
      if (!Array.isArray(v) || v.length < 1 || v.length > 100 || v.some(x => !isExecutionRecord(x)
        || Object.keys(x).length !== 3 || typeof x.name !== "string" || !x.name.trim() || x.name.length > 200
        || typeof x.unit !== "string" || !x.unit.trim() || x.unit.length > 200
        || typeof x.value !== "number" || !Number.isFinite(x.value) || Math.abs(x.value) > 1000000)
        || new Set(v.map(x => x.name.trim())).size !== v.length) return null;
    } else if (field.type === "lines") {
      if (!Array.isArray(v) || v.length < 1 || v.length > 100 || v.some(x => typeof x !== "string" || !x.trim() || x.trim().length > 200)) return null;
    } else if (typeof v !== "string" || !v.trim() || v.trim().length > 4000) return null;
    if (field.type === "quality" && !["diagnostic", "limited", "non_diagnostic"].includes(v as string)) return null;
    if (field.type === "device_policy" && !["recorded_parameters", "not_adjustable"].includes(v as string)) return null;
    if (field.type === "imaging_disposition" && !["acquired_new", "reviewed_existing"].includes(v as string)) return null;
  }
  if (type === "treatment") {
    for (const [amount, unit] of [["administeredAmount", "administeredUnit"], ["performedCount", "performedCountUnit"], ["measurementValue", "measurementUnit"]]) {
      if (Object.hasOwn(value, amount) !== Object.hasOwn(value, unit)) return null;
    }
    if (planSnapshot && [2, 3].includes(Number(planSnapshot.detailSchemaVersion)) && isExecutionRecord(planSnapshot.detailInputs)) {
      const plan = planSnapshot.detailInputs;
      if (!Object.hasOwn(value, "performedCount")) return null;
      if (plan.procedureKind === "measurement" && !Object.hasOwn(value, "measurementValue")) return null;
      if (plan.deviceProtocol && plan.procedureKind !== "monitoring" && (!value.deviceIdentity || !value.deviceSettingsPolicy)) return null;
      if (plan.procedureKind === "monitoring" && !value.observations) return null;
      if (plan.administrationPolicy === "direct_quantity" && (!value.materialIdentity || !Object.hasOwn(value, "administeredAmount"))) return null;
    }
    if (value.deviceSettingsPolicy === "recorded_parameters" && !value.deviceParameters) return null;
    if (value.deviceSettingsPolicy === "not_adjustable" && value.deviceParameters) return null;
  }
  return value as ExecutionResultPayload;
}

export function parseExecutionCommand(value: unknown): ExecutionResultCommand | null {
  if (!isExecutionRecord(value) || Object.keys(value).some(key => ![
    "expectedRevision", "expectedPlanSha256", "expectedResultVersion", "commandId", "performedAt", "payload", "varianceReason", "amendmentReason",
  ].includes(key)) || !integer(value.expectedRevision, 1) || !sha(value.expectedPlanSha256)
    || !integer(value.expectedResultVersion, 0) || !isExecutionUuid(value.commandId) || !timestamp(value.performedAt)
    || !isExecutionRecord(value.payload) || !reason(value.varianceReason) || !reason(value.amendmentReason)) return null;
  if (JSON.stringify(value).length > 40000) return null;
  return value as ExecutionResultCommand;
}

export function parseExecutionContext(value: unknown, workspaceId: string, workItemId: string, taskId?: string): ExecutionContext | null {
  if (!isExecutionRecord(value) || value.workspaceId !== workspaceId || value.workItemId !== workItemId
    || !isExecutionUuid(value.taskId) || (taskId !== undefined && taskId !== value.taskId)
    || !isExecutionUuid(value.orderId) || !isExecutionUuid(value.encounterId)
    || !integer(value.attemptNo, 1) || !integer(value.workItemRevision, 1) || !isExecutionResultType(value.clinicalOrderType)
    || !isExecutionRecord(value.planSnapshot) || !sha(value.planSha256) || typeof value.resultRequired !== "boolean"
    || typeof value.canRecord !== "boolean" || typeof value.isCurrentAttempt !== "boolean"
    || typeof value.status !== "string" || !["requested", "pending", "in_progress", "paused", "completed", "complete", "returned", "cancelled"].includes(value.status)
    || !Array.isArray(value.results)) return null;
  let previous: string | null = null;
  const ids = new Set<string>();
  for (let i = 0; i < value.results.length; i++) {
    const r: unknown = value.results[i];
    if (!isExecutionRecord(r) || !isExecutionUuid(r.id) || ids.has(r.id) || r.version !== i + 1 || r.previousResultId !== previous
      || r.schemaVersion !== 1 || r.planSha256 !== value.planSha256 || !parseExecutionPayload(value.clinicalOrderType, r.payload, value.planSnapshot)
      || !isExecutionUuid(r.performedByUserId) || !isExecutionUuid(r.recordedByUserId) || !timestamp(r.performedAt) || !timestamp(r.recordedAt)
      || !reason(r.varianceReason) || !reason(r.amendmentReason) || (i === 0 ? r.amendmentReason !== null : !r.amendmentReason)) return null;
    previous = r.id; ids.add(r.id);
  }
  return value as ExecutionContext;
}

export const executionErrorMessage = (code: string) => ({
  treatment_medication_link_required: "수행 전에 처치 계획을 수정해 약품 오더를 연결해 주세요.",
  treatment_medication_link_invalid: "연결 약품 오더가 취소되었거나 확정되지 않았습니다. 같은 진료의 유효한 약품 오더를 확인해 주세요.",
  unauthenticated: "로그인 세션이 필요합니다. 다시 로그인한 뒤 시도해 주세요.",
  current_assignee_required: "현재 담당자만 수행기록을 저장할 수 있습니다. 담당 상태를 다시 확인해 주세요.",
  permission_missing: "이 업무의 수행기록을 조회하거나 저장할 권한이 없습니다.",
  workspace_membership_missing: "현재 워크스페이스에 접근할 수 없습니다.",
  variance_reason_required: "예정량과 실제량이 다르거나 비교 단위가 없습니다. 차이 사유를 입력해 주세요.",
  amendment_reason_required: "기록을 정정하는 사유를 입력해 주세요.",
  revision_conflict: "업무가 변경됐습니다. 최신 기록을 다시 불러와 주세요.",
  plan_revision_conflict: "계획이 변경됐습니다. 최신 계획을 확인한 뒤 다시 기록해 주세요.",
  result_revision_conflict: "다른 수행기록이 먼저 저장됐습니다. 최신 이력을 다시 불러와 주세요.",
  invalid_performed_at: "업무 생성 이후의 실제 수행 시각을 입력해 주세요. 미래 시각은 사용할 수 없습니다.",
  invalid_execution_payload: "필수 수행값과 단위를 확인해 주세요.",
  invalid_transition: "현재 업무 상태에서는 저장할 수 없습니다. 업무 시작 또는 최신 상태를 확인해 주세요.",
} as Record<string, string>)[code] ?? "수행기록을 저장하거나 불러오지 못했습니다. 입력값을 유지하고 다시 시도해 주세요.";
