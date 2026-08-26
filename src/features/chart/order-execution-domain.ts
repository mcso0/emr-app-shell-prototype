import type {
  ClinicalOrderDestinationModule,
  ClinicalOrderExecutionMode,
  ClinicalOrderType,
  ServiceItemType,
  UniversalOrderTaskStatus,
} from "@/types/emr-domain";

export const CLINICAL_ORDER_TYPES = [
  "consultation",
  "clinical_lab",
  "imaging",
  "external_lab",
  "dispensing",
  "treatment",
  "hospitalization",
  "other",
] as const satisfies readonly ClinicalOrderType[];

export const CLINICAL_ORDER_DESTINATION_MODULES = [
  "consultation",
  "lab",
  "imaging",
  "external_lab",
  "dispensing",
  "treatment",
  "hospitalization",
  "other",
] as const satisfies readonly ClinicalOrderDestinationModule[];

export type ClinicalOrderFieldValueType =
  | "string"
  | "number"
  | "boolean"
  | "string_array"
  | "attachment_array";

export type ClinicalOrderFieldControl =
  | "input"
  | "number"
  | "select"
  | "switch"
  | "textarea"
  | "schedule"
  | "attachments";

export type ClinicalOrderFieldPlacement = "inline" | "detail";
export type ClinicalOrderFieldSemantics =
  | "clinical"
  | "instruction"
  | "calculation_input"
  | "metadata";

export type ClinicalOrderFieldValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  precision?: number;
};

export type ClinicalOrderFieldDefinition = {
  key: string;
  valueType: ClinicalOrderFieldValueType;
  label: string;
  control: ClinicalOrderFieldControl;
  unit: string | null;
  options: readonly string[];
  displayOrder: number;
  required: boolean;
  defaultValue: unknown;
  validation: ClinicalOrderFieldValidation;
  placement: ClinicalOrderFieldPlacement;
  bulkEditable: boolean;
  semantics: ClinicalOrderFieldSemantics;
  preConfirmEditable: boolean;
  postConfirmBehavior: "amendment" | "immutable";
  snapshotPath: `detailInputs.${string}`;
};

export type ClinicalOrderFieldSchema = {
  clinicalOrderType: ClinicalOrderType;
  label: string;
  version: 1;
  defaultDestinationModule: ClinicalOrderDestinationModule | null;
  defaultExecutionMode: Exclude<ClinicalOrderExecutionMode, "aggregate">;
  fields: readonly ClinicalOrderFieldDefinition[];
};

type FieldInput = Omit<
  ClinicalOrderFieldDefinition,
  | "unit"
  | "options"
  | "required"
  | "defaultValue"
  | "validation"
  | "bulkEditable"
  | "semantics"
  | "preConfirmEditable"
  | "postConfirmBehavior"
  | "snapshotPath"
> &
  Partial<
    Pick<
      ClinicalOrderFieldDefinition,
      | "unit"
      | "options"
      | "required"
      | "defaultValue"
      | "validation"
      | "bulkEditable"
      | "semantics"
      | "preConfirmEditable"
      | "postConfirmBehavior"
    >
  >;

function field(input: FieldInput): ClinicalOrderFieldDefinition {
  return {
    ...input,
    unit: input.unit ?? null,
    options: input.options ?? [],
    required: input.required ?? false,
    defaultValue: input.defaultValue ?? null,
    validation: input.validation ?? {},
    bulkEditable: input.bulkEditable ?? false,
    semantics: input.semantics ?? "clinical",
    preConfirmEditable: input.preConfirmEditable ?? true,
    postConfirmBehavior: input.postConfirmBehavior ?? "amendment",
    snapshotPath: `detailInputs.${input.key}`,
  };
}

export const CLINICAL_ORDER_FIELD_SCHEMAS: Readonly<
  Record<ClinicalOrderType, ClinicalOrderFieldSchema>
