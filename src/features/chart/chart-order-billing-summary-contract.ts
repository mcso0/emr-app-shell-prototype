export type ChartOrderBillingSummary = {
  amounts: {
    confirmed: number;
    discount: number;
    draft: number;
    estimatedTotal: number;
    gross: number;
    outstanding: number;
    paid: number;
    requestableTotal: number;
    surcharge: number;
    tax: number;
  };
  currency: "KRW";
  context: {
    encounter: {
      createdAt: string;
      encounterNo: string;
      guardianId: string | null;
      id: string;
      patientId: string;
      status: string;
      updatedAt: string;
    };
    guardian: {
      createdAt: string;
      id: string;
      name: string;
      updatedAt: string;
    } | null;
    patient: {
      breed: string | null;
      createdAt: string;
      id: string;
      name: string;
      patientNo: string;
      sex: string;
      species: string;
      status: string;
      updatedAt: string;
    };
  } | null;
  encounterId: string;
  etag: string;
  generatedAt: string;
  invoiceId: string | null;
  orderCounts: {
    cancelled: number;
    confirmed: number;
    draft: number;
    recheck: number;
    requested: number;
    requestable: number;
    total: number;
  };
  requestableOrderIds: string[];
  unfinishedOrders: Array<{
    name: string;
    orderId: string;
    status: string;
  }>;
  workspaceId: string;
};

export type ChartOrderBillingSummaryMutationRow = {
  billingCandidateStatus?: string | null;
  billingEligible?: boolean;
  billingReflectionEnabled?: boolean;
  lineTotalSnapshot?: number | null;
  orderConfirmationStatus?: string;
  orderId: string;
  rowType?: "individual" | "set" | "set_child";
  status?: string;
};

export function createMockChartOrderBillingSummaryFromMutationRows({
  encounterId,
  etag,
  generatedAt = new Date().toISOString(),
  rows,
  workspaceId,
}: {
  encounterId: string;
  etag: string;
  generatedAt?: string;
  rows: ChartOrderBillingSummaryMutationRow[];
  workspaceId: string;
}): ChartOrderBillingSummary {
  const activeRows = rows.filter((row) => row.status !== "cancelled");
  const topLevelRows = activeRows.filter((row) => row.rowType !== "set_child");
  const billableRows = activeRows.filter(
    (row) =>
      row.billingEligible !== false &&
      row.billingReflectionEnabled !== false &&
      typeof row.lineTotalSnapshot === "number" &&
      row.lineTotalSnapshot > 0,
  );
  const confirmedRows = billableRows.filter((row) =>
    row.orderConfirmationStatus === "confirmed" ||
    row.orderConfirmationStatus === "billed",
  );
  const draftRows = billableRows.filter((row) =>
    row.orderConfirmationStatus !== "confirmed" &&
    row.orderConfirmationStatus !== "billed",
  );
  const requestableRows = confirmedRows.filter(
    (row) => row.billingCandidateStatus === "candidate_created",
  );
  const confirmed = sumMutationRows(confirmedRows);
  const draft = sumMutationRows(draftRows);

  return {
    amounts: {
      confirmed,
      discount: 0,
      draft,
      estimatedTotal: confirmed + draft,
      gross: confirmed + draft,
      outstanding: 0,
      paid: 0,
      requestableTotal: sumMutationRows(requestableRows),
      surcharge: 0,
      tax: 0,
    },
    context: null,
    currency: "KRW",
    encounterId,
    etag,
    generatedAt,
    invoiceId: null,
    orderCounts: {
      cancelled: rows.filter((row) => row.status === "cancelled" && row.rowType !== "set_child").length,
      confirmed: topLevelRows.filter((row) =>
        row.orderConfirmationStatus === "confirmed" ||
        row.orderConfirmationStatus === "billed",
      ).length,
      draft: topLevelRows.filter((row) =>
        row.orderConfirmationStatus !== "confirmed" &&
        row.orderConfirmationStatus !== "billed",
      ).length,
      recheck: topLevelRows.filter((row) => row.status === "re_requested").length,
      requested: topLevelRows.filter((row) => row.billingCandidateStatus === "invoice_linked").length,
      requestable: requestableRows.length,
      total: topLevelRows.length,
    },
    requestableOrderIds: requestableRows.map((row) => row.orderId),
    unfinishedOrders: [],
    workspaceId,
  };
}

export type ChartOrderBillingRequestInput = {
  acknowledgeUnfinished?: boolean;
  encounterId?: string;
  expectedEtag?: string;
  idempotencyKey?: string;
};

