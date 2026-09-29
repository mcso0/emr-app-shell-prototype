// Actual retest RPC and chart-origin trigger in an isolated, synthetic PostgreSQL fixture.
// Run: LAB_RETEST_TEST_CONTAINER=chart-pr037-postgres node --test tests/lab-retest-chart-origin.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const container = process.env.LAB_RETEST_TEST_CONTAINER;
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const original = read("../supabase/migrations/20260906114732_clinical_master_lab_atomic_retest.sql");
const multiChart = read("../supabase/migrations/20260908211856_encounter_multi_chart.sql");
const guard = multiChart.slice(multiChart.indexOf("create function private.clair_guard_order_chart_origin()"),
  multiChart.indexOf("-- Order-owned execution retains"));
const phase2 = read("../supabase/migrations/20260927124324_lab_result_sheet_phase2.sql");
const history = phase2.slice(phase2.indexOf("create function private.clair_log_lab_retest_snapshot()"),
  phase2.indexOf("create function public.clair_get_lab_result_phase2"));
const patch = read("../supabase/migrations/20260929065000_lab_atomic_retest_chart_origin.sql");

test("retest inherits the prior chart, preserves snapshots, and retains boundary guards", { skip: !container }, () => {
  const db = `codex_lab_retest_${process.pid}_${Date.now()}`;
  const run = (database, input) => {
    const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database],
      { input, encoding: "utf8", maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  run("postgres", `create database ${db};`);
  try {
    const fixture = read("./sql/lab-retest-chart-origin-fixture.sql")
      .replace("-- ORIGINAL_RETEST", () => original).replace("-- CHART_ORIGIN_GUARD", () => guard)
      .replace("-- RETEST_HISTORY", () => history).replaceAll("-- CHART_ORIGIN_PATCH", () => patch);
    assert.match(run(db, fixture), /lab retest chart origin checks passed/);
  } finally {
    run("postgres", `drop database ${db};`);
  }
});
