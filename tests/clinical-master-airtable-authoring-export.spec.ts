import { expect, test } from "@playwright/test";

import fixtureJson from "./fixtures/clinical-master-airtable-authoring-export.fixture.json";
import {
  clinicalMasterAirtableAuthoringSchemaVersion,
  clinicalMasterAirtablePhysicalTables,
  clinicalMasterAirtableRecordTypes,
  clinicalMasterAirtableViewTables,
  ClinicalMasterAirtableExportValidationError,
  normalizeClinicalMasterAirtableAuthoringExport,
  serializeClinicalMasterAirtableAuthoringExportForTest,
  validateClinicalMasterAirtableAuthoringExport,
} from "../src/features/clinical-master/server-clinical-master-airtable-export-core";
import { validateClinicalMasterPublishPayload } from "../src/features/clinical-master/server-clinical-master-publisher-core";

type ExportFixture = Record<string, unknown>;
type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

const fixture = fixtureJson as unknown as ExportFixture;

function cloneFixture(): ExportFixture {
  return JSON.parse(JSON.stringify(fixture)) as ExportFixture;
}

function issuesFor(value: unknown) {
  return validateClinicalMasterAirtableAuthoringExport(value);
}

function expectInvalid(value: unknown, expectedIssues: ValidationIssue[]) {
  expect(issuesFor(value)).toEqual(expectedIssues);

  let caught: unknown;
  try {
    normalizeClinicalMasterAirtableAuthoringExport(value as never);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ClinicalMasterAirtableExportValidationError);
  expect((caught as ClinicalMasterAirtableExportValidationError).issues).toEqual(
    expectedIssues,
  );
}

test("the contract has exactly eight physical Airtable tables and view-only helpers", () => {
  expect(clinicalMasterAirtablePhysicalTables).toEqual([
    "Release Drafts",
    "Sources",
    "Master Records",
    "Names",
    "Classification Paths",
    "Lab Panel Items",
    "Lab Order Profiles",
    "Diagnosis Category Links",
  ]);
  expect(clinicalMasterAirtablePhysicalTables).toHaveLength(8);
  expect(clinicalMasterAirtableViewTables).toEqual([
    "Code Dictionary",
    "Orders",
    "Vocabularies",
    "Diagnosis Systems",
    "Disease Groups",
    "Diagnoses",
    "Ready for Export",
  ]);
  expect(clinicalMasterAirtableRecordTypes).toHaveLength(13);
  expect(clinicalMasterAirtableRecordTypes).toEqual([
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
  ]);
});

test("the synthetic fixture normalizes all thirteen types, defaults, and null strings", () => {
  const normalized = normalizeClinicalMasterAirtableAuthoringExport(fixture as never);
  expect(normalized.schemaVersion).toBe(clinicalMasterAirtableAuthoringSchemaVersion);
  expect(new Set(normalized.records.map((record) => record.recordType))).toEqual(
    new Set(clinicalMasterAirtableRecordTypes),
  );
  expect(normalized.release.releaseNotes).toBe("구조 검증용 합성 authoring snapshot");
  expect(normalized.records[0].source.title).toBe("CLAiR contract fixture");
  expect(normalized.records[0].changeSummary).toBe("synthetic contract fixture row");
  expect(normalized.records[0].sourceAssertionScope).toBe("structural synthetic contract only");
  expect(normalized.records[0].sourceNotes).toBe("no external clinical source");
  expect("status" in normalized.release).toBe(false);
  expect("sources" in normalized).toBe(false);
  expect("sourceKey" in normalized.records[0]).toBe(false);
  expect("authoringStatus" in normalized.records[0]).toBe(false);
  expect(normalized.labPanelItems[0].displayGroup).toBe("chemistry");
  expect(normalized.records[0].names[0].searchable).toBe(true);
  expect(normalized.records.find((record) => record.recordType === "unit")?.detail).toMatchObject({
    decimalScale: 0,
  });
  expect(normalized.records.find((record) => record.recordType === "lab_test")?.detail).toMatchObject({
    decimalScale: 1,
  });
  expect(normalized.records.find((record) => record.recordType === "diagnosis")?.detail).toEqual({});
  expect(normalized.records.find((record) => record.recordType === "task_route")?.detail).toEqual({
    routeCode: "NT_LAB",
    destinationModule: "lab",
    taskRequired: true,
    runtimeStatus: "active",
  });
  expect(normalized.records).toEqual(
    [...normalized.records].sort((left, right) => left.masterKey.localeCompare(right.masterKey)),
  );
  expect(normalized.classificationPaths).toEqual([
    expect.objectContaining({ pathKey: "cm.path.metabolic" }),
  ]);
  expect(normalized.records.find((record) => record.recordType === "order")?.detail).toMatchObject({
    species: ["cat", "dog"],
    defaultBillingReflectionEnabled: true,
    defaultQuantity: 1,
  });
});

