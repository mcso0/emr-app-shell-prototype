// Named synthetic local DB only. Migration and every fixture roll back, also on failure.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const migration = "supabase/migrations/20260929090000_billing_operating_date_queue_reader.sql";
const membershipFix = "supabase/migrations/20260929093000_billing_queue_membership_status.sql";
// The linked remote schema has no optional membership deleted_at column.
const remoteMembershipShape = process.argv.includes("--remote-membership-shape")
  ? ["alter table public.user_memberships drop column if exists deleted_at;"] : [];
const sql = ["BEGIN;", ...remoteMembershipShape, ...(process.argv.includes("--red") ? [] : [readFileSync(migration, "utf8"), readFileSync(membershipFix, "utf8")]), readFileSync("tests/sql/billing_operating_date_queue_reader.sql", "utf8"), "ROLLBACK;"].join("\n");
const result = spawnSync("docker", ["exec", "-i", "supabase_db_clinical-preset-perf-seeded-20260831", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", maxBuffer: 1024 * 1024 });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
