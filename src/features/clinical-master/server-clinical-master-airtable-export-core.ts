// Server-only contract boundary for the reviewed Airtable authoring export.
//
// This module deliberately has no Airtable, database, or runtime-publisher
// dependency.  It turns a reviewed, synthetic authoring snapshot into a
// deterministic value that a later publisher may consume.  It is not a valid
// payload for the Phase 1B-1 publisher.

export const clinicalMasterAirtableAuthoringSchemaVersion =
  "clinical-master-airtable-authoring/v1" as const;

export const clinicalMasterAirtablePhysicalTables = [
  "Release Drafts",
  "Sources",
  "Master Records",
  "Names",
  "Classification Paths",
  "Lab Panel Items",
  "Lab Order Profiles",
  "Diagnosis Category Links",
] as const;

/** Canonical physical table list used by authoring/export tooling. */
export const clinicalMasterAirtableTables = clinicalMasterAirtablePhysicalTables;

export const clinicalMasterAirtableViewTables = [
  "Code Dictionary",
  "Orders",
  "Vocabularies",
  "Diagnosis Systems",
  "Disease Groups",
  "Diagnoses",
  "Ready for Export",
] as const;

export type ClinicalMasterAirtablePhysicalTable =
  (typeof clinicalMasterAirtablePhysicalTables)[number];
export type ClinicalMasterAirtableViewTable =
  (typeof clinicalMasterAirtableViewTables)[number];

export const clinicalMasterAirtableRecordTypes = [
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
  "diagnosis_category",
  "diagnosis",
] as const;

export type ClinicalMasterAirtableRecordType =
  (typeof clinicalMasterAirtableRecordTypes)[number];
export type ClinicalMasterAirtableLanguage = "ko" | "en";
export type ClinicalMasterAirtableNameKind =
  | "preferred"
  | "alias"
  | "abbreviation"
  | "legacy";

export type ClinicalMasterAirtableReleaseInput = {
  releaseKey: string;
  status: "approved" | string;
  releaseNotes?: string | null;
  publishedByLabel: string;
  authoredByLabel: string;
  reviewedByLabel: string;
  clinicalReviewerLabel?: string | null;
  reviewReason: string;
};

export type ClinicalMasterAirtableSourceInput = {
  sourceKey: string;
  sourceType: "synthetic" | string;
  title: string;
  referenceUri?: string | null;
  sourceVersion?: string | null;
  accessedAt?: string | null;
  licenseNotes?: string | null;
};

export type ClinicalMasterAirtableNameInput = {
  languageCode: ClinicalMasterAirtableLanguage | string;
  nameKind: ClinicalMasterAirtableNameKind | string;
  name: string;
  searchable?: boolean;
  sortOrder?: number;
};

export type ClinicalMasterAirtableRecordInput = {
  masterKey: string;
  recordType: ClinicalMasterAirtableRecordType | string;
  authoringStatus: "approved" | string;
  lifecycleStatus: "published" | string;
  safetyStatus: "normal" | string;
  safetyReason?: string | null;
  changeSummary: string;
  sourceKey: string;
  sourceAssertionScope: string;
  sourceNotes?: string | null;
  names: ClinicalMasterAirtableNameInput[];
  detail: Record<string, unknown>;
};

export type ClinicalMasterAirtableClassificationPathInput = {
  pathKey: string;
  clinicalActionKey: string;
  chartGroupKey: string;
  taskRouteKey: string;
};

export type ClinicalMasterAirtableLabPanelItemInput = {
  panelMasterKey: string;
  testMasterKey: string;
  sortOrder?: number;
  required?: boolean;
  displayGroup?: string | null;
};

export type ClinicalMasterAirtableLabOrderProfileInput = {
  orderMasterKey: string;
  labTestMasterKey?: string | null;
  labPanelMasterKey?: string | null;
  specimenMasterKey?: string | null;
};

export type ClinicalMasterAirtableDiagnosisCategoryLinkInput = {
  diagnosisMasterKey: string;
  categoryMasterKey: string;
  isPrimary?: boolean;
  sortOrder?: number;
};

export type ClinicalMasterAirtableAuthoringExportInput = {
  schemaVersion: string;
  release: ClinicalMasterAirtableReleaseInput;
  sources: ClinicalMasterAirtableSourceInput[];
  records: ClinicalMasterAirtableRecordInput[];
  classificationPaths?: ClinicalMasterAirtableClassificationPathInput[];
  labPanelItems?: ClinicalMasterAirtableLabPanelItemInput[];
  labOrderProfiles?: ClinicalMasterAirtableLabOrderProfileInput[];
  diagnosisCategoryLinks?: ClinicalMasterAirtableDiagnosisCategoryLinkInput[];
};

export type ClinicalMasterAirtableRelease = {
  releaseKey: string;
  releaseNotes: string | null;
  publishedByLabel: string;
  authoredByLabel: string;
  reviewedByLabel: string;
  clinicalReviewerLabel: string | null;
  reviewReason: string;
};

export type ClinicalMasterAirtableSource = {
  sourceType: "synthetic";
  title: string;
  referenceUri: string | null;
  sourceVersion: string | null;
  accessedAt: string | null;
  licenseNotes: string | null;
};

export type ClinicalMasterAirtableName = {
  languageCode: ClinicalMasterAirtableLanguage;
  nameKind: ClinicalMasterAirtableNameKind;
  name: string;
  searchable: boolean;
  sortOrder: number;
};

export type ClinicalMasterAirtableRecord = {
  masterKey: string;
  recordType: ClinicalMasterAirtableRecordType;
  lifecycleStatus: "published";
  safetyStatus: "normal";
  safetyReason: string | null;
  changeSummary: string;
  sourceAssertionScope: string;
  sourceNotes: string | null;
  names: ClinicalMasterAirtableName[];
  source: ClinicalMasterAirtableSource;
  detail: Record<string, unknown>;
};

export type ClinicalMasterAirtableAuthoringExport = {
  schemaVersion: typeof clinicalMasterAirtableAuthoringSchemaVersion;
  release: ClinicalMasterAirtableRelease;
  records: ClinicalMasterAirtableRecord[];
  classificationPaths: ClinicalMasterAirtableClassificationPathInput[];
  labPanelItems: Required<ClinicalMasterAirtableLabPanelItemInput>[];
  labOrderProfiles: Required<ClinicalMasterAirtableLabOrderProfileInput>[];
  diagnosisCategoryLinks: Required<ClinicalMasterAirtableDiagnosisCategoryLinkInput>[];
};

export type ClinicalMasterAirtableValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export class ClinicalMasterAirtableExportValidationError extends Error {
  readonly issues: ClinicalMasterAirtableValidationIssue[];

  constructor(issues: ClinicalMasterAirtableValidationIssue[]) {
    super("Clinical master Airtable authoring export is invalid.");
    this.name = "ClinicalMasterAirtableExportValidationError";
    this.issues = sortIssues(issues);
  }
}

const recordTypeSet = new Set<string>(clinicalMasterAirtableRecordTypes);
const languageSet = new Set<string>(["ko", "en"]);
const nameKindSet = new Set<string>([
  "preferred",
  "alias",
  "abbreviation",
  "legacy",
]);
const itemTypeSet = new Set<string>([
  "consultation",
  "medication",
  "treatment",
  "lab",
  "imaging",
  "hospitalization",
  "misc",
]);
const valueKindSet = new Set<string>(["numeric", "text", "coded"]);
const categoryKindSet = new Set<string>(["system", "disease_group"]);

