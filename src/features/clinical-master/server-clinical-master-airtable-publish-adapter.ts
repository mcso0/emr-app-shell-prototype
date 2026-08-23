// Local-only bridge from the reviewed Airtable authoring snapshot to the
// existing Clinical Master publisher payload. Airtable connectivity and DB
// writes intentionally remain outside this module.

import {
  normalizeClinicalMasterAirtableAuthoringExport,
  type ClinicalMasterAirtableAuthoringExport,
  type ClinicalMasterAirtableAuthoringExportInput,
  type ClinicalMasterAirtableRecord,
// @ts-expect-error -- explicit extension also supports the Node strip-types CLI.
} from "./server-clinical-master-airtable-export-core.ts";
import {
  clinicalMasterRecordTypes,
  normalizeClinicalMasterPublishPayload,
  validateClinicalMasterPublishPayload,
  type ClinicalMasterPublishPayload,
  type ClinicalMasterRecordInput,
  type ClinicalMasterValidationIssue,
// @ts-expect-error -- explicit extension also supports the Node strip-types CLI.
} from "./server-clinical-master-publisher-core.ts";

export type ClinicalMasterAirtablePublishAdapterIssue = ClinicalMasterValidationIssue;

export class ClinicalMasterAirtablePublishAdapterError extends Error {
  readonly issues: ClinicalMasterAirtablePublishAdapterIssue[];

  constructor(issues: ClinicalMasterAirtablePublishAdapterIssue[]) {
    super("Clinical master Airtable snapshot cannot be adapted for publishing.");
    this.name = "ClinicalMasterAirtablePublishAdapterError";
    this.issues = sortIssues(issues);
  }
}

export type ClinicalMasterAirtablePublishAdapterExclusions = {
  recordCount: number;
  recordKeys: string[];
  diagnosisCategoryCount: number;
  diagnosisCategoryKeys: string[];
  diagnosisCount: number;
  diagnosisKeys: string[];
  diagnosisCategoryLinkCount: number;
  diagnosisCategoryLinkKeys: string[];
};

export type ClinicalMasterAirtablePublishAdapterResult = {
  payload: ClinicalMasterPublishPayload;
  excluded: ClinicalMasterAirtablePublishAdapterExclusions;
};

const supportedRecordTypeSet = new Set<string>(clinicalMasterRecordTypes);
const authoringRecordTypes = new Set([
  ...clinicalMasterRecordTypes,
  "diagnosis_category",
  "diagnosis",
]);
const normalizedEnvelopeKeys = new Set([
  "schemaVersion",
  "release",
  "records",
  "classificationPaths",
  "labPanelItems",
  "labOrderProfiles",
  "diagnosisCategoryLinks",
]);
const normalizedRecordKeys = new Set([
  "masterKey",
  "recordType",
  "lifecycleStatus",
  "safetyStatus",
  "safetyReason",
  "changeSummary",
  "sourceAssertionScope",
  "sourceNotes",
  "names",
  "source",
  "detail",
]);
const normalizedSourceKeys = new Set([
  "sourceType",
  "title",
  "referenceUri",
  "sourceVersion",
  "accessedAt",
  "licenseNotes",
]);
const forbiddenAuthorityKeyPattern = /(?:airtable|formula|lookup|fingerprint|hash|revision|release(?:no|number)(?![a-z])|created|updated|timestamp|rowid|recordid|\bid\b)/iu;
const forbiddenPricingKeyPattern = /(?:price|pricing|weight(?:tier|range|bracket)?|orderset|order[_-]?set|set(?:price|pricing|range|tier|bracket))/iu;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sortIssues(issues: ClinicalMasterAirtablePublishAdapterIssue[]) {
  return [...issues].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}

function addIssue(
  issues: ClinicalMasterAirtablePublishAdapterIssue[],
  path: string,
  code: string,
  message: string,
) {
  issues.push({ path, code, message });
}