test("shuffled input has one canonical serialization", () => {
  const shuffled = cloneFixture();
  const records = shuffled.records as unknown[];
  shuffled.records = [...records].reverse();
  const sources = shuffled.sources as unknown[];
  shuffled.sources = [...sources].reverse();
  shuffled.classificationPaths = [...(shuffled.classificationPaths as unknown[])].reverse();
  shuffled.labPanelItems = [...(shuffled.labPanelItems as unknown[])].reverse();
  shuffled.labOrderProfiles = [...(shuffled.labOrderProfiles as unknown[])].reverse();
  shuffled.diagnosisCategoryLinks = [...(shuffled.diagnosisCategoryLinks as unknown[])].reverse();
  expect(serializeClinicalMasterAirtableAuthoringExportForTest(shuffled as never)).toBe(
    serializeClinicalMasterAirtableAuthoringExportForTest(fixture as never),
  );
});

test("authority fields reject Airtable IDs, formulas, lookups, generated identities, and unknown fields", () => {
  const unknownField = cloneFixture();
  (unknownField.records as ExportFixture[])[0].unexpectedAuthoringField = "x";
  expectInvalid(unknownField, [
    {
      path: "records[cm.order-category.x-lab].unexpectedAuthoringField",
      code: "record_field_unknown",
      message: "record field unexpectedAuthoringField is not part of the authoring export contract.",
    },
  ]);

  const airtableId = cloneFixture();
  (airtableId.records as ExportFixture[])[0].airtableRecordId = "rec123456789012";
  expectInvalid(airtableId, [
    {
      path: "$.records[cm.order-category.x-lab].airtableRecordId",
      code: "airtable_identity_forbidden",
      message: "Airtable record IDs cannot be export authority.",
    },
    {
      path: "records[cm.order-category.x-lab].airtableRecordId",
      code: "record_field_unknown",
      message: "record field airtableRecordId is not part of the authoring export contract.",
    },
  ]);

  const formula = cloneFixture();
  (formula.records as ExportFixture[])[0].formulaDisplay = "LOOKUP()";
  expectInvalid(formula, [
    {
      path: "$.records[cm.order-category.x-lab].formulaDisplay",
      code: "airtable_formula_forbidden",
      message: "Airtable formulas are display helpers, not export authority.",
    },
    {
      path: "records[cm.order-category.x-lab].formulaDisplay",
      code: "record_field_unknown",
      message: "record field formulaDisplay is not part of the authoring export contract.",
    },
  ]);

  const lookup = cloneFixture();
  (lookup.records as ExportFixture[])[0].lookupDisplayValue = "검사";
  expectInvalid(lookup, [
    {
      path: "$.records[cm.order-category.x-lab].lookupDisplayValue",
      code: "airtable_lookup_forbidden",
      message: "Airtable lookup display values are not export authority.",
    },
    {
      path: "records[cm.order-category.x-lab].lookupDisplayValue",
      code: "record_field_unknown",
      message: "record field lookupDisplayValue is not part of the authoring export contract.",
    },
  ]);

  const uuid = cloneFixture();
  (uuid.records as ExportFixture[])[0].masterKey = "00000000-0000-4000-8000-000000000001";
  expectInvalid(uuid, [
    {
      path: "records[0].masterKey",
      code: "stable_key_identity_forbidden",
      message: "A UUID or Airtable record identity cannot be an authoring/export key.",
    },
    {
      path: "records[cm.order-category.t-lab].detail.parentMasterKey",
      code: "order_category_parent_reference_missing",
      message: "Relation must reference a record in the same complete snapshot.",
    },
  ]);

  const generated = cloneFixture();
  (generated.release as ExportFixture).revision = 2;
  expectInvalid(generated, [
    {
      path: "$.release.revision",
      code: "generated_authority_forbidden",
      message: "Generated revisions, releases, timestamps, and fingerprints are server authority only.",
    },
    {
      path: "release.revision",
      code: "release_field_unknown",
      message: "release field revision is not part of the authoring export contract.",
    },
  ]);
});

