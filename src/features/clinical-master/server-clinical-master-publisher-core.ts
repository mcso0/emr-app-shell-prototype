import { parsePlanOrderAuthority } from "@/features/chart/plan-order-authority-domain";
import { parseLabResultProfile, type LabResultProfile } from "@/features/lab-imaging/result-profile-contract";
import { expandLabComposition, parseLabComposition, type LabComposition } from "@/features/lab-imaging/composition-contract";
import { isOrderTaxonomyValid } from "@/features/hospital-admin/order-taxonomy";

// Server-only validation and normalization seam.
// PostgreSQL remains the sole release fingerprint authority.

export const clinicalMasterRecordTypes = [
  "order_category",
  "clinical_action",
  "chart_group",
  "task_route",
  "order",
  "species",
  "unit",
  "specimen_type",
  "result_input_type",
  "lab_test",
  "lab_panel",
] as const;

export type ClinicalMasterRecordType = (typeof clinicalMasterRecordTypes)[number];
export type ClinicalMasterLanguage = "ko" | "en";
export type ClinicalMasterNameKind = "preferred" | "alias" | "abbreviation" | "legacy";
export type ClinicalMasterAdoptionScope = "cumulative" | "payload";

export type ClinicalMasterNameInput = {
  languageCode: ClinicalMasterLanguage;
  nameKind: ClinicalMasterNameKind;
  name: string;
  searchable?: boolean;
  sortOrder?: number;
};

export type ClinicalMasterSourceInput = {
  sourceType: "synthetic";
  title: string;
  referenceUri?: string | null;
  sourceVersion?: string | null;
  accessedAt?: string | null;
  licenseNotes?: string | null;
};

export type ClinicalMasterRecordInput = {
  masterKey: string;
  recordType: ClinicalMasterRecordType;
  lifecycleStatus?: "published";
  safetyStatus?: "normal";
  safetyReason?: string | null;
  names: ClinicalMasterNameInput[];
  source: ClinicalMasterSourceInput;
  detail: Record<string, unknown>;
};

export type ClinicalMasterLabPanelItemInput = {
  panelMasterKey: string;
  testMasterKey: string;
  sortOrder: number;
  required?: boolean;
  displayGroup?: string | null;
};

export type ClinicalMasterLabOrderProfileInput = {
  orderMasterKey: string;
  labTestMasterKey?: string | null;
  labPanelMasterKey?: string | null;
  specimenMasterKey?: string | null;
};

export type ClinicalMasterClassificationPathInput = {
  pathKey: string;
  clinicalActionKey: string;
  chartGroupKey: string;
  taskRouteKey: string;
};

export type ClinicalMasterPublishPayload = {
  releaseKey?: string | null;
  releaseNotes?: string | null;
  /** Existing callers default to cumulative; V3 payloads opt into exact owner adoption. */
  adoptionScope?: ClinicalMasterAdoptionScope;
  publishedByLabel: string;
  records: ClinicalMasterRecordInput[];
  classificationPaths?: ClinicalMasterClassificationPathInput[];
  labPanelItems?: ClinicalMasterLabPanelItemInput[];
  labOrderProfiles?: ClinicalMasterLabOrderProfileInput[];
  labResultProfiles?: LabResultProfile[];
  labResultProfileOrderKeys?: string[];
  labCompositions?: LabComposition[];
};

export type ClinicalMasterValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export class ClinicalMasterValidationError extends Error {
  readonly issues: ClinicalMasterValidationIssue[];

  constructor(issues: ClinicalMasterValidationIssue[]) {
    super("Clinical master publish payload is invalid.");
    this.name = "ClinicalMasterValidationError";
    this.issues = issues;
  }
}

export type ClinicalMasterPublishResult = {
  releaseId: string;
  releaseNo: number;
  sourceFingerprint: string;
  idempotent: boolean;
  recordCount: number;
  adoptionScope?: ClinicalMasterAdoptionScope;
};

export type ClinicalMasterPublisherExecutor = {
  publish(payload: ClinicalMasterPublishPayload): Promise<ClinicalMasterPublishResult>;
};

export const clinicalMasterTaskRouteTuples = {
  NT_LAB: { destinationModule: "lab", taskRequired: true, runtimeStatus: "active" },
  NT_IMAGING: { destinationModule: "imaging", taskRequired: true, runtimeStatus: "active" },
  NT_DISPENSING: { destinationModule: "dispensing", taskRequired: true, runtimeStatus: "active" },
  NT_TREATMENT: { destinationModule: "treatment", taskRequired: true, runtimeStatus: "active" },
  NT_INPATIENT: { destinationModule: "inpatient", taskRequired: true, runtimeStatus: "held" },
  NT_BILLING_ONLY: { destinationModule: "billing_only", taskRequired: false, runtimeStatus: "active" },
  NT_CHART_ONLY: { destinationModule: "chart_only", taskRequired: false, runtimeStatus: "active" },
} as const;

const recordTypeSet = new Set<string>(clinicalMasterRecordTypes);
const itemTypeSet = new Set([
  "consultation",
  "medication",
  "treatment",
  "lab",
  "imaging",
  "hospitalization",
  "misc",
]);
const valueKindSet = new Set(["numeric", "text", "coded"]);
const forbiddenPriceKeys = new Set(["price", "pricekrw", "canonicalprice", "price_krw"]);

const detailAllowedKeys: Record<ClinicalMasterRecordType, ReadonlySet<string>> = {
  order_category: new Set(["categoryCode", "categoryLevel", "parentMasterKey", "sortOrder"]),
  clinical_action: new Set(["tCategoryKey", "itemType", "isOtherUnclassified"]),
  chart_group: new Set(["groupCode", "sortOrder"]),
  task_route: new Set(["routeCode", "destinationModule", "taskRequired", "runtimeStatus"]),
  order: new Set([
    "classificationPathKey",
    "defaultSalesUnitCode",
    "defaultBillingReflectionEnabled",
    "defaultQuantity",
    "species",
    "planOrderAuthority",
    "executionPreset",
    "adminSubcategoryCode",
    "labFamilyCode",
  ]),
  species: new Set(["speciesCode"]),
  unit: new Set(["unitCode", "symbol", "decimalScale"]),
  specimen_type: new Set(["specimenCode"]),
  result_input_type: new Set(["inputCode", "valueKind", "supportsUnit"]),
  lab_test: new Set(["testCode", "resultInputTypeKey", "canonicalUnitKey", "decimalScale"]),
  lab_panel: new Set(["panelCode"]),
};