function scanForbiddenFields(
  value: unknown,
  path: string,
  issues: ClinicalMasterAirtablePublishAdapterIssue[],
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenFields(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isObject(value)) return;
  Object.entries(value).forEach(([key, child]) => {
    if (forbiddenAuthorityKeyPattern.test(key)) {
      addIssue(issues, `${path}.${key}`, "authoring_authority_field_forbidden", "A generated or Airtable authority field cannot reach the publisher.");
    }
    if (forbiddenPricingKeyPattern.test(key)) {
      addIssue(issues, `${path}.${key}`, "workspace_pricing_field_forbidden", "Canonical price, weight-tier, or Order Set pricing cannot reach the clinical master publisher.");
    }
    scanForbiddenFields(child, `${path}.${key}`, issues);
  });
}

function checkObjectKeys(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
  code: string,
  issues: ClinicalMasterAirtablePublishAdapterIssue[],
) {
  if (!isObject(value)) {
    addIssue(issues, path, `${code}_object_required`, "An object is required.");
    return;
  }
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) addIssue(issues, `${path}.${key}`, `${code}_field_unknown`, `Field ${key} is not part of the normalized Airtable snapshot.`);
  });
}

function isNormalizedAuthoringExport(value: unknown): value is ClinicalMasterAirtableAuthoringExport {
  if (!isObject(value) || "sources" in value) return false;
  if (!Array.isArray(value.records)) return false;
  return value.records.every((record) => isObject(record) && isObject(record.source));
}

function linkKey(diagnosisMasterKey: string, categoryMasterKey: string) {
  return `${diagnosisMasterKey}|${categoryMasterKey}`;
}

function makeExclusions(
  records: ClinicalMasterAirtableRecord[],
  diagnosisCategoryLinks: ClinicalMasterAirtableAuthoringExport["diagnosisCategoryLinks"],
): ClinicalMasterAirtablePublishAdapterExclusions {
  const diagnosisCategoryKeys = records
    .filter((record) => record.recordType === "diagnosis_category")
    .map((record) => record.masterKey)
    .sort();
  const diagnosisKeys = records
    .filter((record) => record.recordType === "diagnosis")
    .map((record) => record.masterKey)
    .sort();
  const diagnosisCategoryLinkKeys = diagnosisCategoryLinks
    .map((link) => linkKey(link.diagnosisMasterKey, link.categoryMasterKey))
    .sort();
  return {
    recordCount: diagnosisCategoryKeys.length + diagnosisKeys.length,
    recordKeys: [...diagnosisCategoryKeys, ...diagnosisKeys].sort(),
    diagnosisCategoryCount: diagnosisCategoryKeys.length,
    diagnosisCategoryKeys,
    diagnosisCount: diagnosisKeys.length,
    diagnosisKeys,
    diagnosisCategoryLinkCount: diagnosisCategoryLinkKeys.length,
    diagnosisCategoryLinkKeys,
  };
}