const detailAllowedKeys: Record<ClinicalMasterAirtableRecordType, ReadonlySet<string>> = {
  order_category: new Set([
    "categoryCode",
    "categoryLevel",
    "parentMasterKey",
    "sortOrder",
  ]),
  clinical_action: new Set(["tCategoryKey", "itemType", "isOtherUnclassified"]),
  chart_group: new Set(["groupCode", "sortOrder"]),
  task_route: new Set(["routeCode"]),
  order: new Set([
    "classificationPathKey",
    "defaultSalesUnitCode",
    "defaultBillingReflectionEnabled",
    "defaultQuantity",
    "species",
  ]),
  species: new Set(["speciesCode"]),
  unit: new Set(["unitCode", "symbol", "decimalScale"]),
  specimen_type: new Set(["specimenCode"]),
  result_input_type: new Set(["inputCode", "valueKind", "supportsUnit"]),
  lab_test: new Set([
    "testCode",
    "resultInputTypeKey",
    "canonicalUnitKey",
    "decimalScale",
  ]),
  lab_panel: new Set(["panelCode"]),
  diagnosis_category: new Set(["categoryKind", "parentMasterKey", "sortOrder"]),
  diagnosis: new Set([]),
};

const contractAllowedKeys: Record<string, ReadonlySet<string>> = {
  envelope: new Set([
    "schemaVersion",
    "release",
    "sources",
    "records",
    "classificationPaths",
    "labPanelItems",
    "labOrderProfiles",
    "diagnosisCategoryLinks",
  ]),
  release: new Set([
    "releaseKey",
    "status",
    "releaseNotes",
    "publishedByLabel",
    "authoredByLabel",
    "reviewedByLabel",
    "clinicalReviewerLabel",
    "reviewReason",
  ]),
  source: new Set([
    "sourceKey",
    "sourceType",
    "title",
    "referenceUri",
    "sourceVersion",
    "accessedAt",
    "licenseNotes",
  ]),
  record: new Set([
    "masterKey",
    "recordType",
    "authoringStatus",
    "lifecycleStatus",
    "safetyStatus",
    "safetyReason",
    "changeSummary",
    "sourceKey",
    "sourceAssertionScope",
    "sourceNotes",
    "names",
    "detail",
  ]),
  name: new Set([
    "languageCode",
    "nameKind",
    "name",
    "searchable",
    "sortOrder",
  ]),
  path: new Set([
    "pathKey",
    "clinicalActionKey",
    "chartGroupKey",
    "taskRouteKey",
  ]),
  labPanelItem: new Set([
    "panelMasterKey",
    "testMasterKey",
    "sortOrder",
    "required",
    "displayGroup",
  ]),
  labOrderProfile: new Set([
    "orderMasterKey",
    "labTestMasterKey",
    "labPanelMasterKey",
    "specimenMasterKey",
  ]),
  diagnosisCategoryLink: new Set([
    "diagnosisMasterKey",
    "categoryMasterKey",
    "isPrimary",
    "sortOrder",
  ]),
};

const routeTuples = {
  NT_LAB: { destinationModule: "lab", taskRequired: true, runtimeStatus: "active" },
  NT_IMAGING: {
    destinationModule: "imaging",
    taskRequired: true,
    runtimeStatus: "active",
  },
  NT_DISPENSING: {
    destinationModule: "dispensing",
    taskRequired: true,
    runtimeStatus: "active",
  },
  NT_TREATMENT: {
    destinationModule: "treatment",
    taskRequired: true,
    runtimeStatus: "active",
  },
  NT_INPATIENT: {
    destinationModule: "inpatient",
    taskRequired: true,
    runtimeStatus: "held",
  },
  NT_BILLING_ONLY: {
    destinationModule: "billing_only",
    taskRequired: false,
    runtimeStatus: "active",
  },
  NT_CHART_ONLY: {
    destinationModule: "chart_only",
    taskRequired: false,
    runtimeStatus: "active",
  },
} as const;

const generatedAuthorityKeySet = new Set([
  "revision",
  "revisionno",
  "releaseno",
  "releaseid",
  "recordversion",
  "createdat",
  "createdtime",
  "updatedat",
  "lastmodifiedtime",
  "publishedat",
  "timestamp",
  "fingerprint",
  "sha256",
  "hash",
]);

const canonicalPriceKeySet = new Set([
  "price",
  "canonicalprice",
  "pricekrw",
  "pricewon",
  "unitprice",
  "canonicalpricekrw",
  "defaultprice",
  "listprice",
  "billingprice",
  "suggestedprice",
  "standardprice",
  "baseprice",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimNullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value.trim() || null : null;
}

function normalizedName(value: unknown): string {
  return trimNullable(value)?.replace(/\s+/gu, " ").toLowerCase() ?? "";
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortIssues(
  issues: ClinicalMasterAirtableValidationIssue[],
): ClinicalMasterAirtableValidationIssue[] {
  return [...issues].sort(
    (left, right) =>
      compareStrings(left.path, right.path) ||
      compareStrings(left.code, right.code) ||
      compareStrings(left.message, right.message),
  );
}

function addIssue(
  issues: ClinicalMasterAirtableValidationIssue[],
  path: string,
  code: string,
  message: string,
) {
  issues.push({ path, code, message });
}

function validateContractKeys(
  contract: keyof typeof contractAllowedKeys,
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
): value is Record<string, unknown> {
  if (!isObject(value)) {
    addIssue(issues, path, `${contract}_object_required`, `${contract} must be an object.`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!contractAllowedKeys[contract].has(key)) {
      addIssue(
        issues,
        `${path}.${key}`,
        `${contract}_field_unknown`,
        `${contract} field ${key} is not part of the authoring export contract.`,
      );
    }
  }
  return true;
}

function requiredString(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
  code = "required",
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
  return normalized || null;
}

function optionalString(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    addIssue(issues, path, "string_type_invalid", "The value must be a string when present.");
    return null;
  }
  return value.trim() || null;
}

function nonNegativeInteger(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
  optional = false,
): number | null {
  if ((value === undefined || value === null) && optional) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    addIssue(issues, path, "non_negative_integer_required", "A non-negative integer is required.");
    return null;
  }
  return value;
}

function booleanValue(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
  fallback: boolean,
): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    addIssue(issues, path, "boolean_type_invalid", "A boolean value is required.");
    return fallback;
  }
  return value;
}

function stableKey(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
  code = "stable_key_required",
): string | null {
  const result = requiredString(value, path, issues, code);
  if (!result) return null;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result) ||
    /^rec[a-z0-9]{3,}$/iu.test(result)
  ) {
    addIssue(
      issues,
      path,
      "stable_key_identity_forbidden",
      "A UUID or Airtable record identity cannot be an authoring/export key.",
    );
  }
  return result;
}

function normalizedKeyName(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function usableStableKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (!key) return null;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(key) ||
    /^rec[a-z0-9]{3,}$/iu.test(key)
  ) {
    return null;
  }
  return key;
}

function stableCollectionPath(
  collection: string,
  index: number,
  key: unknown,
): string {
  return `${collection}[${usableStableKey(key) ?? index}]`;
}

function stableNamePath(path: string, index: number, value: unknown): string {
  if (!isObject(value)) return `${path}[${index}]`;
  const language = usableStableKey(value.languageCode);
  const kind = usableStableKey(value.nameKind);
  const name = normalizedName(value.name);
  if (!language || !kind || !name) return `${path}[${index}]`;
  return `${path}[${language}|${kind}|${name}]`;
}

function stableArrayItemKey(collection: string, value: unknown): string | null {
  if (!isObject(value)) return null;
  switch (collection) {
    case "records":
      return usableStableKey(value.masterKey);
    case "sources":
      return usableStableKey(value.sourceKey);
    case "classificationPaths":
      return usableStableKey(value.pathKey);
    case "labPanelItems": {
      const panel = usableStableKey(value.panelMasterKey);
      const test = usableStableKey(value.testMasterKey);
      return panel && test ? `${panel}|${test}` : panel ?? test;
    }
    case "labOrderProfiles":
      return usableStableKey(value.orderMasterKey);
    case "diagnosisCategoryLinks": {
      const diagnosis = usableStableKey(value.diagnosisMasterKey);
      const category = usableStableKey(value.categoryMasterKey);
      return diagnosis && category ? `${diagnosis}|${category}` : diagnosis ?? category;
    }
    case "names": {
      const language = usableStableKey(value.languageCode);
      const kind = usableStableKey(value.nameKind);
      const name = normalizedName(value.name);
      return language && kind && name ? `${language}|${kind}|${name}` : null;
    }
    default:
      return null;
  }
}