const contractAllowedKeys: Record<string, ReadonlySet<string>> = {
  payload: new Set(["releaseKey", "releaseNotes", "adoptionScope", "publishedByLabel", "records", "classificationPaths", "labPanelItems", "labOrderProfiles", "labResultProfiles", "labResultProfileOrderKeys", "labCompositions"]),
  record: new Set(["masterKey", "recordType", "lifecycleStatus", "safetyStatus", "safetyReason", "names", "source", "detail"]),
  name: new Set(["languageCode", "nameKind", "name", "searchable", "sortOrder"]),
  source: new Set(["sourceType", "title", "referenceUri", "sourceVersion", "accessedAt", "licenseNotes"]),
  path: new Set(["pathKey", "clinicalActionKey", "chartGroupKey", "taskRouteKey"]),
};

function trimNullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value.trim() : null;
}

function addIssue(
  issues: ClinicalMasterValidationIssue[],
  path: string,
  code: string,
  message: string
) {
  issues.push({ path, code, message });
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateContractKeys(
  contract: keyof typeof contractAllowedKeys,
  value: unknown,
  path: string,
  issues: ClinicalMasterValidationIssue[]
): value is Record<string, unknown> {
  if (!isRecordObject(value)) {
    addIssue(issues, path, `${contract}_object_required`, `${contract} must be an object.`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!contractAllowedKeys[contract].has(key)) {
      addIssue(
        issues,
        `${path}.${key}`,
        `${contract}_field_unknown`,
        `${contract} field ${key} is not part of the Phase 1A-1 contract.`
      );
    }
  }
  return true;
}

function hasForbiddenPriceKey(value: unknown, path: string, issues: ClinicalMasterValidationIssue[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => hasForbiddenPriceKey(item, `${path}[${index}]`, issues));
    return;
  }
  if (!value || typeof value !== "object") return;

  Object.entries(value).forEach(([key, child]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (forbiddenPriceKeys.has(normalizedKey)) {
      addIssue(
        issues,
        `${path}.${key}`,
        "canonical_price_forbidden",
        "Canonical price is not part of the master contract."
      );
    }
    hasForbiddenPriceKey(child, `${path}.${key}`, issues);
  });
}

function validateDetailKeys(
  recordType: ClinicalMasterRecordType,
  detail: Record<string, unknown>,
  path: string,
  issues: ClinicalMasterValidationIssue[]
) {
  const allowedKeys = detailAllowedKeys[recordType];
  Object.keys(detail).forEach((key) => {
    if (!allowedKeys.has(key)) {
      addIssue(
        issues,
        `${path}.${key}`,
        "detail_field_unknown",
        `Detail field ${key} is not part of the Phase 1A-1 contract.`
      );
    }
  });
}

function requireNonEmptyString(
  value: unknown,
  path: string,
  issues: ClinicalMasterValidationIssue[],
  code = "required"
): string | null {
  if (value === null || value === undefined) {
    addIssue(issues, path, code, "A non-empty value is required.");
    return null;
  }
  if (typeof value !== "string") {
    addIssue(issues, path, `${code}_string`, "A string value is required.");
    return null;
  }
  const normalized = value.trim();
  if (!normalized) addIssue(issues, path, code, "A non-empty value is required.");
  return normalized;
}

function validateOptionalString(
  value: unknown,
  path: string,
  issues: ClinicalMasterValidationIssue[]
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    addIssue(issues, path, "string_type_invalid", "The value must be a string when present.");
    return null;
  }
  return value.trim();
}

function requireRecordDetailString(
  detail: Record<string, unknown>,
  key: string,
  path: string,
  issues: ClinicalMasterValidationIssue[]
) {
  return requireNonEmptyString(detail[key], `${path}.${key}`, issues);
}