function validateNormalizedAuthoringSnapshot(
  snapshot: ClinicalMasterAirtableAuthoringExport,
): ClinicalMasterAirtablePublishAdapterIssue[] {
  const issues: ClinicalMasterAirtablePublishAdapterIssue[] = [];
  checkObjectKeys(snapshot, normalizedEnvelopeKeys, "$", "authoring_snapshot", issues);
  if (snapshot.schemaVersion !== "clinical-master-airtable-authoring/v1") {
    addIssue(issues, "schemaVersion", "schema_version_invalid", "The normalized snapshot must use clinical-master-airtable-authoring/v1.");
  }
  if (!isObject(snapshot.release)) {
    addIssue(issues, "release", "release_object_required", "A normalized release object is required.");
  } else {
    for (const key of ["releaseKey", "publishedByLabel", "authoredByLabel", "reviewedByLabel", "reviewReason"]) {
      if (typeof snapshot.release[key as keyof typeof snapshot.release] !== "string" || !String(snapshot.release[key as keyof typeof snapshot.release]).trim()) {
        addIssue(issues, `release.${key}`, "release_gate_required", "The approved release gate must retain this non-empty value.");
      }
    }
  }
  if (!Array.isArray(snapshot.records) || snapshot.records.length === 0) {
    addIssue(issues, "records", "records_required", "At least one normalized master record is required.");
    return issues;
  }

  const recordsByKey = new Map<string, ClinicalMasterAirtableRecord>();
  snapshot.records.forEach((record, index) => {
    const path = `records[${record.masterKey || index}]`;
    checkObjectKeys(record, normalizedRecordKeys, path, "normalized_record", issues);
    if (!authoringRecordTypes.has(record.recordType)) {
      addIssue(issues, `${path}.recordType`, "record_type_unsupported", "The Airtable authoring record type is outside the reviewed 13-type contract.");
    }
    if (recordsByKey.has(record.masterKey)) addIssue(issues, `${path}.masterKey`, "master_key_duplicate", "Master keys must be unique in one snapshot.");
    recordsByKey.set(record.masterKey, record);
    if (record.lifecycleStatus !== "published") addIssue(issues, `${path}.lifecycleStatus`, "lifecycle_status_invalid", "Only published records may be adapted.");
    if (record.safetyStatus !== "normal") addIssue(issues, `${path}.safetyStatus`, "safety_status_invalid", "Only normal records may be adapted.");
    if (!record.changeSummary.trim()) addIssue(issues, `${path}.changeSummary`, "change_summary_required", "A change summary is required by the authoring gate.");
    if (!record.sourceAssertionScope.trim()) addIssue(issues, `${path}.sourceAssertionScope`, "source_assertion_scope_required", "A source assertion scope is required by the authoring gate.");
    checkObjectKeys(record.source, normalizedSourceKeys, `${path}.source`, "normalized_source", issues);
    if (record.source.sourceType !== "synthetic") addIssue(issues, `${path}.source.sourceType`, "synthetic_source_required", "Only synthetic provenance may reach this publisher adapter.");
  });

  const supportedKeys = new Set(
    snapshot.records.filter((record) => supportedRecordTypeSet.has(record.recordType)).map((record) => record.masterKey),
  );
  const checkSupportedReference = (value: string, path: string) => {
    const target = recordsByKey.get(value);
    if (!target || !supportedKeys.has(value)) addIssue(issues, path, "unsupported_relation_leak", "A publisher relation cannot reference an authoring-only or missing record.");
    return target;
  };

  if (!Array.isArray(snapshot.classificationPaths)) addIssue(issues, "classificationPaths", "classification_paths_array", "Classification paths must be an array.");
  else snapshot.classificationPaths.forEach((path) => {
    checkSupportedReference(path.clinicalActionKey, `classificationPaths[${path.pathKey}].clinicalActionKey`);
    checkSupportedReference(path.chartGroupKey, `classificationPaths[${path.pathKey}].chartGroupKey`);
    checkSupportedReference(path.taskRouteKey, `classificationPaths[${path.pathKey}].taskRouteKey`);
  });
  if (!Array.isArray(snapshot.labPanelItems)) addIssue(issues, "labPanelItems", "lab_panel_items_array", "Lab panel items must be an array.");
  else snapshot.labPanelItems.forEach((item) => {
    checkSupportedReference(item.panelMasterKey, `labPanelItems[${item.panelMasterKey}|${item.testMasterKey}].panelMasterKey`);
    checkSupportedReference(item.testMasterKey, `labPanelItems[${item.panelMasterKey}|${item.testMasterKey}].testMasterKey`);
  });
  if (!Array.isArray(snapshot.labOrderProfiles)) addIssue(issues, "labOrderProfiles", "lab_order_profiles_array", "Lab order profiles must be an array.");
  else snapshot.labOrderProfiles.forEach((profile) => {
    checkSupportedReference(profile.orderMasterKey, `labOrderProfiles[${profile.orderMasterKey}].orderMasterKey`);
    if (profile.labTestMasterKey) checkSupportedReference(profile.labTestMasterKey, `labOrderProfiles[${profile.orderMasterKey}].labTestMasterKey`);
    if (profile.labPanelMasterKey) checkSupportedReference(profile.labPanelMasterKey, `labOrderProfiles[${profile.orderMasterKey}].labPanelMasterKey`);
    if (profile.specimenMasterKey) checkSupportedReference(profile.specimenMasterKey, `labOrderProfiles[${profile.orderMasterKey}].specimenMasterKey`);
  });
  if (!Array.isArray(snapshot.diagnosisCategoryLinks)) addIssue(issues, "diagnosisCategoryLinks", "diagnosis_category_links_array", "Diagnosis category links must be an array.");
  else snapshot.diagnosisCategoryLinks.forEach((link) => {
    const diagnosis = recordsByKey.get(link.diagnosisMasterKey);
    const category = recordsByKey.get(link.categoryMasterKey);
    if (diagnosis?.recordType !== "diagnosis" || category?.recordType !== "diagnosis_category") {
      addIssue(issues, `diagnosisCategoryLinks[${linkKey(link.diagnosisMasterKey, link.categoryMasterKey)}]`, "unsupported_relation_leak", "Only diagnosis-to-diagnosis-category authoring links may be excluded.");
    }
  });

  scanForbiddenFields(snapshot, "$", issues);
  return issues;
}

