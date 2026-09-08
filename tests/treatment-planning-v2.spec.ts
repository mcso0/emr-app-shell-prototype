import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { CLINICAL_ORDER_FIELD_SCHEMAS, TREATMENT_FIELD_SCHEMA_V2, getClinicalOrderFieldSchema, resolveClinicalOrderMasterContract,
  validateClinicalOrderDetailInputs } from "../src/features/chart/order-execution-domain";

const plan = { procedureKind: "preparation", method: "합성 수술 준비 순서 확인", plannedProcedureCount: 1, procedureCountUnit: "session",
  frequency: "once", schedule: "수술 전 준비 시점", administrationPolicy: "not_applicable", stagedInstructions: "합성 체크리스트 확인",
  exceptions: "준비 불충분 시 수행 보류" };
const validate = (detailInputs: unknown, requireComplete = true) => validateClinicalOrderDetailInputs({ clinicalOrderType: "treatment", schemaVersion: 2, detailInputs, requireComplete });

test("treatment V2 allows non-administration work without fake dose; V1 stays immutable", () => {
  expect(validate(plan)).toMatchObject({ valid: true });
  expect(TREATMENT_FIELD_SCHEMA_V2.fields.some(f => f.key === "administeredAmount")).toBe(false);
  expect(CLINICAL_ORDER_FIELD_SCHEMAS.treatment.fields.find(f => f.key === "administeredAmount")?.required).toBe(true);
  expect(validate({ ...plan, administeredAmount: 1 })).toMatchObject({ valid: false });
});
test("planned amount requires a unit and direct administration requires explicit product/route", () => {
  expect(validate({ ...plan, plannedAmount: 1 })).toMatchObject({ valid: false, fieldErrors: { plannedAmountUnit: "amount_unit_pair_required" } });
  expect(validate({ ...plan, administrationPolicy: "direct_quantity", plannedAmount: 1, plannedAmountUnit: "mL" })).toMatchObject({ valid: false, fieldErrors: { productReference: "required", plannedRoute: "required" } });
  expect(validate({ ...plan, administrationPolicy: "direct_quantity", plannedAmount: 1, plannedAmountUnit: "mL", productReference: "Explicit synthetic product reference", plannedRoute: "IV" })).toMatchObject({ valid: true });
});
test("patient medication link is unresolved during authoring but required at confirm; measured value stays actual", () => {
  expect(validate({ ...plan, administrationPolicy: "separate_medication_order" }, false)).toMatchObject({ valid: true });
  expect(validate({ ...plan, administrationPolicy: "separate_medication_order" })).toMatchObject({ valid: false, fieldErrors: { linkedMedicationOrderId: "required" } });
  expect(validate({ ...plan, linkedMedicationOrderId: "outside" })).toMatchObject({ valid: false });
  expect(validate({ ...plan, procedureKind: "measurement" })).toMatchObject({ valid: false, fieldErrors: { measurementUnit: "required" } });
  expect(validate({ ...plan, procedureKind: "measurement", measurementUnit: "mmHg" })).toMatchObject({ valid: true });
  expect(validate({ ...plan, measuredValue: 10 })).toMatchObject({ valid: false, fieldErrors: { measuredValue: "unknown_field" } });
});
test("schema selection fails closed on unsupported/mismatched explicit versions", () => {
  expect(getClinicalOrderFieldSchema("treatment", 2)).toBe(TREATMENT_FIELD_SCHEMA_V2);
  expect(getClinicalOrderFieldSchema("treatment", 9)).toBeNull();
  expect(getClinicalOrderFieldSchema("dispensing", 2)).toBeNull();
  const input = { categoryGroup: "treatment" as const, clinicalOrderType: "treatment", detailSchemaVersion: 2 };
  expect(resolveClinicalOrderMasterContract(input).detailSchemaVersion).toBe(2);
  expect(() => resolveClinicalOrderMasterContract({ ...input, detailSchemaVersion: "2" })).toThrow("detail_schema_version_mismatch");
  expect(() => resolveClinicalOrderMasterContract({ ...input, detailFieldSchema: CLINICAL_ORDER_FIELD_SCHEMAS.treatment })).toThrow("detail_field_schema_mismatch");
});
test("database treatment schema literal is the exact canonical TS schema", () => {
  const sql = readFileSync("supabase/migrations/20260906103022_clinical_master_treatment_planning_v2.sql", "utf8");
  const literal = sql.match(/when p_version=2 and p_type='treatment' then '(.+)'::jsonb/);
  expect(literal).not.toBeNull();
  expect(JSON.parse(literal![1].replaceAll("''", "'"))).toEqual(TREATMENT_FIELD_SCHEMA_V2);
});

test("V3 confirms the plan before medication linkage without weakening V2 or dose validation", () => {
  const validateV3 = (detailInputs: unknown) => validateClinicalOrderDetailInputs({ clinicalOrderType: "treatment", schemaVersion: 3, detailInputs, requireComplete: true });
  const unlinked = { ...plan, administrationPolicy: "separate_medication_order" };
  expect(validateV3(unlinked)).toMatchObject({ valid: true });
  expect(validate(unlinked)).toMatchObject({ valid: false });
  expect(validateV3({ ...unlinked, linkedMedicationOrderId: "invalid" })).toMatchObject({ valid: false });
  expect(validateV3({ ...plan, administrationPolicy: "direct_quantity" })).toMatchObject({ valid: false });
  expect(getClinicalOrderFieldSchema("consultation", 3)).toBeNull();
  expect(resolveClinicalOrderMasterContract({ categoryGroup: "treatment", clinicalOrderType: "treatment", detailSchemaVersion: 3 }).detailSchemaVersion).toBe(3);
});