export function mapChartOrderBillingSummary(
  value: unknown,
): ChartOrderBillingSummary | null {
  const root = asRecord(value);
  const amounts = asRecord(root?.amounts);
  const counts = asRecord(root?.orderCounts);
  const context = mapContext(root?.context);
  if (
    !root ||
    !amounts ||
    !counts ||
    typeof root.workspaceId !== "string" ||
    typeof root.encounterId !== "string" ||
    typeof root.etag !== "string" ||
    typeof root.generatedAt !== "string" ||
    root.currency !== "KRW" ||
    (root.context !== null && !context) ||
    (root.invoiceId !== null && typeof root.invoiceId !== "string") ||
    !Array.isArray(root.requestableOrderIds) ||
    !root.requestableOrderIds.every((id) => typeof id === "string") ||
    !Array.isArray(root.unfinishedOrders)
  ) return null;

  const numericAmountKeys = [
    "confirmed", "discount", "draft", "estimatedTotal", "gross",
    "outstanding", "paid", "requestableTotal", "surcharge", "tax",
  ] as const;
  const numericCountKeys = [
    "cancelled", "confirmed", "draft", "recheck", "requested",
    "requestable", "total",
  ] as const;
  if (
    numericAmountKeys.some((key) => !isFiniteNumber(amounts[key])) ||
    numericCountKeys.some((key) => !isFiniteNumber(counts[key]))
  ) return null;

  const unfinishedOrders = root.unfinishedOrders.map((value) => {
    const row = asRecord(value);
    return row && typeof row.orderId === "string" &&
      typeof row.name === "string" && typeof row.status === "string"
      ? { orderId: row.orderId, name: row.name, status: row.status }
      : null;
  });
  if (unfinishedOrders.some((row) => row === null)) return null;

  return {
    workspaceId: root.workspaceId,
    encounterId: root.encounterId,
    etag: root.etag,
    generatedAt: root.generatedAt,
    currency: "KRW",
    context,
    invoiceId: root.invoiceId as string | null,
    requestableOrderIds: [...root.requestableOrderIds],
    unfinishedOrders: unfinishedOrders as ChartOrderBillingSummary["unfinishedOrders"],
    orderCounts: Object.fromEntries(
      numericCountKeys.map((key) => [key, counts[key]]),
    ) as ChartOrderBillingSummary["orderCounts"],
    amounts: Object.fromEntries(
      numericAmountKeys.map((key) => [key, amounts[key]]),
    ) as ChartOrderBillingSummary["amounts"],
  };
}

function mapContext(value: unknown): ChartOrderBillingSummary["context"] {
  if (value === null) return null;
  const root = asRecord(value);
  const encounter = asRecord(root?.encounter);
  const patient = asRecord(root?.patient);
  const guardian = root?.guardian === null ? null : asRecord(root?.guardian);
  if (
    !root || !encounter || !patient ||
    typeof encounter.id !== "string" || typeof encounter.patientId !== "string" ||
    typeof encounter.encounterNo !== "string" || typeof encounter.status !== "string" ||
    typeof encounter.createdAt !== "string" || typeof encounter.updatedAt !== "string" ||
    (encounter.guardianId !== null && typeof encounter.guardianId !== "string") ||
    typeof patient.id !== "string" || typeof patient.patientNo !== "string" ||
    typeof patient.name !== "string" || typeof patient.species !== "string" ||
    typeof patient.sex !== "string" || typeof patient.status !== "string" ||
    typeof patient.createdAt !== "string" || typeof patient.updatedAt !== "string" ||
    (patient.breed !== null && typeof patient.breed !== "string") ||
    (guardian && (typeof guardian.id !== "string" || typeof guardian.name !== "string" ||
      typeof guardian.createdAt !== "string" || typeof guardian.updatedAt !== "string"))
  ) return null;
  return {
    encounter: {
      id: encounter.id,
      patientId: encounter.patientId,
      guardianId: encounter.guardianId as string | null,
      encounterNo: encounter.encounterNo,
      status: encounter.status,
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
    },
    patient: {
      id: patient.id,
      patientNo: patient.patientNo,
      name: patient.name,
      species: patient.species,
      breed: patient.breed as string | null,
      sex: patient.sex,
      status: patient.status,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    },
    guardian: guardian ? {
      id: guardian.id as string,
      name: guardian.name as string,
      createdAt: guardian.createdAt as string,
      updatedAt: guardian.updatedAt as string,
    } : null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sumMutationRows(rows: ChartOrderBillingSummaryMutationRow[]) {
  return rows.reduce(
    (sum, row) => sum + (typeof row.lineTotalSnapshot === "number" ? row.lineTotalSnapshot : 0),
    0,
  );
}