function validateRecordDetail(
  record: ClinicalMasterRecordInput,
  recordIndex: number,
  issues: ClinicalMasterValidationIssue[]
) {
  const detail = record.detail;
  const path = `records[${recordIndex}].detail`;

  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    addIssue(issues, path, "detail_object_required", "A typed detail object is required.");
    return;
  }
  validateDetailKeys(record.recordType, detail, path, issues);
  if (record.recordType === "order") {
    const preset = detail.executionPreset;
    if (preset !== undefined) {
      const required = ["presetId", "presetKey", "presetRevision", "clinicalOrderType", "detailSchemaVersion", "defaultDetailInputs", "fieldPolicies", "provenance", "presetStatus", "clinicalUseAllowed", "contentSha256", "sourceArtifactSha256"];
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const sha = /^[0-9a-f]{64}$/;
      if (!isRecordObject(preset) || Object.keys(preset).length !== required.length || required.some(key => !Object.hasOwn(preset, key))
        || typeof preset.presetId !== "string" || !uuid.test(preset.presetId)
        || typeof preset.presetKey !== "string" || !preset.presetKey.trim()
        || !Number.isSafeInteger(preset.presetRevision) || Number(preset.presetRevision) < 1
        || ![1, 2].includes(Number(preset.detailSchemaVersion)) || typeof preset.detailSchemaVersion !== "number"
        || !["consultation", "clinical_lab", "external_lab", "system_exam", "imaging", "treatment", "dispensing", "hospitalization", "other"].includes(String(preset.clinicalOrderType))
        || !isRecordObject(preset.defaultDetailInputs) || !isRecordObject(preset.fieldPolicies) || !isRecordObject(preset.provenance)
        || preset.presetStatus !== "synthetic_unreviewed" || preset.clinicalUseAllowed !== false
        || typeof preset.contentSha256 !== "string" || !sha.test(preset.contentSha256)
        || typeof preset.sourceArtifactSha256 !== "string" || !sha.test(preset.sourceArtifactSha256)) {
        addIssue(issues, `${path}.executionPreset`, "execution_preset_invalid", "An exact synthetic execution preset envelope is required; PostgreSQL verifies schema policies and the canonical content hash.");
      }
    }
    if ((detail.adminSubcategoryCode !== undefined || detail.labFamilyCode !== undefined)
      && !isOrderTaxonomyValid(isRecordObject(preset) ? preset.clinicalOrderType : undefined, detail.adminSubcategoryCode, detail.labFamilyCode)) {
      addIssue(issues, path, "order_taxonomy_invalid", "Taxonomy must match the explicit clinical order type and laboratory family contract.");
    }
  }

  switch (record.recordType) {
    case "order_category": {
      const level = requireRecordDetailString(detail, "categoryLevel", path, issues);
      requireRecordDetailString(detail, "categoryCode", path, issues);
      const parentKey = validateOptionalString(detail.parentMasterKey, `${path}.parentMasterKey`, issues);
      if (detail.sortOrder !== undefined && (typeof detail.sortOrder !== "number" || !Number.isInteger(detail.sortOrder) || detail.sortOrder < 0)) {
        addIssue(issues, `${path}.sortOrder`, "sort_order_invalid", "Sort order must be a non-negative integer.");
      }
      if (level === "X" && parentKey) {
        addIssue(issues, `${path}.parentMasterKey`, "x_parent_forbidden", "An X category cannot have a parent.");
      }
      if (level === "T" && !parentKey) {
        addIssue(issues, `${path}.parentMasterKey`, "t_parent_required", "A T category must reference an X parent.");
      }
      if (level !== "X" && level !== "T") {
        addIssue(issues, `${path}.categoryLevel`, "category_level_invalid", "Category level must be X or T.");
      }
      break;
    }
    case "clinical_action":
      requireRecordDetailString(detail, "tCategoryKey", path, issues);
      if (!itemTypeSet.has(trimNullable(detail.itemType) ?? "")) {
        addIssue(issues, `${path}.itemType`, "item_type_invalid", "Clinical action item type is not supported in Phase 1A-1.");
      }
      if (detail.isOtherUnclassified !== undefined && typeof detail.isOtherUnclassified !== "boolean") {
        addIssue(issues, `${path}.isOtherUnclassified`, "other_flag_boolean", "Other/Unclassified must be boolean.");
      }
      break;
    case "chart_group":
      requireRecordDetailString(detail, "groupCode", path, issues);
      if (detail.sortOrder !== undefined && (typeof detail.sortOrder !== "number" || !Number.isInteger(detail.sortOrder) || detail.sortOrder < 0)) {
        addIssue(issues, `${path}.sortOrder`, "sort_order_invalid", "Sort order must be a non-negative integer.");
      }
      break;
    case "task_route": {
      const routeCode = requireRecordDetailString(detail, "routeCode", path, issues);
      const destination = validateOptionalString(detail.destinationModule, `${path}.destinationModule`, issues);
      const runtimeStatus = validateOptionalString(detail.runtimeStatus, `${path}.runtimeStatus`, issues);
      if (detail.taskRequired !== undefined && typeof detail.taskRequired !== "boolean") {
        addIssue(issues, `${path}.taskRequired`, "task_required_boolean", "Task required must be boolean.");
      }
      const tuple = routeCode
        ? clinicalMasterTaskRouteTuples[routeCode as keyof typeof clinicalMasterTaskRouteTuples]
        : undefined;
      if (!tuple) {
        addIssue(issues, `${path}.routeCode`, "route_code_invalid", "Task route code is not supported.");
      } else if (
        (destination !== null && destination !== tuple.destinationModule) ||
        (detail.taskRequired !== undefined && detail.taskRequired !== tuple.taskRequired) ||
        (runtimeStatus !== null && runtimeStatus !== tuple.runtimeStatus)
      ) {
        addIssue(issues, path, "route_tuple_mismatch", "Task route code must use its exact destination, task, and runtime tuple.");
      }
      break;
    }
    case "species": {
      const speciesCode = requireRecordDetailString(detail, "speciesCode", path, issues);
      if (speciesCode !== "dog" && speciesCode !== "cat") {
        addIssue(issues, `${path}.speciesCode`, "species_scope_invalid", "Only dog and cat are supported in Phase 1A-1.");
      }
      break;
    }
    case "unit":
      requireRecordDetailString(detail, "unitCode", path, issues);
      requireRecordDetailString(detail, "symbol", path, issues);
      if (detail.decimalScale !== undefined && (typeof detail.decimalScale !== "number" || !Number.isInteger(detail.decimalScale) || detail.decimalScale < 0)) {
        addIssue(issues, `${path}.decimalScale`, "decimal_scale_invalid", "Decimal scale must be a non-negative integer.");
      }
      break;
    case "specimen_type":
      requireRecordDetailString(detail, "specimenCode", path, issues);
      break;
    case "result_input_type":
      requireRecordDetailString(detail, "inputCode", path, issues);
      if (!valueKindSet.has(trimNullable(detail.valueKind) ?? "")) {
        addIssue(issues, `${path}.valueKind`, "value_kind_invalid", "Result input value kind is not supported.");
      }
      if (detail.supportsUnit !== undefined && typeof detail.supportsUnit !== "boolean") {
        addIssue(issues, `${path}.supportsUnit`, "supports_unit_boolean", "Supports unit must be boolean.");
      }
      break;
    case "lab_test":
      requireRecordDetailString(detail, "testCode", path, issues);
      requireRecordDetailString(detail, "resultInputTypeKey", path, issues);
      validateOptionalString(detail.canonicalUnitKey, `${path}.canonicalUnitKey`, issues);
      if (detail.decimalScale !== undefined && detail.decimalScale !== null && (typeof detail.decimalScale !== "number" || !Number.isInteger(detail.decimalScale) || detail.decimalScale < 0)) {
        addIssue(issues, `${path}.decimalScale`, "decimal_scale_invalid", "Decimal scale must be a non-negative integer.");
      }
      break;
    case "lab_panel":
      requireRecordDetailString(detail, "panelCode", path, issues);
      break;
    case "order": {
      requireRecordDetailString(detail, "classificationPathKey", path, issues);
      const planOrderAuthority = parsePlanOrderAuthority(
        detail.planOrderAuthority,
      );
      if (!planOrderAuthority.valid) {
        for (const issue of planOrderAuthority.issues) {
          addIssue(
            issues,
            issue.path.replace("planOrderAuthority", `${path}.planOrderAuthority`),
            issue.code,
            "Plan/Order authority configuration is invalid.",
          );
        }
      }
      validateOptionalString(detail.defaultSalesUnitCode, `${path}.defaultSalesUnitCode`, issues);
      const species = detail.species;
      if (!Array.isArray(species) || species.length === 0) {
        addIssue(issues, `${path}.species`, "order_species_required", "An order must explicitly support at least one species.");
      } else {
        species.forEach((value, index) => {
          if (value !== "dog" && value !== "cat") {
            addIssue(issues, `${path}.species[${index}]`, "species_scope_invalid", "Only dog and cat are supported in Phase 1A-1.");
          }
        });
        if (new Set(species).size !== species.length) {
          addIssue(issues, `${path}.species`, "order_species_duplicate", "An order cannot repeat a species link.");
        }
      }
      if (detail.defaultQuantity !== undefined) {
        const quantity = detail.defaultQuantity;
        if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
          addIssue(issues, `${path}.defaultQuantity`, "quantity_positive", "Default quantity must be positive.");
        }
      }
      if (detail.defaultBillingReflectionEnabled !== undefined && typeof detail.defaultBillingReflectionEnabled !== "boolean") {
        addIssue(issues, `${path}.defaultBillingReflectionEnabled`, "billing_reflection_boolean", "Billing reflection must be boolean.");
      }
      break;
    }
  }
}