function scanAuthorityFields(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
  arrayLabel?: string,
) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      const key = arrayLabel ? stableArrayItemKey(arrayLabel, child) : null;
      scanAuthorityFields(child, `${path}[${key ?? index}]`, issues);
    });
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKeyName(key);
    if (/formula/u.test(normalized)) {
      addIssue(
        issues,
        `${path}.${key}`,
        "airtable_formula_forbidden",
        "Airtable formulas are display helpers, not export authority.",
      );
    }
    if (/lookup/u.test(normalized)) {
      addIssue(
        issues,
        `${path}.${key}`,
        "airtable_lookup_forbidden",
        "Airtable lookup display values are not export authority.",
      );
    }
    if (
      normalized === "id" ||
      normalized === "_id" ||
      normalized === "recordid" ||
      normalized === "rowid" ||
      normalized === "airtableid" ||
      normalized === "airtablerecordid" ||
      normalized === "airtableprimaryid" ||
      normalized === "airtablerecordurl" ||
      normalized === "airtablerecordname" ||
      normalized === "airtableurl" ||
      normalized === "createdtime" ||
      normalized === "lastmodifiedtime"
    ) {
      addIssue(
        issues,
        `${path}.${key}`,
        "airtable_identity_forbidden",
        "Airtable record IDs cannot be export authority.",
      );
    }
    if (
      generatedAuthorityKeySet.has(normalized)
    ) {
      addIssue(
        issues,
        `${path}.${key}`,
        "generated_authority_forbidden",
        "Generated revisions, releases, timestamps, and fingerprints are server authority only.",
      );
    }
    scanAuthorityFields(child, `${path}.${key}`, issues, key);
  }
}

function scanPricingFields(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
  arrayLabel?: string,
) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      const key = arrayLabel ? stableArrayItemKey(arrayLabel, child) : null;
      scanPricingFields(child, `${path}[${key ?? index}]`, issues);
    });
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKeyName(key);
    if (
      canonicalPriceKeySet.has(normalized)
    ) {
      addIssue(
        issues,
        `${path}.${key}`,
        "canonical_price_forbidden",
        "Canonical price is workspace-owned and is not part of this export contract.",
      );
    }
    if (
      /price(u|l|r|range|tier|bracket|set|pricing)/u.test(normalized) ||
      /(?:price|pricing).*(?:range|tier|bracket|set|weight)/u.test(normalized) ||
      /(?:^|order)set(?:price|pricing|range|tier|bracket|weight)/u.test(normalized) ||
      normalized === "pricingrule" ||
      /orderset.*(price|pricing|range|weight|bracket)/u.test(normalized) ||
      /weight(range|tier|bracket)/u.test(normalized) ||
      /(?:lower|upper).*(price|range)/u.test(normalized) ||
      /(range|bracket).*(price|weight)/u.test(normalized)
    ) {
      addIssue(
        issues,
        `${path}.${key}`,
        "workspace_order_set_pricing_forbidden",
        "Order Set price ranges and weight brackets remain workspace-owned.",
      );
    }
    scanPricingFields(child, `${path}.${key}`, issues, key);
  }
}

function validateRecordDetail(
  recordType: ClinicalMasterAirtableRecordType,
  detail: unknown,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
) {
  if (!isObject(detail)) {
    addIssue(issues, path, "detail_object_required", "A typed detail object is required.");
    return;
  }
  for (const key of Object.keys(detail)) {
    if (!detailAllowedKeys[recordType].has(key)) {
      addIssue(issues, `${path}.${key}`, "detail_field_unknown", "Unknown typed detail field.");
    }
  }

  const requireDetail = (key: string) =>
    requiredString(detail[key], `${path}.${key}`, issues, "detail_required");
  const optionalDetail = (key: string) => optionalString(detail[key], `${path}.${key}`, issues);

  switch (recordType) {
    case "order_category": {
      const level = requireDetail("categoryLevel");
      requireDetail("categoryCode");
      const parent = optionalDetail("parentMasterKey");
      nonNegativeInteger(detail.sortOrder, `${path}.sortOrder`, issues, true);
      if (level === "X" && parent) {
        addIssue(issues, `${path}.parentMasterKey`, "x_parent_forbidden", "An X category cannot have a parent.");
      }
      if (level === "T" && !parent) {
        addIssue(issues, `${path}.parentMasterKey`, "t_parent_required", "A T category must reference an X parent.");
      }
      if (level !== "X" && level !== "T") {
        addIssue(issues, `${path}.categoryLevel`, "category_level_invalid", "Category level must be X or T.");
      }
      break;
    }
    case "clinical_action":
      requireDetail("tCategoryKey");
      {
        const itemType = requireDetail("itemType");
        if (itemType && !itemTypeSet.has(itemType)) {
          addIssue(issues, `${path}.itemType`, "item_type_invalid", "Clinical action item type is not supported.");
        }
      }
      booleanValue(detail.isOtherUnclassified, `${path}.isOtherUnclassified`, issues, false);
      break;
    case "chart_group":
      requireDetail("groupCode");
      nonNegativeInteger(detail.sortOrder, `${path}.sortOrder`, issues, true);
      break;
    case "task_route": {
      const routeCode = requireDetail("routeCode");
      const tuple = routeCode ? routeTuples[routeCode as keyof typeof routeTuples] : undefined;
      if (!tuple) {
        addIssue(issues, `${path}.routeCode`, "route_code_invalid", "Task route code is not supported.");
      }
      break;
    }
    case "order": {
      requireDetail("classificationPathKey");
      optionalDetail("defaultSalesUnitCode");
      const species = detail.species;
      if (!Array.isArray(species) || species.length === 0) {
        addIssue(issues, `${path}.species`, "order_species_required", "An order must support at least one species.");
      } else {
        const seenSpecies = new Set<string>();
        species.forEach((value, index) => {
          const speciesValue = typeof value === "string" ? value.trim() : "";
          const speciesPath = `${path}.species[${usableStableKey(speciesValue) ?? index}]`;
          if (speciesValue !== "dog" && speciesValue !== "cat") {
            addIssue(issues, speciesPath, "species_scope_invalid", "Only dog and cat are supported.");
          }
          if (seenSpecies.has(speciesValue)) {
            addIssue(issues, speciesPath, "order_species_duplicate", "An order cannot repeat a species link.");
          }
          seenSpecies.add(speciesValue);
        });
      }
      if (detail.defaultQuantity !== undefined && detail.defaultQuantity !== null) {
        if (
          typeof detail.defaultQuantity !== "number" ||
          !Number.isFinite(detail.defaultQuantity) ||
          detail.defaultQuantity <= 0
        ) {
          addIssue(issues, `${path}.defaultQuantity`, "quantity_positive", "Default quantity must be positive.");
        }
      }
      if (
        detail.defaultBillingReflectionEnabled !== undefined &&
        detail.defaultBillingReflectionEnabled !== null &&
        typeof detail.defaultBillingReflectionEnabled !== "boolean"
      ) {
        addIssue(issues, `${path}.defaultBillingReflectionEnabled`, "billing_reflection_boolean", "Billing reflection must be boolean.");
      }
      break;
    }
    case "species": {
      const code = requireDetail("speciesCode");
      if (code !== "dog" && code !== "cat") {
        addIssue(issues, `${path}.speciesCode`, "species_scope_invalid", "Only dog and cat are supported.");
      }
      break;
    }
    case "unit":
      requireDetail("unitCode");
      requireDetail("symbol");
      nonNegativeInteger(detail.decimalScale, `${path}.decimalScale`, issues, true);
      break;
    case "specimen_type":
      requireDetail("specimenCode");
      break;
    case "result_input_type": {
      requireDetail("inputCode");
      const valueKind = requireDetail("valueKind");
      if (valueKind && !valueKindSet.has(valueKind)) {
        addIssue(issues, `${path}.valueKind`, "value_kind_invalid", "Result input value kind is not supported.");
      }
      booleanValue(detail.supportsUnit, `${path}.supportsUnit`, issues, false);
      break;
    }
    case "lab_test":
      requireDetail("testCode");
      requireDetail("resultInputTypeKey");
      optionalDetail("canonicalUnitKey");
      nonNegativeInteger(detail.decimalScale, `${path}.decimalScale`, issues, true);
      break;
    case "lab_panel":
      requireDetail("panelCode");
      break;
    case "diagnosis_category": {
      const categoryKind = requireDetail("categoryKind");
      if (categoryKind && !categoryKindSet.has(categoryKind)) {
        addIssue(issues, `${path}.categoryKind`, "diagnosis_category_kind_invalid", "Diagnosis category kind must be system or disease_group.");
      }
      const parent = optionalDetail("parentMasterKey");
      nonNegativeInteger(detail.sortOrder, `${path}.sortOrder`, issues, true);
      if (categoryKind === "system" && parent) {
        addIssue(issues, `${path}.parentMasterKey`, "diagnosis_system_parent_forbidden", "A diagnosis system cannot have a parent.");
      }
      if (categoryKind === "disease_group" && !parent) {
        addIssue(issues, `${path}.parentMasterKey`, "diagnosis_disease_group_parent_required", "A disease group must reference a system parent.");
      }
      break;
    }
    case "diagnosis":
      break;
  }
}

