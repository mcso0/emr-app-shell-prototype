import { expect, test } from "@playwright/test";
import {
  CLINICAL_ORDER_FIELD_SCHEMAS,
  CLINICAL_ORDER_TYPES,
  resolveClinicalOrderMasterContract,
  validateClinicalOrderDetailInputs,
  type ClinicalOrderFieldDefinition,
} from "@/features/chart/order-execution-domain";
import type { ClinicalOrderType } from "@/types/emr-domain";

test("all nine clinical types expose complete versioned field metadata", () => {
  expect(CLINICAL_ORDER_TYPES).toEqual([
    "consultation",
    "clinical_lab",
    "imaging",
    "external_lab",
    "dispensing",
    "treatment",
    "hospitalization",
    "system_exam",
    "other",
  ]);

  for (const type of CLINICAL_ORDER_TYPES) {
    const schema = CLINICAL_ORDER_FIELD_SCHEMAS[type];
    expect(schema.version).toBe(1);
    expect(schema.clinicalOrderType).toBe(type);
    expect(schema.fields.some((field) => field.placement === "inline")).toBe(
      true,
    );
    expect(schema.fields.some((field) => field.placement === "detail")).toBe(
      true,
    );
    expect(
      schema.fields.every((field) =>
        hasCompleteFieldDefinition(field, schema.version),
      ),
    ).toBe(true);
  }
});

test("legacy mapping never infers external lab from a display name", () => {
  const clinical = resolveClinicalOrderMasterContract({
    categoryGroup: "lab",
    defaultDestinationModule: "lab",
    defaultTaskRequired: true,
    billingReflectionEnabled: true,
  });
  const external = resolveClinicalOrderMasterContract({
    categoryGroup: "lab",
    isExternalLab: true,
    defaultDestinationModule: "lab",
    defaultTaskRequired: true,
    billingReflectionEnabled: true,
  });

  expect(clinical.clinicalOrderType).toBe("clinical_lab");
  expect(clinical.isExternalLab).toBe(false);
  expect(external.clinicalOrderType).toBe("external_lab");
  expect(external.isExternalLab).toBe(true);
  expect(external.destinationModule).toBe("lab");
});

test("legacy pseudo-destinations normalize to destinationless immediate tasks", () => {
  for (const pseudoDestination of ["billing_only", "chart_only"] as const) {
    const contract = resolveClinicalOrderMasterContract({
      categoryGroup: "consultation",
      defaultDestinationModule: pseudoDestination,
      defaultTaskRequired: false,
      billingReflectionEnabled: true,
    });

    expect(contract.destinationModule).toBeNull();
    expect(contract.executionMode).toBe("immediate_complete");
    expect(contract.billingEligible).toBe(true);
  }
});

test("every type validates its required inline values and rejects a stale schema", () => {
  for (const type of CLINICAL_ORDER_TYPES) {
    const schema = CLINICAL_ORDER_FIELD_SCHEMAS[type];
    const valid = validateClinicalOrderDetailInputs({
      clinicalOrderType: type,
      detailInputs: buildValidInputs(type),
      schemaVersion: schema.version,
    });
    const missing = validateClinicalOrderDetailInputs({
      clinicalOrderType: type,
      detailInputs: {},
      schemaVersion: schema.version,
    });
    const stale = validateClinicalOrderDetailInputs({
      clinicalOrderType: type,
      detailInputs: buildValidInputs(type),
      schemaVersion: 99,
    });

    expect(valid.valid).toBe(true);
    expect(missing.valid).toBe(false);
    expect(stale).toEqual({
      valid: false,
      fieldErrors: { _schema: "detail_schema_version_mismatch" },
    });
  }
});

test("draft detail validation accepts partial known fields and rejects unknown fields", () => {
  expect(
    validateClinicalOrderDetailInputs({
      clinicalOrderType: "clinical_lab",
      detailInputs: { specimenType: "serum" },
      requireComplete: false,
      schemaVersion: 1,
    }),
  ).toEqual({ valid: true, normalized: { specimenType: "serum" } });
  expect(
    validateClinicalOrderDetailInputs({
      clinicalOrderType: "clinical_lab",
      detailInputs: { inventedClientField: "unsafe" },
      requireComplete: false,
      schemaVersion: 1,
    }),
  ).toEqual({
    valid: false,
    fieldErrors: { inventedClientField: "unknown_field" },
  });
});

function hasCompleteFieldDefinition(
  field: ClinicalOrderFieldDefinition,
  schemaVersion: number,
) {
  return (
    field.key.length > 0 &&
    field.label.length > 0 &&
    field.displayOrder > 0 &&
    field.snapshotPath === `detailInputs.${field.key}` &&
    field.preConfirmEditable &&
    field.postConfirmBehavior === "amendment" &&
    schemaVersion === 1 &&
    Array.isArray(field.options) &&
    typeof field.validation === "object"
  );
}

function buildValidInputs(type: ClinicalOrderType) {
  return Object.fromEntries(
    CLINICAL_ORDER_FIELD_SCHEMAS[type].fields
      .filter((field) => field.required)
      .map((field) => [field.key, validValue(field)]),
  );
}

function validValue(field: ClinicalOrderFieldDefinition) {
  if (field.key === "wardOrCage") return "97070000-0000-4000-8000-000000000001";
  if (field.defaultValue !== null && field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  if (field.valueType === "boolean") return false;
  if (field.valueType === "number") return Math.max(field.validation.min ?? 0, 1);
  if (field.valueType === "string_array" || field.valueType === "attachment_array") {
    return ["fixture"];
  }
  return field.options[0] ?? "fixture";
}