function normalizeName(name: ClinicalMasterNameInput) {
  return {
    languageCode: name.languageCode,
    nameKind: name.nameKind,
    name: name.name.trim(),
    searchable: name.searchable ?? true,
    sortOrder: name.sortOrder ?? 0,
  };
}

function normalizeSource(source: ClinicalMasterSourceInput) {
  return {
    sourceType: source.sourceType,
    title: source.title.trim(),
    referenceUri: trimNullable(source.referenceUri),
    sourceVersion: trimNullable(source.sourceVersion),
    accessedAt: trimNullable(source.accessedAt),
    licenseNotes: trimNullable(source.licenseNotes),
  };
}

function normalizeDetail(recordType: ClinicalMasterRecordType, detail: Record<string, unknown>) {
  const trimmed = Object.fromEntries(
    Object.entries(detail).map(([key, value]) => {
      if (typeof value === "string") return [key, value.trim()];
      if (key === "species" && Array.isArray(value)) return [key, [...value].map((item) => String(item).trim()).sort()];
      return [key, value];
    })
  ) as Record<string, unknown>;

  switch (recordType) {
    case "order_category":
      return {
        categoryCode: trimNullable(trimmed.categoryCode),
        categoryLevel: trimNullable(trimmed.categoryLevel),
        parentMasterKey: trimNullable(trimmed.parentMasterKey),
        sortOrder: trimmed.sortOrder ?? 0,
      };
    case "clinical_action":
      return {
        tCategoryKey: trimNullable(trimmed.tCategoryKey),
        itemType: trimNullable(trimmed.itemType),
        isOtherUnclassified: trimmed.isOtherUnclassified ?? false,
      };
    case "chart_group":
      return {
        groupCode: trimNullable(trimmed.groupCode),
        sortOrder: trimmed.sortOrder ?? 0,
      };
    case "task_route": {
      const routeCode = trimNullable(trimmed.routeCode) ?? "";
      const tuple = clinicalMasterTaskRouteTuples[routeCode as keyof typeof clinicalMasterTaskRouteTuples];
      return {
        routeCode: routeCode || null,
        destinationModule: trimmed.destinationModule ?? tuple?.destinationModule ?? null,
        taskRequired: trimmed.taskRequired ?? tuple?.taskRequired ?? null,
        runtimeStatus: trimmed.runtimeStatus ?? tuple?.runtimeStatus ?? null,
      };
    }
    case "order":
      return {
        classificationPathKey: trimNullable(trimmed.classificationPathKey),
        defaultSalesUnitCode: trimNullable(trimmed.defaultSalesUnitCode),
        defaultBillingReflectionEnabled: trimmed.defaultBillingReflectionEnabled ?? true,
        defaultQuantity: trimmed.defaultQuantity ?? 1,
        species: Array.isArray(trimmed.species) ? trimmed.species : [],
        ...(trimmed.planOrderAuthority !== undefined
          ? {
              planOrderAuthority: normalizedPlanOrderAuthority(
                trimmed.planOrderAuthority,
              ),
            }
          : {}),
      };
    case "species":
      return { speciesCode: trimNullable(trimmed.speciesCode) };
    case "unit":
      return {
        unitCode: trimNullable(trimmed.unitCode),
        symbol: trimNullable(trimmed.symbol),
        decimalScale: trimmed.decimalScale ?? 0,
      };
    case "specimen_type":
      return { specimenCode: trimNullable(trimmed.specimenCode) };
    case "result_input_type":
      return {
        inputCode: trimNullable(trimmed.inputCode),
        valueKind: trimNullable(trimmed.valueKind),
        supportsUnit: trimmed.supportsUnit ?? false,
      };
    case "lab_test":
      return {
        testCode: trimNullable(trimmed.testCode),
        resultInputTypeKey: trimNullable(trimmed.resultInputTypeKey),
        canonicalUnitKey: trimNullable(trimmed.canonicalUnitKey),
        decimalScale: trimmed.decimalScale ?? null,
      };
    case "lab_panel":
      return { panelCode: trimNullable(trimmed.panelCode) };
  }
}