function validateNames(
  record: Record<string, unknown>,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
) {
  const rawNames = record.names;
  if (!Array.isArray(rawNames) || rawNames.length === 0) {
    addIssue(issues, path, "names_required", "At least one name is required.");
    return;
  }
  const preferredKo = rawNames.filter(
    (value) =>
      isObject(value) &&
      trimNullable(value.languageCode) === "ko" &&
      trimNullable(value.nameKind) === "preferred",
  );
  const preferredEn = rawNames.filter(
    (value) =>
      isObject(value) &&
      trimNullable(value.languageCode) === "en" &&
      trimNullable(value.nameKind) === "preferred",
  );
  if (preferredKo.length !== 1) {
    addIssue(issues, path, "preferred_ko_exactly_one", "Exactly one preferred Korean name is required.");
  }
  if (preferredEn.length > 1) {
    addIssue(issues, path, "preferred_en_at_most_one", "At most one preferred English name is allowed.");
  }

  const seenNames = new Set<string>();
  rawNames.forEach((rawName, index) => {
    const namePath = stableNamePath(path, index, rawName);
    if (!validateContractKeys("name", rawName, namePath, issues)) return;
    const name = rawName as Record<string, unknown>;
    const language = requiredString(name.languageCode, `${namePath}.languageCode`, issues, "language_required");
    const kind = requiredString(name.nameKind, `${namePath}.nameKind`, issues, "name_kind_required");
    requiredString(name.name, `${namePath}.name`, issues, "name_required");
    if (language && !languageSet.has(language)) {
      addIssue(issues, `${namePath}.languageCode`, "language_invalid", "Names must use ko or en.");
    }
    if (kind && !nameKindSet.has(kind)) {
      addIssue(issues, `${namePath}.nameKind`, "name_kind_invalid", "Name kind is not supported.");
    }
    if (name.searchable !== undefined && name.searchable !== null && typeof name.searchable !== "boolean") {
      addIssue(issues, `${namePath}.searchable`, "searchable_boolean", "Searchable must be boolean.");
    }
    nonNegativeInteger(name.sortOrder, `${namePath}.sortOrder`, issues, true);
    const normalized = normalizedName(name.name);
    if (language && normalized) {
      const nameKey = `${language}|${kind}|${normalized}`;
      if (seenNames.has(nameKey)) {
        addIssue(issues, namePath, "normalized_name_duplicate", "Names cannot duplicate after whitespace/case normalization.");
      }
      seenNames.add(nameKey);
    }
  });
}

function validateSources(
  rawSources: unknown,
  issues: ClinicalMasterAirtableValidationIssue[],
): Map<string, ClinicalMasterAirtableSourceInput> {
  const sourcesByKey = new Map<string, ClinicalMasterAirtableSourceInput>();
  if (!Array.isArray(rawSources) || rawSources.length === 0) {
    addIssue(issues, "sources", "sources_required", "At least one source snapshot is required.");
    return sourcesByKey;
  }
  rawSources.forEach((rawSource, index) => {
    const path = stableCollectionPath(
      "sources",
      index,
      isObject(rawSource) ? rawSource.sourceKey : null,
    );
    if (!validateContractKeys("source", rawSource, path, issues)) return;
    const source = rawSource as Record<string, unknown>;
    const sourceKey = stableKey(source.sourceKey, `${path}.sourceKey`, issues, "source_key_required");
    const sourceType = requiredString(source.sourceType, `${path}.sourceType`, issues, "source_type_required");
    const title = requiredString(source.title, `${path}.title`, issues, "source_title_required");
    for (const field of ["referenceUri", "sourceVersion", "accessedAt", "licenseNotes"]) {
      optionalString(source[field], `${path}.${field}`, issues);
    }
    if (sourceType && sourceType !== "synthetic") {
      addIssue(issues, `${path}.sourceType`, "synthetic_source_required", "Only synthetic sources may be exported.");
    }
    if (sourceKey) {
      if (sourcesByKey.has(sourceKey)) {
        addIssue(issues, `${path}.sourceKey`, "source_key_duplicate", "Source keys must be unique.");
      } else {
        sourcesByKey.set(sourceKey, {
          ...source,
          sourceKey,
          sourceType,
          title,
        } as ClinicalMasterAirtableSourceInput);
      }
    }
  });
  return sourcesByKey;
}

function validateRelease(
  rawRelease: unknown,
  issues: ClinicalMasterAirtableValidationIssue[],
) {
  if (!validateContractKeys("release", rawRelease, "release", issues)) return;
  const release = rawRelease as Record<string, unknown>;
  stableKey(release.releaseKey, "release.releaseKey", issues, "release_key_required");
  const status = requiredString(release.status, "release.status", issues, "release_status_required");
  if (status !== null && status !== "approved") {
    addIssue(issues, "release.status", "release_not_approved", "Only an approved release can be exported.");
  }
  for (const field of [
    "publishedByLabel",
    "authoredByLabel",
    "reviewedByLabel",
  ]) {
    requiredString(release[field], `release.${field}`, issues, `${field}_required`);
  }
  optionalString(release.clinicalReviewerLabel, "release.clinicalReviewerLabel", issues);
  optionalString(release.releaseNotes, "release.releaseNotes", issues);
  requiredString(release.reviewReason, "release.reviewReason", issues, "review_reason_required");
}

function getRecord(
  recordsByKey: Map<string, Record<string, unknown>>,
  key: string | null,
): Record<string, unknown> | null {
  return key ? recordsByKey.get(key) ?? null : null;
}

function recordTypeOf(record: Record<string, unknown> | null): string | null {
  return record && typeof record.recordType === "string" ? record.recordType : null;
}

function requireReference(
  recordsByKey: Map<string, Record<string, unknown>>,
  key: string | null,
  expectedType: ClinicalMasterAirtableRecordType,
  path: string,
  issues: ClinicalMasterAirtableValidationIssue[],
  code: string,
) {
  if (!key) return null;
  const record = getRecord(recordsByKey, key);
  if (!record) {
    addIssue(issues, path, `${code}_missing`, "Relation must reference a record in the same complete snapshot.");
    return null;
  }
  if (recordTypeOf(record) !== expectedType) {
    addIssue(issues, path, `${code}_type_invalid`, `Relation must reference a ${expectedType} record.`);
  }
  return record;
}

