import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825240000_chart_order_shared_draft_contract.sql",
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
    /const draftRows = rows\.flatMap<ChartOrderDraftRowInput>\(\(row\) => \{\s*if \(isChartOrderConfirmedRow\(row\)\) return \[\];/,
  );
  expect(migration).toContain("p_orders -> 'expectedEtag'");
  expect(migration).toContain("clair_save_chart_order_draft_phase2_base");
  expect(migration).toContain("set lock_timeout = '5s'");
  expect(migration).not.toMatch(/insert\s+into\s+public\.order_tasks/i);
  expect(migration).not.toMatch(/insert\s+into\s+public\.order_fulfillment_work_items/i);
  expect(migration).not.toMatch(/insert\s+into\s+public\.invoice_lines/i);
  expect(migration).not.toMatch(/insert\s+into\s+public\.chart_order_billing_candidates/i);
  expect(migration).not.toMatch(/\bdrop table\b|\btruncate\b|\bdelete from\b/i);
});

test("chart draft autosaves after 700ms, flushes on field exit, and blocks actions on conflict", () => {
  expect(chartModule).toMatch(
    /orderDraftSaveState === "saving" \|\|\s*!draftTouchedRef\.current[\s\S]*?window\.setTimeout\(\(\) => \{\s*if \(!draftTouchedRef\.current\) return;\s*void autoSaveDraftRef\.current\(\);\s*\}, 700\);/,
  );
  expect(chartModule).toContain("window.setTimeout(() => {");
  expect(chartModule).toContain("}, 700);");
  expect(chartModule).toContain("onBlur={onFlushDraft}");
  expect(chartModule).toContain('if (event.key === "Enter") event.currentTarget.blur()');
  expect(chartModule).toContain('orderDraftSaveState === "conflict"');
  expect(chartModule).toContain('testId="chart-order-draft-conflict"');
  expect(chartModule).toContain("현재 편집값은 덮어쓰지 않았습니다");
  expect(chartModule).toContain("서버 값 다시 불러오기");
});

test("chart draft serializes edits made during an in-flight save", () => {
  expect(chartModule).toMatch(
    /const inFlightSave = orderDraftSavePromiseRef\.current;\s*if \(inFlightSave\) return inFlightSave;/,
  );
  expect(chartModule).toMatch(
    /orderDraftSaveInFlightRef\.current = true;\s*while \(draftTouchedRef\.current\) \{[\s\S]*?const expectedEtag = orderDraftEtagRef\.current;[\s\S]*?draftTouchedRef\.current = false;[\s\S]*?const result = await saveChartOrderDraftRoute\([\s\S]*?orderDraftEtagRef\.current = result\.etag;/,
  );
  expect(chartModule).not.toContain("window.setTimeout(() => {\n          if (draftTouchedRef.current) void autoSaveDraftRef.current();\n        }, 0);");
});
