import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831132225_clinical_master_publisher_set_based_owner_revision.sql",
  "utf8",
);
const benchmark = readFileSync(
  "supabase/snippets/clinical_master_execution_preset_publisher_benchmark.sql",
  "utf8",
);
const runner = readFileSync(
  "scripts/benchmark-clinical-master-publisher.mjs",
  "utf8",
);
const packageJson = readFileSync("package.json", "utf8");

test("set-based migration patches all four revision passes and the owner pass exactly once", () => {
  for (const marker of [
    "old_vocabulary_revision",
    "old_panel_revision",
    "old_all_revision",
    "old_order_revision",
    "old_owner_revision",
    "new_vocabulary_revision",
    "new_panel_revision",
    "new_all_revision",
    "new_order_revision",
    "new_owner_revision",
  ]) {
    expect(migration).toContain(`$${marker}$`);
  }
  expect(migration).toContain("v_old_count=1 and v_new_count=0");
  expect(migration).toContain(
    "clinical_master_set_based_publisher_patch_anchor_missing",
  );
  expect(migration).toContain(
    "clinical_master_set_based_publisher_patch_postcondition_failed",
  );
  expect(migration.match(/latest_versions as \(/g)).toHaveLength(5);
  expect(
    migration.match(/where stage\.release_id=v_release\.id/g)?.length ?? 0,
  ).toBeGreaterThanOrEqual(12);
});

test("owner update consumes the exact release stage and fails closed on drift", () => {
  const ownerStart = migration.indexOf("$new_owner_revision$");
  const ownerEnd = migration.indexOf("$new_owner_revision$", ownerStart + 1);
  const ownerPatch = migration.slice(ownerStart, ownerEnd);

  expect(ownerPatch).toContain("clinical_master_owner_stage_contract_invalid");
  expect(ownerPatch).toContain("clinical_master_owner_stage_revision_invalid");
  expect(ownerPatch).toContain(
    "clinical_master_owner_stage_current_revision_invalid",
  );
  expect(ownerPatch).toContain("stage.release_id=v_release.id");
  expect(ownerPatch).toContain("stage.base_content,stage.relation_content");
  expect(ownerPatch).toContain("target.effective_revision=latest.revision+1");
  expect(ownerPatch).toContain("update master.master_records owner");
  expect(ownerPatch).not.toContain("for v_record in");
  expect(ownerPatch).not.toContain("clinical_master_lab_relation_content(");
});

test("dynamic replacement preserves the installed function security contract", () => {
  for (const attribute of [
    "function.proowner",
    "function.prosecdef",
    "function.proconfig",
    "function.proacl",
    "function.provolatile",
    "function.proparallel",
  ]) {
    expect(migration).toContain(attribute);
  }
  expect(migration).toContain(
    "clinical_master_set_based_publisher_security_contract_changed",
  );
  expect(migration).toContain("clinical_master.publisher_canonical_sha256");
  expect(migration).toContain(
    "clinical_master_omitted_lab_dependency_revision_missing",
  );
  expect(migration).toContain(
    "revoke all on function private.publish_clinical_master_release_cumulative(jsonb,uuid)",
  );
  expect(migration).not.toMatch(
    /create or replace function private\.publish_clinical_master_release\s*\(/i,
  );
});

test("candidate migration does not touch public runtime rows or weaken timeout gates", () => {
  expect(migration).not.toMatch(
    /(?:insert into|update|delete from)\s+public\./i,
  );
  expect(migration).not.toMatch(/\badopt_clinical_master_release\s*\(/i);
  expect(migration).not.toMatch(/clinicalUseAllowed'\s*,\s*true/i);
  expect(migration).not.toMatch(
    /statement_timeout\s*=\s*'[^']*(?:3|4|5|6|7|8|9)\d{2}s'/i,
  );
});

test("benchmark probe is a single exact rollback publish with raw environment evidence", () => {
  expect(benchmark).toContain("publisher_benchmark_baseline_mismatch");
  expect(benchmark).toContain("publisher_benchmark_fixture_shape_mismatch");
  expect(benchmark).toContain(
    "private.publish_clinical_master_release(payload,null)",
  );
  expect(
    benchmark.match(
      /private\.publish_clinical_master_release\(payload,null\)/g,
    ),
  ).toHaveLength(1);
  expect(benchmark).toContain("'sqlElapsedMs'");
  expect(benchmark).toContain("'toastBytes'");
  expect(benchmark).toContain("'deadTuples'");
  expect(benchmark).toContain("'functionHashes'");
  expect(benchmark).toContain("'postgresSettings'");
  expect(benchmark).toContain(")<>535");
  expect(benchmark).toContain("version.snapshot-'revision'");
  expect(benchmark).toContain(
    "owner.current_revision is distinct from stage.effective_revision",
  );
  expect(benchmark).toContain("rollback;");
  expect(benchmark).not.toContain("commit;");
  expect(benchmark).not.toContain("clinical_master_publisher_fallback");
  expect(benchmark).not.toContain(
    "publish_clinical_master_release_cumulative(payload",
  );
});

test("runner is Docker-local, ABBA ordered, and isolates committed retry", () => {
  expect(runner).toContain(
    '"baseline",\n      "candidate",\n      "candidate",\n      "baseline"',
  );
  expect(runner).toContain("^supabase_db_");
  expect(runner).toContain("assertLocalDockerEndpoint");
  expect(runner).toContain('environmentHost.startsWith("unix://")');
  expect(runner).toContain('contextHost.startsWith("unix://")');
  expect(runner).toContain("refusing non-local DOCKER_HOST");
  expect(runner).toContain("refusing non-local Docker context endpoint");
  expect(runner).toContain("clinical_master_bench_");
  expect(runner).toContain("assertTemplateBaseline");
  expect(runner).toContain('comparison: "owner_to_finalization"');
  expect(runner).toContain("ownerMigrationPath");
  expect(runner).toContain("finalizationMigrationPath");
  expect(runner).toContain("candidateChainSha256");
  expect(runner).toContain("assertVariantMarkers");
  expect(runner).toContain("createRunDatabase");
  expect(runner).toContain("dropRunDatabase");
  expect(runner).toContain("if (runDatabaseCreated)");
  expect(runner).toContain("throw new Error(`[BLOCKED] ${message}`)");
  expect(runner).not.toContain("process.exit(1)");
  expect(runner).toContain("runCommittedRetry");
  expect(
    runner.match(/psql\(containerName, database, publishSql/g),
  ).toHaveLength(2);
  expect(runner).not.toContain("SUPABASE_ACCESS_TOKEN");
  expect(runner).not.toContain("supabase.com");
  expect(packageJson).toContain(
    '"clinical-master:publisher:benchmark": "node scripts/benchmark-clinical-master-publisher.mjs"',
  );
});