function validateRecords(
  rawRecords: unknown,
  sourcesByKey: Map<string, ClinicalMasterAirtableSourceInput>,
  issues: ClinicalMasterAirtableValidationIssue[],
): Map<string, Record<string, unknown>> {
  const recordsByKey = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    addIssue(issues, "records", "records_required", "At least one master record is required.");
    return recordsByKey;
  }

  rawRecords.forEach((rawRecord, index) => {
    const path = stableCollectionPath(
      "records",
      index,
      isObject(rawRecord) ? rawRecord.masterKey : null,
    );
    if (!validateContractKeys("record", rawRecord, path, issues)) return;
    const record = rawRecord as Record<string, unknown>;
    const masterKey = stableKey(record.masterKey, `${path}.masterKey`, issues);
    const recordType = requiredString(record.recordType, `${path}.recordType`, issues, "record_type_required");
    if (!recordType || !recordTypeSet.has(recordType)) {
      addIssue(issues, `${path}.recordType`, "record_type_invalid", "Record type is outside the v1 contract.");
    }
    const authoringStatus = requiredString(
      record.authoringStatus,
      `${path}.authoringStatus`,
      issues,
      "authoring_status_required",
    );
    if (authoringStatus !== null && authoringStatus !== "approved") {
      addIssue(
        issues,
        `${path}.authoringStatus`,
        "authoring_not_approved",
        "Only records with authoringStatus approved can be exported.",
      );
    }
    const lifecycleStatus = requiredString(
      record.lifecycleStatus,
      `${path}.lifecycleStatus`,
      issues,
      "lifecycle_status_required",
    );
    if (lifecycleStatus !== "published") {
      addIssue(issues, `${path}.lifecycleStatus`, "published_lifecycle_required", "Only published records can be exported.");
    }
    const safetyStatus = requiredString(
      record.safetyStatus,
      `${path}.safetyStatus`,
      issues,
      "safety_status_required",
    );
    if (safetyStatus !== "normal") {
      addIssue(issues, `${path}.safetyStatus`, "normal_safety_required", "Only normal-safety records can be exported.");
    }
    optionalString(record.safetyReason, `${path}.safetyReason`, issues);
    requiredString(record.changeSummary, `${path}.changeSummary`, issues, "change_summary_required");
    const sourceKey = stableKey(record.sourceKey, `${path}.sourceKey`, issues, "source_key_required");
    if (sourceKey && !sourcesByKey.has(sourceKey)) {
      addIssue(issues, `${path}.sourceKey`, "source_reference_missing", "Every record must reference one source in the same snapshot.");
    }
    requiredString(
      record.sourceAssertionScope,
      `${path}.sourceAssertionScope`,
      issues,
      "source_assertion_scope_required",
    );
    optionalString(record.sourceNotes, `${path}.sourceNotes`, issues);
    validateNames(record, `${path}.names`, issues);
    if (recordType && recordTypeSet.has(recordType)) {
      validateRecordDetail(recordType as ClinicalMasterAirtableRecordType, record.detail, `${path}.detail`, issues);
    }
    if (masterKey) {
      if (recordsByKey.has(masterKey)) {
        addIssue(issues, `${path}.masterKey`, "master_key_duplicate", "Master keys must be unique.");
      } else {
        recordsByKey.set(masterKey, {
          ...record,
          masterKey,
          recordType,
          authoringStatus,
          lifecycleStatus,
          safetyStatus,
          sourceKey,
        });
      }
    }
  });
  return recordsByKey;
}

function validateClassificationPaths(
  rawPaths: unknown,
  recordsByKey: Map<string, Record<string, unknown>>,
  issues: ClinicalMasterAirtableValidationIssue[],
): { pathKeys: Set<string>; routeCodesByPath: Map<string, string | null> } {
  const pathKeys = new Set<string>();
  const actionKeys = new Set<string>();
  const routeCodesByPath = new Map<string, string | null>();
  if (rawPaths === undefined) return { pathKeys, routeCodesByPath };
  if (!Array.isArray(rawPaths)) {
    addIssue(issues, "classificationPaths", "classification_paths_array", "Classification paths must be an array.");
    return { pathKeys, routeCodesByPath };
  }
  rawPaths.forEach((rawPath, index) => {
    const path = stableCollectionPath(
      "classificationPaths",
      index,
      isObject(rawPath) ? rawPath.pathKey : null,
    );
    if (!validateContractKeys("path", rawPath, path, issues)) return;
    const value = rawPath as Record<string, unknown>;
    const pathKey = stableKey(value.pathKey, `${path}.pathKey`, issues, "path_key_required");
    const actionKey = stableKey(value.clinicalActionKey, `${path}.clinicalActionKey`, issues, "clinical_action_key_required");
    const chartKey = stableKey(value.chartGroupKey, `${path}.chartGroupKey`, issues, "chart_group_key_required");
    const routeKey = stableKey(value.taskRouteKey, `${path}.taskRouteKey`, issues, "task_route_key_required");
    if (pathKey) {
      if (pathKeys.has(pathKey)) addIssue(issues, `${path}.pathKey`, "path_key_duplicate", "Path keys must be unique.");
      pathKeys.add(pathKey);
    }
    if (actionKey) {
      if (actionKeys.has(actionKey)) addIssue(issues, `${path}.clinicalActionKey`, "active_path_duplicate", "A clinical action may have only one path in a snapshot.");
      actionKeys.add(actionKey);
    }
    requireReference(recordsByKey, actionKey, "clinical_action", `${path}.clinicalActionKey`, issues, "clinical_action_reference");
    requireReference(recordsByKey, chartKey, "chart_group", `${path}.chartGroupKey`, issues, "chart_group_reference");
    const route = requireReference(recordsByKey, routeKey, "task_route", `${path}.taskRouteKey`, issues, "task_route_reference");
    if (route) {
      const detail = isObject(route.detail) ? route.detail : null;
      const routeCode = trimNullable(detail?.routeCode);
      const tuple = routeCode ? routeTuples[routeCode as keyof typeof routeTuples] : undefined;
      const runtimeStatus = tuple?.runtimeStatus ?? null;
      if (runtimeStatus !== "active") {
        addIssue(issues, `${path}.taskRouteKey`, "held_route_rejected", "A published classification path cannot use a held route.");
      }
      if (pathKey) routeCodesByPath.set(pathKey, routeCode);
    } else if (pathKey) {
      routeCodesByPath.set(pathKey, null);
    }
  });
  return { pathKeys, routeCodesByPath };
}