test("release, source, lifecycle, safety, and name governance fail closed", () => {
  const unapproved = cloneFixture();
  (unapproved.release as ExportFixture).status = "in_review";
  expectInvalid(unapproved, [
    {
      path: "release.status",
      code: "release_not_approved",
      message: "Only an approved release can be exported.",
    },
  ]);

  const alias = cloneFixture();
  (alias.release as ExportFixture).approvalStatus = "approved";
  expectInvalid(alias, [
    {
      path: "release.approvalStatus",
      code: "release_field_unknown",
      message: "release field approvalStatus is not part of the authoring export contract.",
    },
  ]);

  const missingReviewReason = cloneFixture();
  delete (missingReviewReason.release as ExportFixture).reviewReason;
  expectInvalid(missingReviewReason, [
    {
      path: "release.reviewReason",
      code: "review_reason_required",
      message: "A non-empty value is required.",
    },
  ]);

  const nonSynthetic = cloneFixture();
  (nonSynthetic.sources as ExportFixture[])[0].sourceType = "external_reference";
  expectInvalid(nonSynthetic, [
    {
      path: "sources[source.synthetic.contract.v1].sourceType",
      code: "synthetic_source_required",
      message: "Only synthetic sources may be exported.",
    },
  ]);

  const missingSource = cloneFixture();
  (missingSource.records as ExportFixture[])[0].sourceKey = "source.missing";
  expectInvalid(missingSource, [
    {
      path: "records[cm.order-category.x-lab].sourceKey",
      code: "source_reference_missing",
      message: "Every record must reference one source in the same snapshot.",
    },
  ]);

  const lifecycle = cloneFixture();
  (lifecycle.records as ExportFixture[])[0].lifecycleStatus = "draft";
  expectInvalid(lifecycle, [
    {
      path: "records[cm.order-category.x-lab].lifecycleStatus",
      code: "published_lifecycle_required",
      message: "Only published records can be exported.",
    },
  ]);

  const authoringStatus = cloneFixture();
  (authoringStatus.records as ExportFixture[])[0].authoringStatus = "in_review";
  expectInvalid(authoringStatus, [
    {
      path: "records[cm.order-category.x-lab].authoringStatus",
      code: "authoring_not_approved",
      message: "Only records with authoringStatus approved can be exported.",
    },
  ]);

  const safety = cloneFixture();
  (safety.records as ExportFixture[])[0].safetyStatus = "blocked";
  expectInvalid(safety, [
    {
      path: "records[cm.order-category.x-lab].safetyStatus",
      code: "normal_safety_required",
      message: "Only normal-safety records can be exported.",
    },
  ]);

  const names = cloneFixture();
  const firstNames = (names.records as ExportFixture[])[0].names as ExportFixture[];
  firstNames.push({ languageCode: "ko", nameKind: "preferred", name: " 검사 " });
  expectInvalid(names, [
    {
      path: "records[cm.order-category.x-lab].names",
      code: "preferred_ko_exactly_one",
      message: "Exactly one preferred Korean name is required.",
    },
    {
      path: "records[cm.order-category.x-lab].names[ko|preferred|검사]",
      code: "normalized_name_duplicate",
      message: "Names cannot duplicate after whitespace/case normalization.",
    },
  ]);
});