function toPublisherRecord(record: ClinicalMasterAirtableRecord): ClinicalMasterRecordInput {
  return {
    masterKey: record.masterKey,
    recordType: record.recordType as ClinicalMasterRecordInput["recordType"],
    lifecycleStatus: "published",
    safetyStatus: "normal",
    safetyReason: record.safetyReason,
    names: record.names.map((name) => ({
      languageCode: name.languageCode,
      nameKind: name.nameKind,
      name: name.name,
      searchable: name.searchable,
      sortOrder: name.sortOrder,
    })),
    source: {
      sourceType: record.source.sourceType,
      title: record.source.title,
      referenceUri: record.source.referenceUri,
      sourceVersion: record.source.sourceVersion,
      accessedAt: record.source.accessedAt,
      licenseNotes: record.source.licenseNotes,
    },
    detail: record.detail,
  };
}

function omitNullableLabTestDecimalScale(payload: ClinicalMasterPublishPayload): ClinicalMasterPublishPayload {
  return {
    ...payload,
    records: payload.records.map((record) => {
      if (record.recordType !== "lab_test" || record.detail.decimalScale !== null) return record;
      const detail = Object.fromEntries(
        Object.entries(record.detail).filter(([key]) => key !== "decimalScale"),
      );
      return { ...record, detail };
    }),
  };
}

export function adaptNormalizedClinicalMasterAirtableAuthoringExport(
  snapshot: ClinicalMasterAirtableAuthoringExport,
): ClinicalMasterAirtablePublishAdapterResult {
  const issues = validateNormalizedAuthoringSnapshot(snapshot);
  if (issues.length > 0) throw new ClinicalMasterAirtablePublishAdapterError(issues);

  const supportedRecords = snapshot.records.filter((record) => supportedRecordTypeSet.has(record.recordType));
  const payload = omitNullableLabTestDecimalScale({
    releaseKey: snapshot.release.releaseKey,
    releaseNotes: snapshot.release.releaseNotes,
    publishedByLabel: snapshot.release.publishedByLabel,
    records: supportedRecords.map(toPublisherRecord),
    classificationPaths: snapshot.classificationPaths,
    labPanelItems: snapshot.labPanelItems,
    labOrderProfiles: snapshot.labOrderProfiles,
  });
  const publisherIssues = validateClinicalMasterPublishPayload(payload);
  if (publisherIssues.length > 0) throw new ClinicalMasterAirtablePublishAdapterError(publisherIssues);

  return {
    payload: omitNullableLabTestDecimalScale(normalizeClinicalMasterPublishPayload(payload)),
    excluded: makeExclusions(snapshot.records, snapshot.diagnosisCategoryLinks),
  };
}

export function adaptClinicalMasterAirtableAuthoringExport(
  input: ClinicalMasterAirtableAuthoringExportInput | ClinicalMasterAirtableAuthoringExport,
): ClinicalMasterAirtablePublishAdapterResult {
  const snapshot = isNormalizedAuthoringExport(input)
    ? input
    : normalizeClinicalMasterAirtableAuthoringExport(input as ClinicalMasterAirtableAuthoringExportInput);
  return adaptNormalizedClinicalMasterAirtableAuthoringExport(snapshot);
}