function validateCrossRecordReferences(
  recordsByKey: Map<string, Record<string, unknown>>,
  pathKeys: Set<string>,
  issues: ClinicalMasterAirtableValidationIssue[],
) {
  for (const [masterKey, record] of recordsByKey) {
    const recordType = recordTypeOf(record);
    const detail = isObject(record.detail) ? record.detail : null;
    const path = `records[${masterKey}].detail`;
    if (!detail) continue;
    if (recordType === "order_category") {
      const level = trimNullable(detail.categoryLevel);
      const parentKey = trimNullable(detail.parentMasterKey);
      if (level === "T") {
        const parent = requireReference(recordsByKey, parentKey, "order_category", `${path}.parentMasterKey`, issues, "order_category_parent_reference");
        const parentDetail = parent && isObject(parent.detail) ? parent.detail : null;
        if (parentDetail && trimNullable(parentDetail.categoryLevel) !== "X") {
          addIssue(issues, `${path}.parentMasterKey`, "t_parent_type_invalid", "A T category must reference an X category.");
        }
      }
    }
    if (recordType === "clinical_action") {
      const categoryKey = trimNullable(detail.tCategoryKey);
      const category = requireReference(recordsByKey, categoryKey, "order_category", `${path}.tCategoryKey`, issues, "clinical_action_category_reference");
      if (category) {
        const categoryDetail = isObject(category.detail) ? category.detail : null;
        if (trimNullable(categoryDetail?.categoryLevel) !== "T") {
          addIssue(issues, `${path}.tCategoryKey`, "clinical_action_category_level_invalid", "A clinical action must reference a T category.");
        }
      }
    }
    if (recordType === "order") {
      const classificationPathKey = trimNullable(detail.classificationPathKey);
      if (!classificationPathKey || !pathKeys.has(classificationPathKey)) {
        addIssue(issues, `${path}.classificationPathKey`, "order_path_reference_invalid", "An order must reference a path in the same snapshot.");
      }
      const unitCode = trimNullable(detail.defaultSalesUnitCode);
      if (unitCode) {
        const unit = [...recordsByKey.values()].find((candidate) => {
          if (recordTypeOf(candidate) !== "unit" || !isObject(candidate.detail)) return false;
          return trimNullable(candidate.detail.unitCode) === unitCode;
        });
        if (!unit) addIssue(issues, `${path}.defaultSalesUnitCode`, "order_unit_reference_missing", "Default sales unit code must resolve to a unit record in the snapshot.");
      }
      if (Array.isArray(detail.species)) {
        detail.species.forEach((value, index) => {
          const speciesCode = trimNullable(value);
          const species = [...recordsByKey.values()].find((candidate) => {
            if (recordTypeOf(candidate) !== "species" || !isObject(candidate.detail)) return false;
            return trimNullable(candidate.detail.speciesCode) === speciesCode;
          });
          if (!species) {
            addIssue(
              issues,
              `${path}.species[${index}]`,
              "order_species_reference_missing",
              "Every order species must resolve to a species record in the snapshot.",
            );
          }
        });
      }
    }
    if (recordType === "lab_test") {
      const inputKey = trimNullable(detail.resultInputTypeKey);
      requireReference(recordsByKey, inputKey, "result_input_type", `${path}.resultInputTypeKey`, issues, "lab_test_input_reference");
      const unitKey = trimNullable(detail.canonicalUnitKey);
      const unit = unitKey ? requireReference(recordsByKey, unitKey, "unit", `${path}.canonicalUnitKey`, issues, "lab_test_unit_reference") : null;
      if (unitKey && unit) {
        const input = inputKey ? getRecord(recordsByKey, inputKey) : null;
        const inputDetail = input && isObject(input.detail) ? input.detail : null;
        if (inputDetail?.supportsUnit === false) {
          addIssue(issues, `${path}.canonicalUnitKey`, "lab_test_unit_not_supported", "A result input type that does not support units cannot have a canonical unit.");
        }
      }
    }
    if (recordType === "diagnosis_category") {
      const categoryKind = trimNullable(detail.categoryKind);
      const parentKey = trimNullable(detail.parentMasterKey);
      if (categoryKind === "disease_group") {
        const parent = requireReference(recordsByKey, parentKey, "diagnosis_category", `${path}.parentMasterKey`, issues, "diagnosis_category_parent_reference");
        const parentDetail = parent && isObject(parent.detail) ? parent.detail : null;
        if (parentDetail && trimNullable(parentDetail.categoryKind) !== "system") {
          addIssue(issues, `${path}.parentMasterKey`, "diagnosis_parent_must_be_system", "A disease group must reference a system category.");
        }
      }
    }
  }
}

function validateLabRelations(
  rawPanelItems: unknown,
  rawProfiles: unknown,
  recordsByKey: Map<string, Record<string, unknown>>,
  routeCodesByPath: Map<string, string | null>,
  issues: ClinicalMasterAirtableValidationIssue[],
) {
  const panelItemsByPanel = new Map<string, number>();
  if (rawPanelItems !== undefined && !Array.isArray(rawPanelItems)) {
    addIssue(issues, "labPanelItems", "lab_panel_items_array", "Lab panel items must be an array.");
  } else if (Array.isArray(rawPanelItems)) {
    const seenPair = new Set<string>();
    const seenSort = new Set<string>();
    rawPanelItems.forEach((rawItem, index) => {
      const path = stableCollectionPath(
        "labPanelItems",
        index,
        stableArrayItemKey("labPanelItems", rawItem),
      );
      if (!validateContractKeys("labPanelItem", rawItem, path, issues)) return;
      const item = rawItem as Record<string, unknown>;
      const panelKey = stableKey(item.panelMasterKey, `${path}.panelMasterKey`, issues, "panel_key_required");
      const testKey = stableKey(item.testMasterKey, `${path}.testMasterKey`, issues, "test_key_required");
      const sortOrder = nonNegativeInteger(item.sortOrder, `${path}.sortOrder`, issues, true);
      booleanValue(item.required, `${path}.required`, issues, true);
      optionalString(item.displayGroup, `${path}.displayGroup`, issues);
      if (panelKey && testKey) {
        const pair = `${panelKey}|${testKey}`;
        const ordinal = `${panelKey}|${sortOrder ?? 0}`;
        if (seenPair.has(pair)) addIssue(issues, path, "lab_panel_item_duplicate", "A panel cannot repeat a test.");
        if (seenSort.has(ordinal)) addIssue(issues, path, "lab_panel_sort_duplicate", "A panel cannot repeat a sort order.");
        seenPair.add(pair);
        seenSort.add(ordinal);
        panelItemsByPanel.set(panelKey, (panelItemsByPanel.get(panelKey) ?? 0) + 1);
      }
      requireReference(recordsByKey, panelKey, "lab_panel", `${path}.panelMasterKey`, issues, "lab_panel_reference");
      requireReference(recordsByKey, testKey, "lab_test", `${path}.testMasterKey`, issues, "lab_test_reference");
    });
  }

  for (const [masterKey, record] of recordsByKey) {
    if (recordTypeOf(record) === "lab_panel" && !panelItemsByPanel.has(masterKey)) {
      addIssue(issues, `records[${masterKey}]`, "lab_panel_items_required", "Every lab panel needs its complete item snapshot.");
    }
  }

  const profileCountByOrder = new Map<string, number>();
  if (rawProfiles !== undefined && !Array.isArray(rawProfiles)) {
    addIssue(issues, "labOrderProfiles", "lab_order_profiles_array", "Lab order profiles must be an array.");
  } else if (Array.isArray(rawProfiles)) {
    const seenOrders = new Set<string>();
    rawProfiles.forEach((rawProfile, index) => {
      const path = stableCollectionPath(
        "labOrderProfiles",
        index,
        isObject(rawProfile) ? rawProfile.orderMasterKey : null,
      );
      if (!validateContractKeys("labOrderProfile", rawProfile, path, issues)) return;
      const profile = rawProfile as Record<string, unknown>;
      const orderKey = stableKey(profile.orderMasterKey, `${path}.orderMasterKey`, issues, "order_key_required");
      const testKey = optionalString(profile.labTestMasterKey, `${path}.labTestMasterKey`, issues);
      const panelKey = optionalString(profile.labPanelMasterKey, `${path}.labPanelMasterKey`, issues);
      const specimenKey = optionalString(profile.specimenMasterKey, `${path}.specimenMasterKey`, issues);
      if (orderKey && seenOrders.has(orderKey)) addIssue(issues, path, "lab_order_profile_duplicate", "An order may have only one laboratory profile.");
      if (orderKey) {
        seenOrders.add(orderKey);
        profileCountByOrder.set(orderKey, (profileCountByOrder.get(orderKey) ?? 0) + 1);
      }
      if ((testKey ? 1 : 0) + (panelKey ? 1 : 0) !== 1) {
        addIssue(issues, path, "lab_order_profile_target_exactly_one", "A profile must target exactly one lab test or panel.");
      }
      requireReference(recordsByKey, orderKey, "order", `${path}.orderMasterKey`, issues, "lab_order_reference");
      requireReference(recordsByKey, testKey, "lab_test", `${path}.labTestMasterKey`, issues, "lab_test_reference");
      requireReference(recordsByKey, panelKey, "lab_panel", `${path}.labPanelMasterKey`, issues, "lab_panel_reference");
      requireReference(recordsByKey, specimenKey, "specimen_type", `${path}.specimenMasterKey`, issues, "specimen_reference");
    });

  }

  for (const [masterKey, record] of recordsByKey) {
    if (recordTypeOf(record) !== "order") continue;
    const detail = isObject(record.detail) ? record.detail : null;
    const pathKey = trimNullable(detail?.classificationPathKey);
    if (routeCodesByPath.get(pathKey ?? "") === "NT_LAB") {
      if ((profileCountByOrder.get(masterKey) ?? 0) !== 1) {
        addIssue(
          issues,
          `records[${masterKey}]`,
          "lab_order_profile_exactly_one",
          "Every laboratory order must have exactly one laboratory profile.",
        );
      }
    }
  }
}