test("classification paths, typed references, hierarchy, and order path rules are enforced", () => {
  const pathType = cloneFixture();
  (pathType.classificationPaths as ExportFixture[])[0].chartGroupKey = "cm.action.metabolic";
  expectInvalid(pathType, [
    {
      path: "classificationPaths[cm.path.metabolic].chartGroupKey",
      code: "chart_group_reference_type_invalid",
      message: "Relation must reference a chart_group record.",
    },
  ]);

  const heldRoute = cloneFixture();
  const route = (heldRoute.records as ExportFixture[]).find((record) => record.recordType === "task_route") as ExportFixture;
  (route.detail as ExportFixture).routeCode = "NT_INPATIENT";
  expectInvalid(heldRoute, [
    {
      path: "classificationPaths[cm.path.metabolic].taskRouteKey",
      code: "held_route_rejected",
      message: "A published classification path cannot use a held route.",
    },
  ]);

  const missingPath = cloneFixture();
  const order = (missingPath.records as ExportFixture[]).find((record) => record.recordType === "order") as ExportFixture;
  (order.detail as ExportFixture).classificationPathKey = "path.missing";
  expectInvalid(missingPath, [
    {
      path: "records[cm.order.metabolic].detail.classificationPathKey",
      code: "order_path_reference_invalid",
      message: "An order must reference a path in the same snapshot.",
    },
  ]);

  const badDiagnosisParent = cloneFixture();
  const group = (badDiagnosisParent.records as ExportFixture[]).find((record) => record.masterKey === "cm.diagnosis-category.metabolic") as ExportFixture;
  (group.detail as ExportFixture).parentMasterKey = "cm.diagnosis-category.metabolic";
  expectInvalid(badDiagnosisParent, [
    {
      path: "records[cm.diagnosis-category.metabolic].detail.parentMasterKey",
      code: "diagnosis_parent_must_be_system",
      message: "A disease group must reference a system category.",
    },
  ]);

  const badDiagnosisDetail = cloneFixture();
  const diagnosisRecord = (badDiagnosisDetail.records as ExportFixture[]).find((record) => record.recordType === "diagnosis") as ExportFixture;
  (diagnosisRecord.detail as ExportFixture).diagnosisSystemKey = "cm.diagnosis-category.system";
  expectInvalid(badDiagnosisDetail, [
    {
      path: "records[cm.diagnosis.synthetic].detail.diagnosisSystemKey",
      code: "detail_field_unknown",
      message: "Unknown typed detail field.",
    },
  ]);
});

