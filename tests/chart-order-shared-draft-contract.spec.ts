import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825240000_chart_order_shared_draft_contract.sql",
  "utf8",
);
const etagVisibilityMigration = readFileSync(
  "supabase/migrations/20260826170000_chart_order_draft_etag_post_write_visibility.sql",
  "utf8",
);
const candidateRemovalMigration = readFileSync(
  "supabase/migrations/20260830220000_chart_order_draft_candidate_removal.sql",
  "utf8",
);
const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");

test("shared draft migration covers every editable value in readback and ETag input", () => {
  for (const key of [
    "clinicalOrderType",
    "destinationModule",
    "executionMode",
    "detailInputs",
    "detailSchemaVersion",
    "priority",
    "billingEligible",
    "revisionNo",
  ]) {
    expect(migration).toContain(`'${key}'`);
  }
  expect(migration).toContain("private.clair_b3_runtime_row_json");
  expect(migration).toContain("private.clair_order_detail_inputs_are_valid");
  expect(migration).toContain("raise exception 'detail_inputs_invalid'");
  expect(migration).toContain("raise exception 'child_detail_inputs_invalid'");
});

test("shared draft save remains CAS-bound and creates no execution artifacts", () => {
  expect(chartModule).toMatch(
    /draftRows = rows\.flatMap<ChartOrderDraftRowInput>\(\(row\) => \{\s*if \(isChartOrderConfirmedRow\(row\)\) return \[\];/,
  );
  expect(migration).toContain("p_orders -> 'expectedEtag'");
  expect(migration).toContain("clair_save_chart_order_draft_phase2_base");
  expect(migration).toContain("set lock_timeout = '5s'");
  expect(migration).not.toMatch(/insert\s+into\s+public\.order_tasks/i);
  expect(migration).not.toMatch(
    /insert\s+into\s+public\.order_fulfillment_work_items/i,
  );
  expect(migration).not.toMatch(/insert\s+into\s+public\.invoice_lines/i);
  expect(migration).not.toMatch(
    /insert\s+into\s+public\.chart_order_billing_candidates/i,
  );
  expect(migration).not.toMatch(/\bdrop table\b|\btruncate\b|\bdelete from\b/i);
});

test("candidate removal is explicit, soft-cancelled, root-scoped, and downstream-safe", () => {
  expect(candidateRemovalMigration).toContain("removedOrderIds");
  expect(candidateRemovalMigration).toContain("draft_candidate_removed");
  expect(candidateRemovalMigration).toContain(
    "row_type in ('individual', 'set')",
  );
  expect(candidateRemovalMigration).toContain(
    "order_confirmation_status in ('draft', 'pending')",
  );
  expect(candidateRemovalMigration).toContain("public.order_tasks");
  expect(candidateRemovalMigration).toContain(
    "public.order_fulfillment_work_items",
  );
  expect(candidateRemovalMigration).toContain("public.invoice_lines");
  expect(candidateRemovalMigration).toMatch(
    /set\s+status\s*=\s*'cancelled',[\s\S]*order_confirmation_status\s*=\s*'cancelled'/i,
  );
  expect(candidateRemovalMigration).not.toMatch(/\bdelete\s+from\b/i);
});

test("chart draft separates 150ms discrete saves from 700ms continuous edits", () => {
  expect(chartModule).toContain("!canUpdateOrders");
  expect(chartModule).toContain('orderDraftSaveState === "saving"');
  expect(chartModule).toContain("orderDraftSaveInFlightRef.current");
  expect(chartModule).toContain("!draftTouchedRef.current");
  expect(chartModule).toContain("window.setTimeout(() => {");
  expect(chartModule).toContain("const chartOrderDiscreteSaveDelayMs = 150");
  expect(chartModule).toContain("const chartOrderContinuousSaveDelayMs = 700");
  expect(chartModule).toContain("}, draftSaveDelayMsRef.current);");
  expect(chartModule).toContain('markDraftTouched("discrete")');
  expect(chartModule).toContain("onBlur={onFlushDraft}");
  expect(chartModule).toContain(
    'if (event.key === "Enter") event.currentTarget.blur()',
  );
  expect(chartModule).toContain('orderDraftSaveState === "conflict"');
  expect(chartModule).toContain('testId="chart-order-draft-conflict"');
  expect(chartModule).toContain("현재 편집값은 덮어쓰지 않았습니다");
  expect(chartModule).toContain("서버 값 다시 불러오기");
});

test("chart draft clears a local add-delete net-zero change without a request", () => {
  expect(chartModule).toContain("const hasRemainingChanges =");
  expect(chartModule).toContain("draftTouchedRef.current = false");
  const removalBlock = chartModule.slice(
    chartModule.indexOf("const confirmDeleteOrder = () =>"),
    chartModule.indexOf("const confirmSingleOrder =", chartModule.indexOf("const confirmDeleteOrder = () =>")),
  );
  expect(removalBlock).not.toContain("commitDraftRows(");
});

test("chart draft serializes edits made during an in-flight save", () => {
  expect(chartModule).toMatch(
    /const inFlightSave = orderDraftSavePromiseRef\.current;\s*if \(inFlightSave\) return inFlightSave;\s*if \(orderDraftSaveInFlightRef\.current\) return Promise\.resolve\(false\);/,
  );
  expect(chartModule).toMatch(
    /orderDraftSaveInFlightRef\.current = true;[\s\S]*?while \(draftTouchedRef\.current\) \{[\s\S]*?const expectedEtag = orderDraftEtagRef\.current;[\s\S]*?draftTouchedRef\.current = false;[\s\S]*?const result = await saveChartOrderDraftRoute\([\s\S]*?orderDraftEtagRef\.current = result\.etag;/,
  );
  expect(chartModule).not.toContain(
    "window.setTimeout(() => {\n          if (draftTouchedRef.current) void autoSaveDraftRef.current();\n        }, 0);",
  );
});

test("confirmed rows never reopen the mutable draft and confirmation keeps the save lock through the action RPC", () => {
  expect(chartModule).toMatch(
    /const deletedDraftOrderCount = committedRows\.filter\([\s\S]*?!isChartOrderConfirmedRow\(row\)[\s\S]*?const changedDraftOrderCount =[\s\S]*?if \(isChartOrderConfirmedRow\(row\)\) return false;/,
  );

  const confirmationStart = chartModule.indexOf(
    "const actionExpectedEtag = effectiveDraftResult.etag;",
  );
  const actionRequest = chartModule.indexOf(
    "let result = await saveChartOrderActionRoute({",
    confirmationStart,
  );
  const actionUnlock = chartModule.indexOf(
    "orderDraftSaveInFlightRef.current = false;\n    await applyConfirmedResult(result, recoveredConfirmation);",
    actionRequest,
  );
  expect(confirmationStart).toBeGreaterThan(-1);
  expect(actionRequest).toBeGreaterThan(confirmationStart);
  expect(actionUnlock).toBeGreaterThan(actionRequest);
  expect(chartModule).not.toContain(
    "orderDraftConflictRef.current = false;\n    orderDraftSaveInFlightRef.current = false;\n    const actionExpectedEtag",
  );
});

test("draft writers return a post-write ETag from the same RPC statement", () => {
  expect(etagVisibilityMigration).toContain(
    "alter function private.clair_b3_order_draft_etag(text, uuid) volatile;",
  );
  expect(etagVisibilityMigration).not.toMatch(
    /\b(drop|truncate|delete|grant)\b/i,
  );
});
