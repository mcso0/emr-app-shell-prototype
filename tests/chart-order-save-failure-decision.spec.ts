import { expect, test } from "@playwright/test";
import { classifyChartOrderSaveFailure } from "../src/features/chart/chart-order-save-failure-decision";

type Failure = Parameters<typeof classifyChartOrderSaveFailure>[0];
const cases: Array<{
  name: string;
  failure: Failure;
  conflict: boolean;
  retainPendingConfirmation: boolean;
}> = [
  { name: "ETag conflict in denialReason", failure: { ok: false, status: 409, denialReason: "revision_conflict" }, conflict: true, retainPendingConfirmation: false },
  { name: "ETag conflict in error", failure: { ok: false, status: 409, error: "revision_conflict" }, conflict: true, retainPendingConfirmation: false },
  { name: "other HTTP 409 is an ordinary error", failure: { ok: false, status: 409, denialReason: "stale_status" }, conflict: false, retainPendingConfirmation: false },
  { name: "bare HTTP 409 is an ordinary error", failure: { ok: false, status: 409 }, conflict: false, retainPendingConfirmation: false },
  { name: "permission denial releases pending confirmation", failure: { ok: false, status: 403, denialReason: "permission_missing" }, conflict: false, retainPendingConfirmation: false },
  { name: "failed write retains the existing confirmation command", failure: { ok: false, status: 500, error: "db_write_failed" }, conflict: false, retainPendingConfirmation: true },
  { name: "temporary service failure retains the command", failure: { ok: false, status: 503 }, conflict: false, retainPendingConfirmation: true },
  { name: "status threshold remains greater than or equal to 500", failure: { ok: false, status: 600 }, conflict: false, retainPendingConfirmation: true },
  { name: "confirmation in progress in denialReason", failure: { ok: false, status: 409, denialReason: "confirmation_in_progress" }, conflict: false, retainPendingConfirmation: true },
  { name: "confirmation in progress in error", failure: { ok: false, status: 409, error: "confirmation_in_progress" }, conflict: false, retainPendingConfirmation: true },
  { name: "conflict and retention are independent decisions", failure: { ok: false, status: 503, denialReason: "revision_conflict" }, conflict: true, retainPendingConfirmation: true },
  { name: "both code fields are checked without precedence", failure: { ok: false, status: 409, denialReason: "permission_missing", error: "revision_conflict" }, conflict: true, retainPendingConfirmation: false },
  { name: "mixed conflict and in-progress codes preserve both branches", failure: { ok: false, status: 409, denialReason: "revision_conflict", error: "confirmation_in_progress" }, conflict: true, retainPendingConfirmation: true },
  { name: "code comparisons stay exact", failure: { ok: false, status: 422, denialReason: "REVISION_CONFLICT", error: "confirmation_in_progress " }, conflict: false, retainPendingConfirmation: false },
];

for (const { name, failure, conflict, retainPendingConfirmation } of cases) {
  test(name, () => {
    expect(classifyChartOrderSaveFailure(Object.freeze(failure))).toEqual({
      conflict,
      retainPendingConfirmation,
    });
  });
}