test("lab panel and order profile relations require complete, typed snapshots", () => {
  const badPanelItem = cloneFixture();
  (badPanelItem.labPanelItems as ExportFixture[])[0].testMasterKey = "cm.unit.ml";
  expectInvalid(badPanelItem, [
    {
      path: "labPanelItems[cm.panel.metabolic|cm.unit.ml].testMasterKey",
      code: "lab_test_reference_type_invalid",
      message: "Relation must reference a lab_test record.",
    },
  ]);

  const badProfile = cloneFixture();
  const profile = (badProfile.labOrderProfiles as ExportFixture[])[0];
  profile.labPanelMasterKey = null;
  profile.labTestMasterKey = null;
  expectInvalid(badProfile, [
    {
      path: "labOrderProfiles[cm.order.metabolic]",
      code: "lab_order_profile_target_exactly_one",
      message: "A profile must target exactly one lab test or panel.",
    },
  ]);

  const missingPanelItem = cloneFixture();
  missingPanelItem.labPanelItems = [];
  expectInvalid(missingPanelItem, [
    {
      path: "records[cm.panel.metabolic]",
      code: "lab_panel_items_required",
      message: "Every lab panel needs its complete item snapshot.",
    },
  ]);

  const badTestDefinition = cloneFixture();
  const labTest = (badTestDefinition.records as ExportFixture[]).find((record) => record.recordType === "lab_test") as ExportFixture;
  (labTest.detail as ExportFixture).resultInputTypeKey = "cm.missing.input";
  expectInvalid(badTestDefinition, [
    {
      path: "records[cm.test.glucose].detail.resultInputTypeKey",
      code: "lab_test_input_reference_missing",
      message: "Relation must reference a record in the same complete snapshot.",
    },
  ]);

  const missingProfile = cloneFixture();
  missingProfile.labOrderProfiles = [];
  expectInvalid(missingProfile, [
    {
      path: "records[cm.order.metabolic]",
      code: "lab_order_profile_exactly_one",
      message: "Every laboratory order must have exactly one laboratory profile.",
    },
  ]);
});

test("diagnosis hierarchy and link completeness require disease-group targets and one primary", () => {
  const systemTarget = cloneFixture();
  (systemTarget.diagnosisCategoryLinks as ExportFixture[])[0].categoryMasterKey = "cm.diagnosis-category.system";
  expectInvalid(systemTarget, [
    {
      path: "diagnosisCategoryLinks[cm.diagnosis.synthetic|cm.diagnosis-category.system].categoryMasterKey",
      code: "diagnosis_link_target_must_be_disease_group",
      message: "Diagnosis links must target disease groups, never system roots.",
    },
  ]);

  const noPrimary = cloneFixture();
  (noPrimary.diagnosisCategoryLinks as ExportFixture[])[0].isPrimary = false;
  expectInvalid(noPrimary, [
    {
      path: "records[cm.diagnosis.synthetic]",
      code: "diagnosis_primary_exactly_one",
      message: "Every diagnosis needs exactly one primary category link.",
    },
  ]);

  const noLinks = cloneFixture();
  noLinks.diagnosisCategoryLinks = [];
  expectInvalid(noLinks, [
    {
      path: "records[cm.diagnosis.synthetic]",
      code: "diagnosis_link_required",
      message: "Every diagnosis needs at least one category link.",
    },
    {
      path: "records[cm.diagnosis.synthetic]",
      code: "diagnosis_primary_exactly_one",
      message: "Every diagnosis needs exactly one primary category link.",
    },
  ]);

  const duplicatePrimary = cloneFixture();
  const diagnosis = (duplicatePrimary.records as ExportFixture[]).find((record) => record.recordType === "diagnosis") as ExportFixture;
  const category = (duplicatePrimary.records as ExportFixture[]).find((record) => record.masterKey === "cm.diagnosis-category.system") as ExportFixture;
  (duplicatePrimary.diagnosisCategoryLinks as ExportFixture[]).push({
    diagnosisMasterKey: diagnosis.masterKey,
    categoryMasterKey: category.masterKey,
    isPrimary: true,
    sortOrder: 1,
  });
  expectInvalid(duplicatePrimary, [
    {
      path: "diagnosisCategoryLinks[cm.diagnosis.synthetic|cm.diagnosis-category.system].categoryMasterKey",
      code: "diagnosis_link_target_must_be_disease_group",
      message: "Diagnosis links must target disease groups, never system roots.",
    },
    {
      path: "records[cm.diagnosis.synthetic]",
      code: "diagnosis_primary_exactly_one",
      message: "Every diagnosis needs exactly one primary category link.",
    },
  ]);
});

