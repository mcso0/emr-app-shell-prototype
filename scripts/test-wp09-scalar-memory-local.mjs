// Named local synthetic DB only. Original SQL and replacement are compared in
// the same backend; definitions and all temporary fixtures end in ROLLBACK.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (process.argv.length !== 2) throw Error("wp09_scalar_test_takes_no_options");
const cellSource = readFileSync("supabase/migrations/20260906084900_clinical_master_execution_field_merge.sql", "utf8");
const cell = cellSource.match(/create function private\.clair_execution_field_cell\([\s\S]+?\$fn\$;/)?.[0];
if (!cell) throw Error("wp09_scalar_source_missing");
const schemaSource = readFileSync("supabase/migrations/20260825234000_chart_order_execution_master_contract.sql", "utf8");
const validator = schemaSource.match(/create or replace function private\.clair_order_field_schema_is_valid\([\s\S]+?\$function\$;/)?.[0];
const treatmentSource = readFileSync("supabase/migrations/20260906103022_clinical_master_treatment_planning_v2.sql", "utf8");
const getter = treatmentSource.match(/create function private\.clair_order_detail_field_schema\([\s\S]+?\$f\$;/)?.[0];
const validatorPatch = treatmentSource.slice(treatmentSource.indexOf("  proc:='private.clair_order_field_schema_is_valid"), treatmentSource.indexOf("\n  foreach proc in array"));
if (!validator || !getter || !validatorPatch.includes("schema_validator_anchor_mismatch")) throw Error("wp09_scalar_schema_source_missing");
const sql = ["BEGIN; SET LOCAL statement_timeout='60s';", cell.replace("create function", "create or replace function"),
  validator, getter.replace("create function", "create or replace function"),
  `DO $patch$ DECLARE body text; anchor text; proc regprocedure; BEGIN ${validatorPatch} END $patch$;`,
  "CREATE TEMP TABLE scalar_test_metadata AS SELECT oid, to_jsonb(p)-ARRAY['prosrc','prolang'] AS metadata FROM pg_proc p WHERE oid IN ('private.clair_execution_field_cell(jsonb,jsonb,text)'::regprocedure,'private.clair_order_field_schema_is_valid(text,integer,jsonb)'::regprocedure);",
  `DO $copy$ DECLARE fn text; BEGIN
    FOREACH fn IN ARRAY ARRAY['clair_execution_field_cell','clair_order_field_schema_is_valid'] LOOP
      EXECUTE replace((SELECT pg_get_functiondef(oid) FROM pg_proc WHERE pronamespace='private'::regnamespace AND proname=fn), 'private.'||fn||'(', 'pg_temp.original_'||fn||'(');
    END LOOP;
  END $copy$;`,
  readFileSync("supabase/migrations/20260907054704_clinical_master_oed_scalar_memory.sql", "utf8"),
  readFileSync("tests/sql/wp09_scalar_memory_contract.sql", "utf8"), "ROLLBACK;"].join("\n");
const result = spawnSync("docker", ["exec", "-i", "supabase_db_clinical-preset-perf-seeded-20260831", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 2e6, timeout: 90000 });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) throw result.error;
if (result.status === 0 && !/^ROLLBACK$/m.test(result.stdout)) throw Error("wp09_scalar_rollback_missing");
process.exitCode = result.status ?? 1;