function validateDiagnosisRelations(
  rawLinks: unknown,
  recordsByKey: Map<string, Record<string, unknown>>,
  issues: ClinicalMasterAirtableValidationIssue[],
) {
  const linksByDiagnosis = new Map<string, Array<{ isPrimary: boolean; sortOrder: number }>>();
  if (rawLinks !== undefined && !Array.isArray(rawLinks)) {
    addIssue(issues, "diagnosisCategoryLinks", "diagnosis_category_links_array", "Diagnosis category links must be an array.");
  } else if (Array.isArray(rawLinks)) {
    const seenPairs = new Set<string>();
    const seenSorts = new Set<string>();
    rawLinks.forEach((rawLink, index) => {
      const path = stableCollectionPath(
        "diagnosisCategoryLinks",
        index,
        stableArrayItemKey("diagnosisCategoryLinks", rawLink),
      );
      if (!validateContractKeys("diagnosisCategoryLink", rawLink, path, issues)) return;
      const link = rawLink as Record<string, unknown>;
      const diagnosisKey = stableKey(link.diagnosisMasterKey, `${path}.diagnosisMasterKey`, issues, "diagnosis_key_required");
      const categoryKey = stableKey(link.categoryMasterKey, `${path}.categoryMasterKey`, issues, "category_key_required");
      const isPrimary = booleanValue(link.isPrimary, `${path}.isPrimary`, issues, false);
      const sortOrder = nonNegativeInteger(link.sortOrder, `${path}.sortOrder`, issues, true) ?? 0;
      if (diagnosisKey && categoryKey) {
        const pair = `${diagnosisKey}|${categoryKey}`;
        const sort = `${diagnosisKey}|${sortOrder}`;
        if (seenPairs.has(pair)) addIssue(issues, path, "diagnosis_link_duplicate", "A diagnosis cannot repeat a category link.");
        if (seenSorts.has(sort)) addIssue(issues, path, "diagnosis_link_sort_duplicate", "A diagnosis cannot repeat a link sort order.");
        seenPairs.add(pair);
        seenSorts.add(sort);
        const links = linksByDiagnosis.get(diagnosisKey) ?? [];
        links.push({ isPrimary, sortOrder });
        linksByDiagnosis.set(diagnosisKey, links);
      }
      requireReference(recordsByKey, diagnosisKey, "diagnosis", `${path}.diagnosisMasterKey`, issues, "diagnosis_reference");
      const category = requireReference(recordsByKey, categoryKey, "diagnosis_category", `${path}.categoryMasterKey`, issues, "diagnosis_category_reference");
      const categoryDetail = category && isObject(category.detail) ? category.detail : null;
      if (categoryDetail && trimNullable(categoryDetail.categoryKind) !== "disease_group") {
        addIssue(issues, `${path}.categoryMasterKey`, "diagnosis_link_target_must_be_disease_group", "Diagnosis links must target disease groups, never system roots.");
      }
    });
  }

  for (const [masterKey, record] of recordsByKey) {
    if (recordTypeOf(record) !== "diagnosis") continue;
    const links = linksByDiagnosis.get(masterKey) ?? [];
    if (links.length < 1) {
      addIssue(issues, `records[${masterKey}]`, "diagnosis_link_required", "Every diagnosis needs at least one category link.");
    }
    const primaryCount = links.filter((link) => link.isPrimary).length;
    if (primaryCount !== 1) {
      addIssue(issues, `records[${masterKey}]`, "diagnosis_primary_exactly_one", "Every diagnosis needs exactly one primary category link.");
    }
  }
}

function normalizeDetail(
  recordType: ClinicalMasterAirtableRecordType,
  detail: Record<string, unknown>,
): Record<string, unknown> {
  const text = (key: string) => trimNullable(detail[key]);
  switch (recordType) {
    case "order_category":
      return {
        categoryCode: text("categoryCode"),
        categoryLevel: text("categoryLevel"),
        parentMasterKey: text("parentMasterKey"),
        sortOrder: detail.sortOrder ?? 0,
      };
    case "clinical_action":
      return {
        tCategoryKey: text("tCategoryKey"),
        itemType: text("itemType"),
        isOtherUnclassified: detail.isOtherUnclassified ?? false,
      };
    case "chart_group":
      return { groupCode: text("groupCode"), sortOrder: detail.sortOrder ?? 0 };
    case "task_route": {
      const routeCode = text("routeCode");
      const tuple = routeCode ? routeTuples[routeCode as keyof typeof routeTuples] : undefined;
      return {
        routeCode,
        destinationModule: tuple?.destinationModule ?? null,
        taskRequired: tuple?.taskRequired ?? null,
        runtimeStatus: tuple?.runtimeStatus ?? null,
      };
    }
    case "order":
      return {
        classificationPathKey: text("classificationPathKey"),
        defaultSalesUnitCode: text("defaultSalesUnitCode"),
        defaultBillingReflectionEnabled: detail.defaultBillingReflectionEnabled ?? true,
        defaultQuantity: detail.defaultQuantity ?? 1,
        species: Array.isArray(detail.species)
          ? detail.species.map((value) => (typeof value === "string" ? value.trim() : value)).sort()
          : [],
      };
    case "species":
      return { speciesCode: text("speciesCode") };
    case "unit":
      return {
        unitCode: text("unitCode"),
        symbol: text("symbol"),
        decimalScale: detail.decimalScale ?? 0,
      };
    case "specimen_type":
      return { specimenCode: text("specimenCode") };
    case "result_input_type":
      return {
        inputCode: text("inputCode"),
        valueKind: text("valueKind"),
        supportsUnit: detail.supportsUnit ?? false,
      };
    case "lab_test":
      return {
        testCode: text("testCode"),
        resultInputTypeKey: text("resultInputTypeKey"),
        canonicalUnitKey: text("canonicalUnitKey"),
        decimalScale: detail.decimalScale ?? null,
      };
    case "lab_panel":
      return { panelCode: text("panelCode") };
    case "diagnosis_category":
      return {
        categoryKind: text("categoryKind"),
        parentMasterKey: text("parentMasterKey"),
        sortOrder: detail.sortOrder ?? 0,
      };
    case "diagnosis":
      return {};
  }
}

function normalizeSource(source: Record<string, unknown>): ClinicalMasterAirtableSource {
  return {
    sourceType: "synthetic",
    title: String(source.title).trim(),
    referenceUri: trimNullable(source.referenceUri),
    sourceVersion: trimNullable(source.sourceVersion),
    accessedAt: trimNullable(source.accessedAt),
    licenseNotes: trimNullable(source.licenseNotes),
  };
}