function normalizedPlanOrderAuthority(value: unknown) {
  const parsed = parsePlanOrderAuthority(value);
  return parsed.valid ? parsed.value : null;
}

export function normalizeClinicalMasterPublishPayload(payload: ClinicalMasterPublishPayload): ClinicalMasterPublishPayload {
  const normalized: ClinicalMasterPublishPayload = {
    releaseKey: trimNullable(payload.releaseKey),
    releaseNotes: trimNullable(payload.releaseNotes),
    ...(payload.adoptionScope === undefined ? {} : { adoptionScope: payload.adoptionScope }),
    publishedByLabel: payload.publishedByLabel.trim(),
    records: [...payload.records]
      .map((record) => ({
        masterKey: record.masterKey.trim(),
        recordType: record.recordType,
        lifecycleStatus: "published" as const,
        safetyStatus: "normal" as const,
        safetyReason: trimNullable(record.safetyReason),
        names: [...record.names]
          .map(normalizeName)
          .sort(
            (left, right) =>
              left.languageCode.localeCompare(right.languageCode) ||
              left.nameKind.localeCompare(right.nameKind) ||
              left.name.localeCompare(right.name) ||
              left.sortOrder - right.sortOrder
          ),
        source: normalizeSource(record.source),
        detail: normalizeDetail(record.recordType, record.detail),
      }))
      .sort((left, right) => left.masterKey.localeCompare(right.masterKey)),
    classificationPaths: [...(payload.classificationPaths ?? [])]
      .map((path) => ({
        pathKey: path.pathKey.trim(),
        clinicalActionKey: path.clinicalActionKey.trim(),
        chartGroupKey: path.chartGroupKey.trim(),
        taskRouteKey: path.taskRouteKey.trim(),
      }))
      .sort((left, right) => left.pathKey.localeCompare(right.pathKey)),
    labPanelItems: [...(payload.labPanelItems ?? [])]
      .map((item) => ({
        panelMasterKey: item.panelMasterKey.trim(),
        testMasterKey: item.testMasterKey.trim(),
        sortOrder: item.sortOrder,
        required: item.required ?? true,
        displayGroup: trimNullable(item.displayGroup),
      }))
      .sort((left, right) => left.panelMasterKey.localeCompare(right.panelMasterKey) || left.sortOrder - right.sortOrder || left.testMasterKey.localeCompare(right.testMasterKey)),
    labOrderProfiles: [...(payload.labOrderProfiles ?? [])]
      .map((profile) => ({
        orderMasterKey: profile.orderMasterKey.trim(),
        labTestMasterKey: trimNullable(profile.labTestMasterKey),
        labPanelMasterKey: trimNullable(profile.labPanelMasterKey),
        specimenMasterKey: trimNullable(profile.specimenMasterKey),
      }))
      .sort((left, right) => left.orderMasterKey.localeCompare(right.orderMasterKey)),
  };
  if (payload.labResultProfiles !== undefined) {
    normalized.labResultProfiles = structuredClone(payload.labResultProfiles).sort((a, b) => a.profileKey.localeCompare(b.profileKey) || a.revision - b.revision);
    normalized.labResultProfileOrderKeys = [...(payload.labResultProfileOrderKeys ?? [])].sort();
  }
  if (payload.labCompositions !== undefined) {
    normalized.labCompositions = structuredClone(payload.labCompositions).sort((a, b) => a.masterKey.localeCompare(b.masterKey) || a.revision - b.revision);
  }
  return normalized;
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized ?? "null";
}

/**
 * Test-only canonical serialization aid. PostgreSQL computes and persists the
 * authoritative SHA-256 fingerprint; this helper deliberately does not hash.
 */
export function serializeClinicalMasterPayloadForTest(payload: ClinicalMasterPublishPayload): string {
  return stableJson(normalizeClinicalMasterPublishPayload(payload));
}

