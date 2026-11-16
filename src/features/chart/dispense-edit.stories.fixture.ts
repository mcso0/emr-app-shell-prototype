import { equivalentDispensingQuantity, resolveDispensingDoseFactor } from "./dispensing-unit-conversion";
import { derivePlanOrderTotalOccurrences, resolvePlanOrderAuthority } from "./plan-order-authority-domain";
import { calculateDispenseRequestTotal } from "./dispense-request-quantity";
import type { ChartOrderRuntimeRow } from "./server-order-draft-persistence-core";

/** Synthetic quantities only; no clinical calculation or database writes. */
export function createEditableDispenseRow(workspaceId: string, encounterId: string, chartId: string) {
  const detailInputs = {
    doseBasis: "patient",
    dose: 16,
    doseUnit: "mg",
    route: "PO",
    frequency: "sid",
    durationDays: 1,
    totalQuantity: 1,
  };
  const authority = {
    schemaVersion: 1,
    calculationMode: "ingredient_based",
    dispenseUnit: "mL",
    referenceIngredientId: "synthetic-ingredient",
    productStrength: {
      numeratorValue: 16,
      numeratorUnit: "mg",
      denominatorValue: 1,
      denominatorUnit: "mL",
    },
    preparationPolicy: {
      increment: 0.5,
      roundingMode: "nearest",
      displayPrecision: 1,
      noReasonTolerance: 0.1,
    },
    priceBasis: "per_product_unit",
    billingUnit: "mL",
    taxClass: "taxable",
  };
  const row: ChartOrderRuntimeRow = {
    orderId: "synthetic-dispense-order",
    workspaceId,
    encounterId,
    originChartId: chartId,
    rowType: "individual",
    orderType: "dispensing",
    clinicalOrderType: "dispensing",
    destinationModule: "dispensing",
    executionMode: "routed",
    detailInputs,
    detailSchemaVersion: 1,
    priority: "normal",
    billingEligible: true,
    revisionNo: 0,
    parentOrderId: null,
    sourceSetId: null,
    sourceSetRevisionId: null,
    sourceSetRevisionNo: null,
    sourceSetVersion: null,
    sourceSetRevisionItemId: null,
    workspaceCatalogItemId: "synthetic-product",
    workspaceCatalogRevision: 1,
    dispensingLineage: null,
    quantity: 1,
    quantitySource: "manual",
    unitPriceSnapshot: 4500,
    lineTotalSnapshot: 4500,
    snapshotSchemaVersion: 0,
    snapshotHash: null,
    appliedSnapshot: {
      billingName: "합성 조제 약품",
      billingReflectionEnabled: true,
      categoryGroup: "medication",
      clinicalOrderType: "dispensing",
      destinationModule: "dispensing",
      detailInputs,
      detailSchemaVersion: 1,
      executionMode: "routed",
      inHospitalOrderName: "합성 조제 약품",
      lineTotalSnapshot: 4500,
      orderType: "dispensing",
      planOrderAuthority: authority,
      priceKrw: 4500,
      quantity: 1,
      rowType: "individual",
      standardOrderName: "합성 조제 약품",
      workspaceCatalogItemId: "synthetic-product",
      workspaceCatalogRevision: 1,
    },
    appliedPriceSnapshot: {},
    calculationInputs: {},
    calculationOutputs: {
      dispenseRequestSchemaVersion: 1,
      preparationSchemaVersion: 2,
      preparationQuantityScope: "course_total",
      theoreticalTotalQuantity: 1,
      plannedPracticalTotalQuantity: 1,
      actualDispenseOverride: null as Record<string, unknown> | null,
      actualDispenseQuantity: 1,
      actualDispenseSource: "preparation_policy",
      actualDispenseUnit: "mL",
      calculatedDispenseQuantity: 1,
      calculationStatus: "ready",
      dispenseApplicability: true,
      inputFingerprint: "a".repeat(64),
      preparationPolicy: authority.preparationPolicy,
      proposedActualDispenseQuantity: 1,
      requiresReconfirmation: false,
      theoreticalDispenseQuantity: 1,
      totalOccurrences: 1,
      totalRequiredDispenseQuantity: 1,
    },
    billingReflectionEnabled: true,
    orderConfirmationStatus: "draft",
    status: "requested",
    updatedAt: "2026-10-31T00:00:00.000Z",
  };
  return row;
}

/** Synthetic adapter uses the shared unit resolver; it does not execute the DB calculator. */
export function recalculateEditableDispenseRow(row: ChartOrderRuntimeRow, details: Record<string, unknown>): ChartOrderRuntimeRow | null {
  // Other prescription edits are deliberately outside this hands-on example.
  for (const key of ["doseBasis", "route"]) {
    if (details[key] !== row.detailInputs[key]) return null;
  }
  const frequency = String(details.frequency);
  const dailyCount = ({ once: 1, sid: 1, bid: 2, tid: 3, qid: 4 } as Record<string, number>)[frequency];
  const days = details.durationDays;
  if (typeof days !== "number" || !dailyCount || (frequency === "once" && days !== 1)) return null;
  const occurrences = derivePlanOrderTotalOccurrences({ kind: "daily", durationDays: days, dailyCount });
  if (!occurrences) return null;
  const outputs = row.calculationOutputs;
  const dose = details.dose;
  if (typeof dose !== "number" || !Number.isFinite(dose) || dose <= 0) return null;
  const authority = resolvePlanOrderAuthority({ appliedSnapshot: row.appliedSnapshot, dedicatedSnapshot: row.dispensingAuthoritySnapshot });
  const factor = resolveDispensingDoseFactor(authority, String(details.doseUnit), details.doseBasis);
  const oldFactor = resolveDispensingDoseFactor(authority, String(row.detailInputs.doseUnit), row.detailInputs.doseBasis);
  if (!factor.ok) return null;
  const perDose = dose * factor.factor;
  const total = perDose * occurrences;
  const proposal = calculateDispenseRequestTotal(total, "mL", outputs.preparationPolicy === null ? null : { mode: "nearest", increment: 0.5, displayPrecision: 1, unit: "mL" });
  if (!proposal.ok) return null;
  const manual = outputs.actualDispenseSource === "manual_override";
  const changed = !oldFactor.ok || !equivalentDispensingQuantity(perDose, Number(row.detailInputs.dose) * oldFactor.factor) ||
    details.durationDays !== row.detailInputs.durationDays || frequency !== row.detailInputs.frequency;
  const actual = manual ? Number(outputs.actualDispenseQuantity) : proposal.quantity;
  return { ...row, detailInputs: { ...details }, calculationInputs: { ...details },
    calculationOutputs: { ...outputs, totalOccurrences: occurrences,
      theoreticalDispenseQuantity: perDose, calculatedDispenseQuantity: perDose,
      theoreticalTotalQuantity: total, proposedActualDispenseQuantity: proposal.quantity,
      actualDispenseQuantity: actual, plannedPracticalTotalQuantity: actual,
      totalRequiredDispenseQuantity: actual,
      inputFingerprint: `synthetic-${perDose}-${days}-${frequency}`,
      requiresReconfirmation: manual && (outputs.requiresReconfirmation === true || changed),
    },
  };
}