function normalizeRecord(
  record: Record<string, unknown>,
  source: ClinicalMasterAirtableSource,
): ClinicalMasterAirtableRecord {
  const names = (Array.isArray(record.names) ? record.names : []).map((rawName) => {
    const name = (rawName ?? {}) as Record<string, unknown>;
    return {
      languageCode: String(name.languageCode).trim() as ClinicalMasterAirtableLanguage,
      nameKind: String(name.nameKind).trim() as ClinicalMasterAirtableNameKind,
      name: String(name.name).trim(),
      searchable: typeof name.searchable === "boolean" ? name.searchable : true,
      sortOrder: typeof name.sortOrder === "number" ? name.sortOrder : 0,
    };
  });
  names.sort(
    (left, right) =>
      compareStrings(left.languageCode, right.languageCode) ||
      compareStrings(left.nameKind, right.nameKind) ||
      compareStrings(normalizedName(left.name), normalizedName(right.name)) ||
      compareNumbers(left.sortOrder, right.sortOrder),
  );
  const recordType = String(record.recordType).trim() as ClinicalMasterAirtableRecordType;
  return {
    masterKey: String(record.masterKey).trim(),
    recordType,
    lifecycleStatus: "published",
    safetyStatus: "normal",
    safetyReason: trimNullable(record.safetyReason),
    changeSummary: String(record.changeSummary).trim(),
    sourceAssertionScope: String(record.sourceAssertionScope).trim(),
    sourceNotes: trimNullable(record.sourceNotes),
    names,
    source,
    detail: normalizeDetail(recordType, (record.detail ?? {}) as Record<string, unknown>),
  };
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized ?? "null";
}

export function validateClinicalMasterAirtableAuthoringExport(
  value: unknown,
): ClinicalMasterAirtableValidationIssue[] {
  const issues: ClinicalMasterAirtableValidationIssue[] = [];
  if (!isObject(value)) {
    return [{ path: "$", code: "envelope_object_required", message: "An authoring export object is required." }];
  }
  scanAuthorityFields(value, "$", issues);
  scanPricingFields(value, "$", issues);
  validateContractKeys("envelope", value, "$", issues);
  if (value.schemaVersion !== clinicalMasterAirtableAuthoringSchemaVersion) {
    addIssue(issues, "schemaVersion", "schema_version_invalid", `schemaVersion must be ${clinicalMasterAirtableAuthoringSchemaVersion}.`);
  }
  validateRelease(value.release, issues);
  const sourcesByKey = validateSources(value.sources, issues);
  const recordsByKey = validateRecords(value.records, sourcesByKey, issues);
  const pathIndex = validateClassificationPaths(value.classificationPaths, recordsByKey, issues);
  validateCrossRecordReferences(recordsByKey, pathIndex.pathKeys, issues);
  validateLabRelations(value.labPanelItems, value.labOrderProfiles, recordsByKey, pathIndex.routeCodesByPath, issues);
  validateDiagnosisRelations(value.diagnosisCategoryLinks, recordsByKey, issues);
  return sortIssues(issues);
}

export function normalizeClinicalMasterAirtableAuthoringExport(
  value: ClinicalMasterAirtableAuthoringExportInput,
): ClinicalMasterAirtableAuthoringExport {
  const issues = validateClinicalMasterAirtableAuthoringExport(value);
  if (issues.length > 0) throw new ClinicalMasterAirtableExportValidationError(issues);
  const envelope = value as unknown as Record<string, unknown>;
  const release = envelope.release as Record<string, unknown>;
  const rawSources = envelope.sources as Array<Record<string, unknown>>;
  const rawRecords = envelope.records as Array<Record<string, unknown>>;
  const normalizedSourcesByKey = new Map(
    rawSources.map((source) => [String(source.sourceKey).trim(), normalizeSource(source)]),
  );
  const normalizedPaths = (Array.isArray(envelope.classificationPaths) ? envelope.classificationPaths : []).map((rawPath) => {
    const path = rawPath as Record<string, unknown>;
    return {
      pathKey: String(path.pathKey).trim(),
      clinicalActionKey: String(path.clinicalActionKey).trim(),
      chartGroupKey: String(path.chartGroupKey).trim(),
      taskRouteKey: String(path.taskRouteKey).trim(),
    };
  });
  normalizedPaths.sort((left, right) => compareStrings(left.pathKey, right.pathKey));
  const normalizedPanelItems = (Array.isArray(envelope.labPanelItems) ? envelope.labPanelItems : []).map((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    return {
      panelMasterKey: String(item.panelMasterKey).trim(),
      testMasterKey: String(item.testMasterKey).trim(),
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
      required: typeof item.required === "boolean" ? item.required : true,
      displayGroup: trimNullable(item.displayGroup),
    };
  });
  normalizedPanelItems.sort(
    (left, right) =>
      compareStrings(left.panelMasterKey, right.panelMasterKey) ||
      compareNumbers(left.sortOrder, right.sortOrder) ||
      compareStrings(left.testMasterKey, right.testMasterKey),
  );
  const normalizedProfiles = (Array.isArray(envelope.labOrderProfiles) ? envelope.labOrderProfiles : []).map((rawProfile) => {
    const profile = rawProfile as Record<string, unknown>;
    return {
      orderMasterKey: String(profile.orderMasterKey).trim(),
      labTestMasterKey: trimNullable(profile.labTestMasterKey),
      labPanelMasterKey: trimNullable(profile.labPanelMasterKey),
      specimenMasterKey: trimNullable(profile.specimenMasterKey),
    };
  });
  normalizedProfiles.sort((left, right) => compareStrings(left.orderMasterKey, right.orderMasterKey));
  const normalizedLinks = (Array.isArray(envelope.diagnosisCategoryLinks) ? envelope.diagnosisCategoryLinks : []).map((rawLink) => {
    const link = rawLink as Record<string, unknown>;
    return {
      diagnosisMasterKey: String(link.diagnosisMasterKey).trim(),
      categoryMasterKey: String(link.categoryMasterKey).trim(),
      isPrimary: typeof link.isPrimary === "boolean" ? link.isPrimary : false,
      sortOrder: typeof link.sortOrder === "number" ? link.sortOrder : 0,
    };
  });
  normalizedLinks.sort(
    (left, right) =>
      compareStrings(left.diagnosisMasterKey, right.diagnosisMasterKey) ||
      compareNumbers(left.sortOrder, right.sortOrder) ||
      compareStrings(left.categoryMasterKey, right.categoryMasterKey),
  );
  const normalized = {
    schemaVersion: clinicalMasterAirtableAuthoringSchemaVersion,
    release: {
      releaseKey: String(release.releaseKey).trim(),
      releaseNotes: trimNullable(release.releaseNotes),
      publishedByLabel: String(release.publishedByLabel).trim(),
      authoredByLabel: String(release.authoredByLabel).trim(),
      reviewedByLabel: String(release.reviewedByLabel).trim(),
      clinicalReviewerLabel: trimNullable(release.clinicalReviewerLabel),
      reviewReason: String(release.reviewReason).trim(),
    },
    records: rawRecords
      .map((record) =>
        normalizeRecord(
          record,
          normalizedSourcesByKey.get(String(record.sourceKey).trim()) as ClinicalMasterAirtableSource,
        ),
      )
      .sort((left, right) => compareStrings(left.masterKey, right.masterKey)),
    classificationPaths: normalizedPaths,
    labPanelItems: normalizedPanelItems,
    labOrderProfiles: normalizedProfiles,
    diagnosisCategoryLinks: normalizedLinks,
  } satisfies ClinicalMasterAirtableAuthoringExport;
  return normalized;
}

/** Short alias for callers that already name the input an Airtable export. */
export const validateClinicalMasterAirtableExport = validateClinicalMasterAirtableAuthoringExport;
export const normalizeClinicalMasterAirtableExport = normalizeClinicalMasterAirtableAuthoringExport;

/** Test-only deterministic serialization aid; no fingerprint authority is created here. */
export function serializeClinicalMasterAirtableAuthoringExportForTest(
  value: ClinicalMasterAirtableAuthoringExportInput,
): string {
  return stableJson(normalizeClinicalMasterAirtableAuthoringExport(value));
}
