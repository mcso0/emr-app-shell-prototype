import { getClinicalOrderFieldSchema } from "@/features/chart/order-execution-domain";
import type { ClinicalOrderType } from "@/types/emr-domain";
import type { HospitalOrderDraft } from "./data";
import { readPersistedOrderDefaults } from "./persisted-order-defaults";

// Product presentation contract, not clinical defaults. Missing keys stay visible.
export const HOSPITAL_ORDER_CORE_FIELD_KEYS: Record<
  ClinicalOrderType,
  readonly string[]
> = {
  consultation: ["occurrenceCount", "timing", "instructionSummary"],
  clinical_lab: ["specimenType", "testPanel", "collectionCondition"],
  imaging: [
    "bodyRegion",
    "position",
    "viewCount",
    "contrastRequired",
    "sedationRequired",
  ],
  external_lab: ["providerId", "specimenType", "testItem", "shippingCondition"],
  dispensing: [
    "doseBasis",
    "dose",
    "doseUnit",
    "route",
    "frequency",
    "durationDays",
    "totalQuantity",
    "totalQuantityUnit",
  ],
  treatment: ["method", "site", "administeredAmount", "frequency", "schedule"],
  hospitalization: ["durationDays", "careLevel", "monitoringInterval"],
  system_exam: ["bodySystem", "examScope", "examMethod"],
  other: ["structuredValue"],
};

export function getHospitalOrderCoreDetails(order: HospitalOrderDraft) {
  const type = order.clinicalOrderType;
  if (!type || !Object.hasOwn(HOSPITAL_ORDER_CORE_FIELD_KEYS, type)) return [];
  const values =
    readPersistedOrderDefaults({
      defaultDetailInputs: order.defaultDetailInputs,
      defaultDetailInputsSource: order.defaultDetailInputsSource,
    }).values ?? {};
  const schema = getClinicalOrderFieldSchema(type, order.detailSchemaVersion ?? 1);
  if (!schema) return [];
  const keys = type === "treatment" && schema.version === 2
    ? ["method", "site", "plannedProcedureCount", "procedureCountUnit", "frequency", "schedule"]
    : HOSPITAL_ORDER_CORE_FIELD_KEYS[type];
  return keys.map((key) => {
    const definition = schema.fields.find(
      (field) => field.key === key,
    )!;
    // The dispensing editor is the current editable projection, including clears.
    const value =
      type === "dispensing" && order.dispensingPreset
        ? order.dispensingPreset[
            key as keyof NonNullable<HospitalOrderDraft["dispensingPreset"]>
          ]
        : values[key];
    const missing =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    return { clinicalOrderType: type, definition, value, missing };
  });
}

/** Presence only; not clinical validation, review or chart-confirmability. */
export function getHospitalOrderCoreStatus(order: HospitalOrderDraft) {
  const details = getHospitalOrderCoreDetails(order);
  if (!details.length) return "오더 유형 미설정";
  const missing = details.filter((field) => field.missing).length;
  return missing ? `핵심 값 ${missing}개 미설정` : "핵심 값 입력됨";
}