export function validateClinicalMasterPublishPayload(
  payload: ClinicalMasterPublishPayload
): ClinicalMasterValidationIssue[] {
  const issues: ClinicalMasterValidationIssue[] = [];
  if (!isRecordObject(payload)) {
    return [{ path: "$", code: "payload_object_required", message: "A publish payload object is required." }];
  }
  validateContractKeys("payload", payload, "$", issues);
  validateOptionalString(payload.releaseKey, "releaseKey", issues);
  validateOptionalString(payload.releaseNotes, "releaseNotes", issues);
  if (payload.adoptionScope !== undefined && (typeof payload.adoptionScope !== "string" || !["cumulative", "payload"].includes(payload.adoptionScope))) {
    addIssue(issues, "adoptionScope", "adoption_scope_invalid", "Adoption scope must be cumulative or payload.");
  }

  requireNonEmptyString(payload.publishedByLabel, "publishedByLabel", issues);
  const rawRecords: unknown = payload.records;
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    addIssue(issues, "records", "records_required", "At least one master record is required.");
    return issues;
  }

  const recordKeys = new Set<string>();
  const recordsByKey = new Map<string, ClinicalMasterRecordInput>();
  rawRecords.forEach((rawRecord, recordIndex) => {
    const path = `records[${recordIndex}]`;
    if (!validateContractKeys("record", rawRecord, path, issues)) return;
    hasForbiddenPriceKey(rawRecord, path, issues);
    const record = rawRecord as ClinicalMasterRecordInput;
    const masterKey = requireNonEmptyString(record?.masterKey, `${path}.masterKey`, issues);
    if (masterKey) {
      if (recordKeys.has(masterKey)) addIssue(issues, `${path}.masterKey`, "master_key_duplicate", "Master keys must be unique in one release.");
      recordKeys.add(masterKey);
      recordsByKey.set(masterKey, record);
    }
    if (record.recordType !== undefined && typeof record.recordType !== "string") {
      addIssue(issues, `${path}.recordType`, "record_type_string", "Record type must be a string.");
    }
    if (!recordTypeSet.has(record?.recordType)) {
      addIssue(issues, `${path}.recordType`, "record_type_invalid", "This record type is outside Phase 1A-1.");
    }
    if (record.lifecycleStatus !== undefined && typeof record.lifecycleStatus !== "string") {
      addIssue(issues, `${path}.lifecycleStatus`, "lifecycle_status_string", "Lifecycle status must be a string.");
    }
    if (record?.lifecycleStatus && record.lifecycleStatus !== "published") {
      addIssue(issues, `${path}.lifecycleStatus`, "lifecycle_status_invalid", "Phase 1A-1 publishes only published records.");
    }
    if (record.safetyStatus !== undefined && typeof record.safetyStatus !== "string") {
      addIssue(issues, `${path}.safetyStatus`, "safety_status_string", "Safety status must be a string.");
    }
    if (record?.safetyStatus && record.safetyStatus !== "normal") {
      addIssue(issues, `${path}.safetyStatus`, "safety_status_invalid", "Phase 1A-1 publishes only normal records.");
    }
    validateOptionalString(record.safetyReason, `${path}.safetyReason`, issues);
    if (!Array.isArray(record?.names) || record.names.length === 0) {
      addIssue(issues, `${path}.names`, "names_required", "At least one name is required.");
    } else {
      const rawNames = record.names as unknown[];
      const preferredKo = rawNames.filter((name): name is ClinicalMasterNameInput => isRecordObject(name) && name.languageCode === "ko" && name.nameKind === "preferred");
      const preferredEn = rawNames.filter((name): name is ClinicalMasterNameInput => isRecordObject(name) && name.languageCode === "en" && name.nameKind === "preferred");
      if (preferredKo.length > 1 || preferredKo.length + preferredEn.length === 0) addIssue(issues, `${path}.names`, "preferred_ko_exactly_one", "A preferred Korean or English name is required; at most one per language is allowed.");
      if (preferredEn.length > 1) addIssue(issues, `${path}.names`, "preferred_en_at_most_one", "At most one preferred English name is allowed per record.");
      const nameKeys = new Set<string>();
      rawNames.forEach((rawName, nameIndex) => {
        const namePath = `${path}.names[${nameIndex}]`;
        if (!validateContractKeys("name", rawName, namePath, issues)) return;
        const name = rawName as ClinicalMasterNameInput;
        requireNonEmptyString(name?.name, `${path}.names[${nameIndex}].name`, issues);
        const languageCode = requireNonEmptyString(name?.languageCode, `${namePath}.languageCode`, issues);
        const nameKind = requireNonEmptyString(name?.nameKind, `${namePath}.nameKind`, issues);
        if (!languageCode || !["ko", "en"].includes(languageCode)) {
          addIssue(issues, `${path}.names[${nameIndex}].languageCode`, "language_invalid", "Names must use ko or en.");
        }
        if (!nameKind || !["preferred", "alias", "abbreviation", "legacy"].includes(nameKind)) {
          addIssue(issues, `${path}.names[${nameIndex}].nameKind`, "name_kind_invalid", "Name kind is not supported.");
        }
        if (name.searchable !== undefined && typeof name.searchable !== "boolean") {
          addIssue(issues, `${namePath}.searchable`, "searchable_boolean", "Searchable must be boolean.");
        }
        if (name.sortOrder !== undefined && (typeof name.sortOrder !== "number" || !Number.isInteger(name.sortOrder) || name.sortOrder < 0)) {
          addIssue(issues, `${namePath}.sortOrder`, "sort_order_invalid", "Sort order must be a non-negative integer.");
        }
        const normalizedName = trimNullable(name?.name)?.replace(/\s+/gu, " ").toLocaleLowerCase() ?? "";
        const nameKey = `${name?.languageCode}|${name?.nameKind}|${normalizedName}`;
        if (nameKeys.has(nameKey)) addIssue(issues, `${path}.names[${nameIndex}]`, "normalized_name_duplicate", "Names cannot duplicate after normalization within one record.");
        nameKeys.add(nameKey);
      });
    }
    const source = record?.source as unknown;
    if (!isRecordObject(source)) {
      addIssue(issues, `${path}.source`, "source_required", "A provenance source is required.");
    } else {
      validateContractKeys("source", source, `${path}.source`, issues);
      const sourceType = requireNonEmptyString(source.sourceType, `${path}.source.sourceType`, issues);
      if (sourceType !== "synthetic") addIssue(issues, `${path}.source.sourceType`, "synthetic_source_required", "Phase 1A-1 accepts synthetic provenance only.");
      requireNonEmptyString(source.title, `${path}.source.title`, issues);
      for (const key of ["referenceUri", "sourceVersion", "accessedAt", "licenseNotes"]) {
        validateOptionalString(source[key], `${path}.source.${key}`, issues);
      }
    }
    if (recordTypeSet.has(record.recordType)) {
      validateRecordDetail(record, recordIndex, issues);
    }
  });

  const rawPanelItems: unknown = payload.labPanelItems === undefined ? [] : payload.labPanelItems;
  if (!Array.isArray(rawPanelItems)) {
    addIssue(issues, "labPanelItems", "lab_panel_items_array", "Lab panel items must be an array.");
  } else {
    const seenPanelTests = new Set<string>();
    const seenPanelSorts = new Set<string>();
    rawPanelItems.forEach((rawItem, itemIndex) => {
      const path = `labPanelItems[${itemIndex}]`;
      if (!isRecordObject(rawItem)) {
        addIssue(issues, path, "lab_panel_item_object_required", "A lab panel item object is required.");
        return;
      }
      for (const key of Object.keys(rawItem)) {
        if (!["panelMasterKey", "testMasterKey", "sortOrder", "required", "displayGroup"].includes(key)) {
          addIssue(issues, `${path}.${key}`, "lab_panel_item_field_unknown", "Unknown lab panel relation field.");
        }
      }
      const panelKey = requireNonEmptyString(rawItem.panelMasterKey, `${path}.panelMasterKey`, issues);
      const testKey = requireNonEmptyString(rawItem.testMasterKey, `${path}.testMasterKey`, issues);
      if (typeof rawItem.sortOrder !== "number" || !Number.isInteger(rawItem.sortOrder) || rawItem.sortOrder < 0) {
        addIssue(issues, `${path}.sortOrder`, "sort_order_invalid", "Sort order must be a non-negative integer.");
      }
      if (rawItem.required !== undefined && typeof rawItem.required !== "boolean") addIssue(issues, `${path}.required`, "required_boolean", "Required must be boolean.");
      validateOptionalString(rawItem.displayGroup, `${path}.displayGroup`, issues);
      if (panelKey && testKey) {
        const pairKey = `${panelKey}:${testKey}`;
        const sortKey = `${panelKey}:${rawItem.sortOrder}`;
        if (seenPanelTests.has(pairKey)) addIssue(issues, path, "lab_panel_item_duplicate", "A panel cannot repeat a test.");
        if (seenPanelSorts.has(sortKey)) addIssue(issues, path, "lab_panel_sort_duplicate", "A panel cannot repeat an ordinal.");
        seenPanelTests.add(pairKey);
        seenPanelSorts.add(sortKey);
        const panelRecord = recordsByKey.get(panelKey);
        const testRecord = recordsByKey.get(testKey);
        // A relation may pin an already-published owner omitted from this
        // release.  PostgreSQL resolves that immutable effective revision;
        // only an explicitly supplied record with the wrong type is invalid.
        if (panelRecord && panelRecord.recordType !== "lab_panel") addIssue(issues, `${path}.panelMasterKey`, "lab_panel_reference_invalid", "Panel relation must reference a lab_panel record.");
        if (testRecord && testRecord.recordType !== "lab_test") addIssue(issues, `${path}.testMasterKey`, "lab_test_reference_invalid", "Panel relation must reference a lab_test record.");
      }
    });
  }

  const rawProfiles: unknown = payload.labOrderProfiles === undefined ? [] : payload.labOrderProfiles;
  if (!Array.isArray(rawProfiles)) {
    addIssue(issues, "labOrderProfiles", "lab_order_profiles_array", "Lab order profiles must be an array.");
  } else {
    const profileOrders = new Set<string>();
    rawProfiles.forEach((rawProfile, profileIndex) => {
      const path = `labOrderProfiles[${profileIndex}]`;
      if (!isRecordObject(rawProfile)) {
        addIssue(issues, path, "lab_order_profile_object_required", "A lab order profile object is required.");
        return;
      }
      for (const key of Object.keys(rawProfile)) {
        if (!["orderMasterKey", "labTestMasterKey", "labPanelMasterKey", "specimenMasterKey"].includes(key)) addIssue(issues, `${path}.${key}`, "lab_order_profile_field_unknown", "Unknown lab order profile field.");
      }
      const orderKey = requireNonEmptyString(rawProfile.orderMasterKey, `${path}.orderMasterKey`, issues);
      const testKey = validateOptionalString(rawProfile.labTestMasterKey, `${path}.labTestMasterKey`, issues);
      const panelKey = validateOptionalString(rawProfile.labPanelMasterKey, `${path}.labPanelMasterKey`, issues);
      const specimenKey = validateOptionalString(rawProfile.specimenMasterKey, `${path}.specimenMasterKey`, issues);
      if (orderKey && profileOrders.has(orderKey)) addIssue(issues, path, "lab_order_profile_duplicate", "An order may have only one laboratory profile.");
      if (orderKey) profileOrders.add(orderKey);
      if ((testKey ? 1 : 0) + (panelKey ? 1 : 0) !== 1) addIssue(issues, path, "lab_order_profile_target_exactly_one", "A profile must target exactly one test or panel.");
      const orderRecord = orderKey ? recordsByKey.get(orderKey) : undefined;
      const testRecord = testKey ? recordsByKey.get(testKey) : undefined;
      const panelRecord = panelKey ? recordsByKey.get(panelKey) : undefined;
      const specimenRecord = specimenKey ? recordsByKey.get(specimenKey) : undefined;
      if (orderRecord && orderRecord.recordType !== "order") addIssue(issues, `${path}.orderMasterKey`, "lab_order_reference_invalid", "Profile must reference an order record.");
      if (testRecord && testRecord.recordType !== "lab_test") addIssue(issues, `${path}.labTestMasterKey`, "lab_test_reference_invalid", "Profile test must reference a lab_test record.");
      if (panelRecord && panelRecord.recordType !== "lab_panel") addIssue(issues, `${path}.labPanelMasterKey`, "lab_panel_reference_invalid", "Profile panel must reference a lab_panel record.");
      if (specimenRecord && specimenRecord.recordType !== "specimen_type") addIssue(issues, `${path}.specimenMasterKey`, "specimen_reference_invalid", "Profile specimen must reference a specimen_type record.");
    });
  }

  if (payload.labResultProfiles !== undefined || payload.labResultProfileOrderKeys !== undefined) {
    const profiles = payload.labResultProfiles;
    const keys = payload.labResultProfileOrderKeys;
    if (!Array.isArray(profiles) || profiles.length < 1 || profiles.length > 200 || profiles.some(p => !parseLabResultProfile(p))) {
      addIssue(issues, "labResultProfiles", "lab_result_profiles_invalid", "Explicit valid immutable result profiles are required.");
    } else if (new Set(profiles.map(p => `${p.profileKey}:${p.revision}`)).size !== profiles.length || new Set(profiles.map(p => p.id)).size !== profiles.length) {
      addIssue(issues, "labResultProfiles", "lab_result_profiles_duplicate", "Profile revision and IDs must be unique.");
    }
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > 300 || keys.some(key => typeof key !== "string" || recordsByKey.get(key)?.recordType !== "order")
      || new Set(keys).size !== keys.length) {
      addIssue(issues, "labResultProfileOrderKeys", "lab_result_profile_orders_invalid", "Each required-profile order must be explicitly present once in the release.");
    }
  }

  if (payload.labCompositions !== undefined) {
    const graph = payload.labCompositions;
    if (!Array.isArray(graph) || graph.length < 1 || graph.length > 200 || graph.some(node => !parseLabComposition(node))) {
      addIssue(issues, "labCompositions", "lab_compositions_invalid", "Explicit immutable laboratory composition definitions are required.");
    } else if (new Set(graph.map(node => node.id)).size !== graph.length || new Set(graph.map(node => node.masterKey)).size !== graph.length) {
      addIssue(issues, "labCompositions", "lab_compositions_duplicate", "Composition identities must be unique within the release.");
    } else {
      const atomicKeys = new Set((Array.isArray(payload.labOrderProfiles) ? payload.labOrderProfiles : [])
        .filter(profile => profile && profile.labTestMasterKey && !profile.labPanelMasterKey && recordsByKey.get(profile.orderMasterKey)?.recordType === "order")
        .map(profile => profile.orderMasterKey));
      graph.forEach((node, index) => {
        if (node.originalOrderMasterKey && recordsByKey.get(node.originalOrderMasterKey)?.recordType !== "order") {
          addIssue(issues, `labCompositions[${index}].originalOrderMasterKey`, "lab_composition_original_missing", "Original orders must be present in the release.");
        }
        try { expandLabComposition(graph, node.masterKey, atomicKeys); }
        catch { addIssue(issues, `labCompositions[${index}]`, "lab_composition_graph_invalid", "Composition references, depth and unique atomic leaves must be valid."); }
      });
    }
  }

  const rawPaths: unknown = payload.classificationPaths === undefined ? [] : payload.classificationPaths;
  const paths = rawPaths;
  const pathValues = Array.isArray(rawPaths) ? rawPaths : [];
  if (!Array.isArray(paths)) {
    addIssue(issues, "classificationPaths", "classification_paths_array", "Classification paths must be an array.");
  } else {
    const pathKeys = new Set<string>();
    const actionKeys = new Set<string>();
    paths.forEach((rawPath, pathIndex) => {
      const pathPrefix = `classificationPaths[${pathIndex}]`;
      if (!validateContractKeys("path", rawPath, pathPrefix, issues)) return;
      const path = rawPath as ClinicalMasterClassificationPathInput;
      const pathKey = requireNonEmptyString(path?.pathKey, `${pathPrefix}.pathKey`, issues);
      const actionKey = requireNonEmptyString(path?.clinicalActionKey, `${pathPrefix}.clinicalActionKey`, issues);
      const chartKey = requireNonEmptyString(path?.chartGroupKey, `${pathPrefix}.chartGroupKey`, issues);
      const routeKey = requireNonEmptyString(path?.taskRouteKey, `${pathPrefix}.taskRouteKey`, issues);
      if (pathKey && pathKeys.has(pathKey)) addIssue(issues, `${pathPrefix}.pathKey`, "path_key_duplicate", "Path keys must be unique.");
      if (pathKey) pathKeys.add(pathKey);
      if (actionKey && actionKeys.has(actionKey)) addIssue(issues, `${pathPrefix}.clinicalActionKey`, "active_path_duplicate", "Only one new classification path is allowed per clinical action in one release.");
      if (actionKey) actionKeys.add(actionKey);
      const action = actionKey ? recordsByKey.get(actionKey) : undefined;
      const chart = chartKey ? recordsByKey.get(chartKey) : undefined;
      const route = routeKey ? recordsByKey.get(routeKey) : undefined;
      if (!action || action.recordType !== "clinical_action") addIssue(issues, `${pathPrefix}.clinicalActionKey`, "clinical_action_reference_invalid", "Path must reference a clinical action record.");
      if (!chart || chart.recordType !== "chart_group") addIssue(issues, `${pathPrefix}.chartGroupKey`, "chart_group_reference_invalid", "Path must reference a chart group record.");
      if (!route || route.recordType !== "task_route") addIssue(issues, `${pathPrefix}.taskRouteKey`, "task_route_reference_invalid", "Path must reference a task route record.");
      const routeDetail = route?.detail;
      const routeCode = isRecordObject(routeDetail) ? trimNullable(routeDetail.routeCode) : null;
      const routeTuple = routeCode ? clinicalMasterTaskRouteTuples[routeCode as keyof typeof clinicalMasterTaskRouteTuples] : undefined;
      const routeRuntimeStatus = isRecordObject(routeDetail) ? trimNullable(routeDetail.runtimeStatus) ?? routeTuple?.runtimeStatus : routeTuple?.runtimeStatus;
      if (routeRuntimeStatus !== "active") addIssue(issues, `${pathPrefix}.taskRouteKey`, "held_route_rejected", "A published path cannot reference a held task route.");
    });
  }

  rawRecords.forEach((rawRecord, recordIndex) => {
    if (!isRecordObject(rawRecord) || rawRecord.recordType !== "order" || !isRecordObject(rawRecord.detail)) return;
    const pathKey = trimNullable(rawRecord.detail.classificationPathKey);
    if (pathKey && !pathValues.some((rawPath) => isRecordObject(rawPath) && rawPath.pathKey === pathKey)) {
      addIssue(issues, `records[${recordIndex}].detail.classificationPathKey`, "order_path_reference_invalid", "Order must reference a path in the same publish payload.");
    }
  });
  return issues;
}

export async function publishClinicalMasterRelease({
  payload,
  executor,
}: {
  payload: ClinicalMasterPublishPayload;
  executor: ClinicalMasterPublisherExecutor;
}): Promise<ClinicalMasterPublishResult> {
  const issues = validateClinicalMasterPublishPayload(payload);
  if (issues.length > 0) throw new ClinicalMasterValidationError(issues);
  return executor.publish(normalizeClinicalMasterPublishPayload(payload));
}