> = {
  consultation: {
    clinicalOrderType: "consultation",
    label: "진료",
    version: 1,
    defaultDestinationModule: null,
    defaultExecutionMode: "immediate_complete",
    fields: [
      field({ key: "responsibleClinicianId", valueType: "string", label: "담당자", control: "select", displayOrder: 10, required: true, placement: "inline", bulkEditable: true, semantics: "metadata" }),
      field({ key: "occurrenceCount", valueType: "number", label: "횟수", control: "number", unit: "회", displayOrder: 20, required: true, defaultValue: 1, validation: { min: 1, precision: 0 }, placement: "inline", bulkEditable: true, semantics: "calculation_input" }),
      field({ key: "timing", valueType: "string", label: "실행 시점", control: "select", options: ["now", "scheduled"], displayOrder: 30, required: true, defaultValue: "now", placement: "inline", bulkEditable: true }),
      field({ key: "instructionSummary", valueType: "string", label: "지시 요약", control: "input", displayOrder: 40, required: true, validation: { minLength: 1, maxLength: 300 }, placement: "inline", semantics: "instruction" }),
      field({ key: "consultationNote", valueType: "string", label: "상담 메모", control: "textarea", displayOrder: 110, validation: { maxLength: 4000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "attachments", valueType: "attachment_array", label: "첨부", control: "attachments", displayOrder: 120, placement: "detail", semantics: "metadata" }),
    ],
  },
  clinical_lab: {
    clinicalOrderType: "clinical_lab",
    label: "임상",
    version: 1,
    defaultDestinationModule: "lab",
    defaultExecutionMode: "routed",
    fields: [
      field({ key: "specimenType", valueType: "string", label: "검체", control: "select", options: ["blood", "serum", "plasma", "urine", "feces", "swab", "other"], displayOrder: 10, required: true, placement: "inline", bulkEditable: true }),
      field({ key: "testPanel", valueType: "string", label: "패널/항목", control: "input", displayOrder: 20, required: true, validation: { minLength: 1, maxLength: 200 }, placement: "inline" }),
      field({ key: "collectionCondition", valueType: "string", label: "채취 조건", control: "input", displayOrder: 30, required: true, validation: { minLength: 1, maxLength: 300 }, placement: "inline", bulkEditable: true, semantics: "instruction" }),
      field({ key: "pretreatment", valueType: "string", label: "전처리", control: "textarea", displayOrder: 110, validation: { maxLength: 1000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "clinicalContext", valueType: "string", label: "추가 임상정보", control: "textarea", displayOrder: 120, validation: { maxLength: 4000 }, placement: "detail" }),
    ],
  },
  imaging: {
    clinicalOrderType: "imaging",
    label: "영상",
    version: 1,
    defaultDestinationModule: "imaging",
    defaultExecutionMode: "routed",
    fields: [
      field({ key: "bodyRegion", valueType: "string", label: "부위", control: "input", displayOrder: 10, required: true, validation: { minLength: 1, maxLength: 120 }, placement: "inline", bulkEditable: true }),
      field({ key: "position", valueType: "string", label: "자세", control: "input", displayOrder: 20, required: true, validation: { minLength: 1, maxLength: 120 }, placement: "inline", bulkEditable: true }),
      field({ key: "viewCount", valueType: "number", label: "View 수", control: "number", unit: "view", displayOrder: 30, required: true, defaultValue: 1, validation: { min: 1, max: 20, precision: 0 }, placement: "inline", bulkEditable: true, semantics: "calculation_input" }),
      field({ key: "contrastRequired", valueType: "boolean", label: "조영", control: "switch", displayOrder: 40, required: true, defaultValue: false, placement: "inline", bulkEditable: true }),
      field({ key: "sedationRequired", valueType: "boolean", label: "진정", control: "switch", displayOrder: 50, required: true, defaultValue: false, placement: "inline", bulkEditable: true }),
      field({ key: "imagingProtocol", valueType: "string", label: "촬영 프로토콜", control: "textarea", displayOrder: 110, validation: { maxLength: 4000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "exceptions", valueType: "string", label: "예외", control: "textarea", displayOrder: 120, validation: { maxLength: 2000 }, placement: "detail", semantics: "instruction" }),
    ],
  },
  external_lab: {
    clinicalOrderType: "external_lab",
    label: "원외(검사)",
    version: 1,
    defaultDestinationModule: "external_lab",
    defaultExecutionMode: "routed",
    fields: [
      field({ key: "providerId", valueType: "string", label: "검사 기관", control: "select", displayOrder: 10, required: true, placement: "inline", bulkEditable: true, semantics: "metadata" }),
      field({ key: "specimenType", valueType: "string", label: "검체", control: "select", options: ["blood", "serum", "plasma", "urine", "feces", "swab", "tissue", "other"], displayOrder: 20, required: true, placement: "inline", bulkEditable: true }),
      field({ key: "testItem", valueType: "string", label: "검사항목", control: "input", displayOrder: 30, required: true, validation: { minLength: 1, maxLength: 200 }, placement: "inline" }),
      field({ key: "shippingCondition", valueType: "string", label: "발송 조건", control: "input", displayOrder: 40, required: true, validation: { minLength: 1, maxLength: 300 }, placement: "inline", bulkEditable: true, semantics: "instruction" }),
      field({ key: "providerForm", valueType: "attachment_array", label: "기관 양식", control: "attachments", displayOrder: 110, placement: "detail", semantics: "metadata" }),
      field({ key: "packaging", valueType: "string", label: "포장 정보", control: "textarea", displayOrder: 120, validation: { maxLength: 1000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "tracking", valueType: "string", label: "추적 정보", control: "input", displayOrder: 130, validation: { maxLength: 200 }, placement: "detail", semantics: "metadata" }),
    ],
  },
  dispensing: {
    clinicalOrderType: "dispensing",
    label: "조제",
    version: 1,
    defaultDestinationModule: "dispensing",
    defaultExecutionMode: "routed",
    fields: [
      field({ key: "doseBasis", valueType: "string", label: "용량 기준", control: "select", options: ["patient", "kg", "body_surface_area"], displayOrder: 10, required: true, placement: "inline", bulkEditable: true, semantics: "calculation_input" }),
      field({ key: "dose", valueType: "number", label: "용량", control: "number", displayOrder: 20, required: true, validation: { min: 0, precision: 3 }, placement: "inline", semantics: "calculation_input" }),
      field({ key: "doseUnit", valueType: "string", label: "단위", control: "select", options: ["mg", "mg/kg", "ml", "ml/kg", "tablet", "capsule", "drop"], displayOrder: 30, required: true, placement: "inline", bulkEditable: true, semantics: "calculation_input" }),
      field({ key: "route", valueType: "string", label: "경로", control: "select", options: ["PO", "IV", "IM", "SC", "topical", "otic", "ophthalmic", "other"], displayOrder: 40, required: true, placement: "inline", bulkEditable: true, semantics: "instruction" }),
      field({ key: "frequency", valueType: "string", label: "빈도", control: "select", options: ["once", "sid", "bid", "tid", "qid", "prn", "custom"], displayOrder: 50, required: true, placement: "inline", bulkEditable: true, semantics: "calculation_input" }),
      field({ key: "durationDays", valueType: "number", label: "일수", control: "number", unit: "일", displayOrder: 60, required: true, validation: { min: 1, precision: 0 }, placement: "inline", semantics: "calculation_input" }),
      field({ key: "totalQuantity", valueType: "number", label: "총량", control: "number", displayOrder: 70, required: true, validation: { min: 0, precision: 3 }, placement: "inline", semantics: "calculation_input" }),
      field({ key: "taperSchedule", valueType: "string", label: "증감 스케줄", control: "schedule", displayOrder: 110, validation: { maxLength: 4000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "compoundNote", valueType: "string", label: "조제 메모", control: "textarea", displayOrder: 120, validation: { maxLength: 2000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "guardianNote", valueType: "string", label: "보호자 전달 메모", control: "textarea", displayOrder: 130, validation: { maxLength: 2000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "extraLabelSpeciesConfirmed", valueType: "boolean", label: "병원 종 범위 예외 확인", control: "switch", displayOrder: 140, defaultValue: false, placement: "detail", semantics: "clinical" }),
      field({ key: "extraLabelSpeciesReason", valueType: "string", label: "종 범위 예외 사유", control: "textarea", displayOrder: 150, validation: { maxLength: 500 }, placement: "detail", semantics: "clinical" }),
    ],
  },
  treatment: {
    clinicalOrderType: "treatment",
    label: "처치",
    version: 1,
    defaultDestinationModule: "treatment",
    defaultExecutionMode: "routed",
    fields: [
      field({ key: "method", valueType: "string", label: "방법", control: "input", displayOrder: 10, required: true, validation: { minLength: 1, maxLength: 200 }, placement: "inline", bulkEditable: true, semantics: "instruction" }),
      field({ key: "site", valueType: "string", label: "부위", control: "input", displayOrder: 20, required: true, validation: { minLength: 1, maxLength: 120 }, placement: "inline", bulkEditable: true }),
      field({ key: "administeredAmount", valueType: "number", label: "투여량", control: "number", displayOrder: 30, required: true, validation: { min: 0, precision: 3 }, placement: "inline", semantics: "calculation_input" }),
      field({ key: "frequency", valueType: "string", label: "횟수", control: "select", options: ["once", "sid", "bid", "tid", "qid", "custom"], displayOrder: 40, required: true, placement: "inline", bulkEditable: true, semantics: "instruction" }),
      field({ key: "schedule", valueType: "string", label: "실행 일정", control: "schedule", displayOrder: 50, required: true, validation: { minLength: 1, maxLength: 1000 }, placement: "inline", semantics: "instruction" }),
      field({ key: "stagedInstructions", valueType: "string", label: "단계별 지시", control: "textarea", displayOrder: 110, validation: { maxLength: 4000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "exceptions", valueType: "string", label: "예외", control: "textarea", displayOrder: 120, validation: { maxLength: 2000 }, placement: "detail", semantics: "instruction" }),
    ],
  },
  hospitalization: {
    clinicalOrderType: "hospitalization",
    label: "입원",
    version: 1,
    defaultDestinationModule: "hospitalization",
    defaultExecutionMode: "routed",
    fields: [
      field({ key: "durationDays", valueType: "number", label: "기간", control: "number", unit: "일", displayOrder: 10, required: true, validation: { min: 1, precision: 0 }, placement: "inline", semantics: "calculation_input" }),
      field({ key: "wardOrCage", valueType: "string", label: "병동/케이지", control: "select", displayOrder: 20, required: true, placement: "inline", bulkEditable: true, semantics: "metadata" }),
      field({ key: "careLevel", valueType: "string", label: "관리 수준", control: "select", options: ["standard", "enhanced", "intensive", "isolation"], displayOrder: 30, required: true, placement: "inline", bulkEditable: true, semantics: "instruction" }),
      field({ key: "monitoringInterval", valueType: "number", label: "모니터링 주기", control: "number", unit: "분", displayOrder: 40, required: true, validation: { min: 1, precision: 0 }, placement: "inline", bulkEditable: true, semantics: "instruction" }),
      field({ key: "nursingPlan", valueType: "string", label: "간호 계획", control: "textarea", displayOrder: 110, validation: { maxLength: 4000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "dietPlan", valueType: "string", label: "식이 계획", control: "textarea", displayOrder: 120, validation: { maxLength: 2000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "isolationPlan", valueType: "string", label: "격리 계획", control: "textarea", displayOrder: 130, validation: { maxLength: 2000 }, placement: "detail", semantics: "instruction" }),
    ],
  },
  other: {
    clinicalOrderType: "other",
    label: "기타",
    version: 1,
    defaultDestinationModule: null,
    defaultExecutionMode: "immediate_complete",
    fields: [
      field({ key: "structuredValue", valueType: "string", label: "구조화 입력", control: "input", displayOrder: 10, required: true, validation: { minLength: 1, maxLength: 500 }, placement: "inline" }),
      field({ key: "description", valueType: "string", label: "설명", control: "textarea", displayOrder: 110, validation: { maxLength: 4000 }, placement: "detail", semantics: "instruction" }),
      field({ key: "attachments", valueType: "attachment_array", label: "첨부", control: "attachments", displayOrder: 120, placement: "detail", semantics: "metadata" }),
      field({ key: "exceptions", valueType: "string", label: "예외", control: "textarea", displayOrder: 130, validation: { maxLength: 2000 }, placement: "detail", semantics: "instruction" }),
    ],
  },
};

export type ClinicalOrderMasterContractInput = {
  categoryGroup: ServiceItemType;
  clinicalOrderType?: unknown;
  isExternalLab?: unknown;
  destinationModule?: unknown;
  defaultDestinationModule?: unknown;
  executionMode?: unknown;
  defaultTaskRequired?: unknown;
  detailSchemaVersion?: unknown;
  detailFieldSchema?: unknown;
  billingEligible?: unknown;
  billingReflectionEnabled?: unknown;
};

export type ClinicalOrderMasterContract = {
  clinicalOrderType: ClinicalOrderType;
  isExternalLab: boolean;
  destinationModule: ClinicalOrderDestinationModule | null;
  executionMode: Exclude<ClinicalOrderExecutionMode, "aggregate">;
  detailSchemaVersion: 1;
  detailFieldSchema: ClinicalOrderFieldSchema;
  billingEligible: boolean;
};

export function resolveClinicalOrderMasterContract(
  input: ClinicalOrderMasterContractInput,
): ClinicalOrderMasterContract {
  const explicitType = isClinicalOrderType(input.clinicalOrderType)
    ? input.clinicalOrderType
    : null;
  const isExternalLab = input.isExternalLab === true;
  const clinicalOrderType =
    explicitType ?? mapLegacyCategoryToClinicalOrderType(input.categoryGroup, isExternalLab);
  const schema = CLINICAL_ORDER_FIELD_SCHEMAS[clinicalOrderType];
  const explicitMode = isExecutionMode(input.executionMode)
    ? input.executionMode
    : null;
  const legacyDestination =
    input.destinationModule ?? input.defaultDestinationModule;
  const normalizedDestination = normalizeDestination(legacyDestination);
  const taskRequired = input.defaultTaskRequired !== false;
  const executionMode =
    explicitMode === "immediate_complete" ||
    legacyDestination === "billing_only" ||
    legacyDestination === "chart_only" ||
    !taskRequired
      ? "immediate_complete"
      : explicitMode === "routed" || normalizedDestination
        ? "routed"
        : schema.defaultExecutionMode;
  const destinationModule =
    executionMode === "routed"
      ? normalizedDestination ?? schema.defaultDestinationModule
      : null;

  if (executionMode === "routed" && !destinationModule) {
    throw new Error("routed_order_requires_destination");
  }

  return {
    clinicalOrderType,
    isExternalLab: clinicalOrderType === "external_lab",
    destinationModule,
    executionMode,
    detailSchemaVersion:
      input.detailSchemaVersion === 1 ? 1 : schema.version,
    detailFieldSchema:
      isClinicalOrderFieldSchema(input.detailFieldSchema)
        ? input.detailFieldSchema
        : schema,
    billingEligible:
      typeof input.billingEligible === "boolean"
        ? input.billingEligible
        : input.billingReflectionEnabled !== false,
  };
}

export type ClinicalOrderDetailValidationResult =
  | { valid: true; normalized: Record<string, unknown> }
  | { valid: false; fieldErrors: Record<string, string> };

export function validateClinicalOrderDetailInputs({
  clinicalOrderType,
  detailInputs,
  requireComplete = true,
  schemaVersion,
}: {
  clinicalOrderType: ClinicalOrderType;
  detailInputs: unknown;
  requireComplete?: boolean;
  schemaVersion: number;
}): ClinicalOrderDetailValidationResult {
  const schema = CLINICAL_ORDER_FIELD_SCHEMAS[clinicalOrderType];
  if (schemaVersion !== schema.version) {
    return { valid: false, fieldErrors: { _schema: "detail_schema_version_mismatch" } };
  }
  if (!isRecord(detailInputs)) {
    return { valid: false, fieldErrors: { _root: "detail_inputs_must_be_object" } };
  }

  const fieldErrors: Record<string, string> = {};
  const normalized: Record<string, unknown> = {};
  const fieldKeys = new Set(schema.fields.map((definition) => definition.key));
  for (const key of Object.keys(detailInputs)) {
    if (!fieldKeys.has(key)) fieldErrors[key] = "unknown_field";
  }
  for (const definition of schema.fields) {
    const value = detailInputs[definition.key] ?? definition.defaultValue;
    if (requireComplete && definition.required && isEmptyValue(value)) {
      fieldErrors[definition.key] = "required";
      continue;
    }
    if (isEmptyValue(value)) continue;
    const error = validateFieldValue(definition, value);
    if (error) {
      fieldErrors[definition.key] = error;
      continue;
    }
    normalized[definition.key] = value;
  }

  return Object.keys(fieldErrors).length > 0
    ? { valid: false, fieldErrors }
    : { valid: true, normalized };
}

export function isClinicalOrderType(value: unknown): value is ClinicalOrderType {
  return typeof value === "string" &&
    (CLINICAL_ORDER_TYPES as readonly string[]).includes(value);
}

export function deriveAggregateTaskStatus(
  childStatuses: readonly UniversalOrderTaskStatus[],
): UniversalOrderTaskStatus {
  if (childStatuses.length === 0) return "pending";

  const cancelledCount = childStatuses.filter(
    (status) => status === "cancelled",
  ).length;
  if (cancelledCount === childStatuses.length) return "cancelled";

  const terminalCount = childStatuses.filter(
    (status) => status === "complete" || status === "cancelled",
  ).length;
  if (
    terminalCount === childStatuses.length &&
    childStatuses.some((status) => status === "complete")
  ) {
    return "complete";
  }

  if (childStatuses.some((status) => status === "in_progress")) {
    return "in_progress";
  }
  if (terminalCount > 0) return "partial_complete";
  if (childStatuses.some((status) => status === "paused")) return "paused";
  return "pending";
}

function isExecutionMode(
  value: unknown,
): value is Exclude<ClinicalOrderExecutionMode, "aggregate"> {
  return value === "routed" || value === "immediate_complete";
}

function normalizeDestination(
  value: unknown,
): ClinicalOrderDestinationModule | null {
  if (
    typeof value === "string" &&
    (CLINICAL_ORDER_DESTINATION_MODULES as readonly string[]).includes(value)
  ) {
    return value as ClinicalOrderDestinationModule;
  }
  return null;
}

function mapLegacyCategoryToClinicalOrderType(
  categoryGroup: ServiceItemType,
  isExternalLab: boolean,
): ClinicalOrderType {
  switch (categoryGroup) {
    case "consultation":
      return "consultation";
    case "lab":
      return isExternalLab ? "external_lab" : "clinical_lab";
    case "imaging":
      return "imaging";
    case "medication":
      return "dispensing";
    case "treatment":
      return "treatment";
    case "hospitalization":
      return "hospitalization";
    case "misc":
    default:
      return "other";
  }
}

function isClinicalOrderFieldSchema(
  value: unknown,
): value is ClinicalOrderFieldSchema {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isClinicalOrderType(value.clinicalOrderType) &&
    Array.isArray(value.fields)
  );
}

function validateFieldValue(
  definition: ClinicalOrderFieldDefinition,
  value: unknown,
): string | null {
  if (definition.valueType === "string" && typeof value !== "string") {
    return "expected_string";
  }
  if (
    definition.valueType === "number" &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    return "expected_number";
  }
  if (definition.valueType === "boolean" && typeof value !== "boolean") {
    return "expected_boolean";
  }
  if (
    (definition.valueType === "string_array" ||
      definition.valueType === "attachment_array") &&
    !Array.isArray(value)
  ) {
    return "expected_array";
  }
  if (
    definition.valueType === "string_array" &&
    Array.isArray(value) &&
    value.some((entry) => typeof entry !== "string")
  ) {
    return "expected_string_array";
  }
  if (typeof value === "string") {
    if (
      definition.validation.minLength !== undefined &&
      value.trim().length < definition.validation.minLength
    ) {
      return "min_length";
    }
    if (
      definition.validation.maxLength !== undefined &&
      value.length > definition.validation.maxLength
    ) {
      return "max_length";
    }
    if (definition.options.length > 0 && !definition.options.includes(value)) {
      return "invalid_option";
    }
  }
  if (typeof value === "number") {
    if (
      definition.validation.min !== undefined &&
      value < definition.validation.min
    ) {
      return "below_minimum";
    }
    if (
      definition.validation.max !== undefined &&
      value > definition.validation.max
    ) {
      return "above_maximum";
    }
    if (
      definition.validation.precision === 0 &&
      !Number.isInteger(value)
    ) {
      return "integer_required";
    }
  }
  return null;
}

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