test("price and weight-tier concepts remain workspace-owned", () => {
  const canonicalPrice = cloneFixture();
  (canonicalPrice.records as ExportFixture[])[0].detail = { canonicalPrice: 1000 };
  expectInvalid(canonicalPrice, [
    {
      path: "$.records[cm.order-category.x-lab].detail.canonicalPrice",
      code: "canonical_price_forbidden",
      message: "Canonical price is workspace-owned and is not part of this export contract.",
    },
    {
      path: "records[cm.order-category.t-lab].detail.parentMasterKey",
      code: "t_parent_type_invalid",
      message: "A T category must reference an X category.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.canonicalPrice",
      code: "detail_field_unknown",
      message: "Unknown typed detail field.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryCode",
      code: "detail_required",
      message: "A non-empty value is required.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryLevel",
      code: "category_level_invalid",
      message: "Category level must be X or T.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryLevel",
      code: "detail_required",
      message: "A non-empty value is required.",
    },
  ]);

  const priceRange = cloneFixture();
  (priceRange.records as ExportFixture[])[0].detail = { weightBracketPriceRange: { lower: 0, upper: 10 } };
  expectInvalid(priceRange, [
    {
      path: "$.records[cm.order-category.x-lab].detail.weightBracketPriceRange",
      code: "workspace_order_set_pricing_forbidden",
      message: "Order Set price ranges and weight brackets remain workspace-owned.",
    },
    {
      path: "records[cm.order-category.t-lab].detail.parentMasterKey",
      code: "t_parent_type_invalid",
      message: "A T category must reference an X category.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryCode",
      code: "detail_required",
      message: "A non-empty value is required.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryLevel",
      code: "category_level_invalid",
      message: "Category level must be X or T.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryLevel",
      code: "detail_required",
      message: "A non-empty value is required.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.weightBracketPriceRange",
      code: "detail_field_unknown",
      message: "Unknown typed detail field.",
    },
  ]);
});

test("validation errors are deterministic and carried in sorted form", () => {
  const invalid = cloneFixture();
  (invalid.release as ExportFixture).revision = 2;
  (invalid.records as ExportFixture[])[0].detail = { canonicalPrice: 1000 };

  const expectedIssues: ValidationIssue[] = [
    {
      path: "$.records[cm.order-category.x-lab].detail.canonicalPrice",
      code: "canonical_price_forbidden",
      message: "Canonical price is workspace-owned and is not part of this export contract.",
    },
    {
      path: "$.release.revision",
      code: "generated_authority_forbidden",
      message: "Generated revisions, releases, timestamps, and fingerprints are server authority only.",
    },
    {
      path: "records[cm.order-category.t-lab].detail.parentMasterKey",
      code: "t_parent_type_invalid",
      message: "A T category must reference an X category.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.canonicalPrice",
      code: "detail_field_unknown",
      message: "Unknown typed detail field.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryCode",
      code: "detail_required",
      message: "A non-empty value is required.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryLevel",
      code: "category_level_invalid",
      message: "Category level must be X or T.",
    },
    {
      path: "records[cm.order-category.x-lab].detail.categoryLevel",
      code: "detail_required",
      message: "A non-empty value is required.",
    },
    {
      path: "release.revision",
      code: "release_field_unknown",
      message: "release field revision is not part of the authoring export contract.",
    },
  ];
  expectInvalid(invalid, expectedIssues);

  const shuffled = cloneFixture();
  (shuffled.records as unknown[]).reverse();
  (shuffled.sources as unknown[]).reverse();
  (shuffled.classificationPaths as unknown[]).reverse();
  (shuffled.labPanelItems as unknown[]).reverse();
  (shuffled.labOrderProfiles as unknown[]).reverse();
  (shuffled.diagnosisCategoryLinks as unknown[]).reverse();
  (shuffled.release as ExportFixture).revision = 2;
  (shuffled.records as ExportFixture[]).find((record) => record.masterKey === "cm.order-category.x-lab")!.detail = {
    canonicalPrice: 1000,
  };
  expect(issuesFor(shuffled)).toEqual(expectedIssues);

  const exactReference = cloneFixture();
  const testRecord = (exactReference.records as ExportFixture[]).find((record) => record.masterKey === "cm.test.glucose") as ExportFixture;
  (testRecord.detail as ExportFixture).resultInputTypeKey = "cm.missing.input";
  expectInvalid(exactReference, [
    {
      path: "records[cm.test.glucose].detail.resultInputTypeKey",
      code: "lab_test_input_reference_missing",
      message: "Relation must reference a record in the same complete snapshot.",
    },
  ]);
});

test("the normalized authoring envelope remains separate from the current publisher", () => {
  const normalized = normalizeClinicalMasterAirtableAuthoringExport(fixture as never);
  const envelopeIssues = validateClinicalMasterPublishPayload(normalized as never);
  const expectedEnvelopeIssues: ValidationIssue[] = [
    {
      path: "$.schemaVersion",
      code: "payload_field_unknown",
      message: "payload field schemaVersion is not part of the Phase 1A-1 contract.",
    },
    {
      path: "$.release",
      code: "payload_field_unknown",
      message: "payload field release is not part of the Phase 1A-1 contract.",
    },
    {
      path: "$.diagnosisCategoryLinks",
      code: "payload_field_unknown",
      message: "payload field diagnosisCategoryLinks is not part of the Phase 1A-1 contract.",
    },
    {
      path: "publishedByLabel",
      code: "required",
      message: "A non-empty value is required.",
    },
    ...normalized.records.flatMap((record, index): ValidationIssue[] => [
      {
        path: `records[${index}].changeSummary`,
        code: "record_field_unknown",
        message: "record field changeSummary is not part of the Phase 1A-1 contract.",
      },
      {
        path: `records[${index}].sourceAssertionScope`,
        code: "record_field_unknown",
        message: "record field sourceAssertionScope is not part of the Phase 1A-1 contract.",
      },
      {
        path: `records[${index}].sourceNotes`,
        code: "record_field_unknown",
        message: "record field sourceNotes is not part of the Phase 1A-1 contract.",
      },
      ...(record.recordType === "diagnosis_category" || record.recordType === "diagnosis"
        ? [
            {
              path: `records[${index}].recordType`,
              code: "record_type_invalid",
              message: "This record type is outside Phase 1A-1.",
            },
          ]
        : []),
    ]),
  ];
  expect(envelopeIssues).toEqual(expectedEnvelopeIssues);

  const diagnosisRecords = normalized.records.filter(
    (record) => record.recordType === "diagnosis_category" || record.recordType === "diagnosis",
  );
  expect(diagnosisRecords).toHaveLength(3);
  const publisherDiagnosisRecords = diagnosisRecords.map((record) => ({
    masterKey: record.masterKey,
    recordType: record.recordType,
    lifecycleStatus: record.lifecycleStatus,
    safetyStatus: record.safetyStatus,
    safetyReason: record.safetyReason,
    names: record.names,
    source: record.source,
    detail: record.detail,
  }));
  const diagnosisIssues = validateClinicalMasterPublishPayload({
    releaseKey: normalized.release.releaseKey,
    releaseNotes: normalized.release.releaseNotes,
    publishedByLabel: normalized.release.publishedByLabel,
    records: publisherDiagnosisRecords,
    classificationPaths: [],
    labPanelItems: [],
    labOrderProfiles: [],
  } as never);
  expect(diagnosisIssues).toEqual([
    {
      path: "records[0].recordType",
      code: "record_type_invalid",
      message: "This record type is outside Phase 1A-1.",
    },
    {
      path: "records[1].recordType",
      code: "record_type_invalid",
      message: "This record type is outside Phase 1A-1.",
    },
    {
      path: "records[2].recordType",
      code: "record_type_invalid",
      message: "This record type is outside Phase 1A-1.",
    },
  ]);
});
