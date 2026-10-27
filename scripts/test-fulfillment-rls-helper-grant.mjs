import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const container = `clair-helper-grant-${process.pid}`;
const images = {
  postgres: "public.ecr.aws/supabase/postgres:17.6.1.165",
  auth: "public.ecr.aws/supabase/gotrue:v2.195.0",
  storage: "public.ecr.aws/supabase/storage-api:v1.69.11",
  realtime: "public.ecr.aws/supabase/realtime:v2.129.0",
};
const password = randomBytes(24).toString("hex");
const jwtSecret = randomBytes(32).toString("hex");
const env = (key, value) => ["-e", [key, value].join("=")];
function connection(role) {
  const url = new URL("postgres://127.0.0.1:5432/postgres");
  url.username = role;
  url.password = password;
  return url.href;
}
function command(args, input, allowFailure = false) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 180_000 });
  if (!allowFailure && (r.error || r.status !== 0)) throw new Error(`${args.slice(0, 3).join(" ")}: ${r.error ?? ""}\n${r.stdout?.slice(-1000)}\n${r.stderr?.slice(-3500)}`);
  return r;
}
function sql(input, role = "postgres", allowFailure = false) {
  return command(["exec", "-i", container, "psql", "-X", "--single-transaction", "-U", role, "-d", "postgres", "-v", "ON_ERROR_STOP=1"], input, allowFailure);
}
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261027133855_fulfillment_rls_helper_execute_grant.sql");
const fixture = read("tests/sql/fulfillment-rls-helper-grant.sql");
let owned = false;
try {
  // No downloads, host ports, mounts, inherited DB URLs, or shared containers.
  for (const image of Object.values(images)) command(["image", "inspect", image]);
  command(["run", "--detach", "--rm", "--pull=never", "--name", container, "--network", "none", ...env("POSTGRES_PASSWORD", password), images.postgres]);
  owned = true;
  assert.equal(command(["inspect", "--format", "{{.HostConfig.NetworkMode}}", container]).stdout.trim(), "none");
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const logs = command(["logs", container]);
    if (/init process complete;[\s\S]*database system is ready to accept connections/.test(logs.stdout + logs.stderr)) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "isolated Postgres initialization timed out");
  sql(`alter role supabase_auth_admin password '${password}'; alter role supabase_storage_admin password '${password}';`, "supabase_admin");
  const network = ["run", "--rm", "--pull=never", "--network", `container:${container}`];
  command([...network, ...env("GOTRUE_DB_DRIVER", "postgres"), ...env("GOTRUE_DB_DATABASE_URL", connection("supabase_auth_admin")), ...env("GOTRUE_SITE_URL", "http://localhost"), ...env("GOTRUE_JWT_SECRET", jwtSecret), ...env("API_EXTERNAL_URL", "http://localhost"), images.auth, "auth", "migrate"]);
  command([...network, ...env("DATABASE_URL", connection("supabase_storage_admin")), ...env("ANON_KEY", "local-synthetic"), ...env("SERVICE_KEY", "local-synthetic"), ...env("PGRST_JWT_SECRET", jwtSecret), images.storage, "node", "dist/scripts/migrate-call.js"]);
  const realtime = command(["run", "--rm", "--pull=never", "--network", "none", "--entrypoint", "sh", images.realtime, "-c", "cat /app/lib/realtime*/priv/repo/tenant_db_dump_17.sql"]).stdout;
  sql(realtime, "supabase_admin");
  sql(`do $$ declare creator text; scope text; begin
    foreach creator in array array['postgres','supabase_admin'] loop
      foreach scope in array array['',' in schema public'] loop
        execute format('alter default privileges for role %I%s revoke all on tables from public,anon,authenticated,service_role',creator,scope);
        execute format('alter default privileges for role %I%s revoke all on sequences from public,anon,authenticated,service_role',creator,scope);
        execute format('alter default privileges for role %I%s revoke execute on functions from anon,authenticated,service_role',creator,scope);
      end loop;
    end loop;
  end $$;`, "supabase_admin");
  sql(`create table public.grant_test_canary(id integer);
    do $$ begin
      if exists(select 1 from pg_roles r where rolname in ('anon','authenticated','service_role') and has_table_privilege(r.oid,'public.grant_test_canary','SELECT,INSERT,UPDATE,DELETE')) then raise exception 'automatic grants remain'; end if;
    end $$; drop table public.grant_test_canary;`);
  // Stop before the unrelated historical data-dependent migration (DB-PR-004).
  const files = readdirSync(`${root}/supabase/migrations`).filter(f => f.endsWith(".sql") && f < "20260826160000").sort();
  assert.equal(files.length, 199, "baseline changed: review the replay boundary");
  for (const file of files) sql(read(`supabase/migrations/${file}`));
  console.log("PASS: 199 real baseline migrations without automatic table grants");
  const before = sql("set local role authenticated; select id from public.order_fulfillment_work_items limit 0;", "postgres", true);
  assert.notEqual(before.status, 0, "baseline must reproduce the missing helper grant");
  assert.match(before.stderr, /permission denied for function clair_queue_permission_for_destination/);
  const result = sql(fixture.replaceAll("-- APPLY CANDIDATE", () => migration));
  assert.match(result.stdout, /PASS helper grant twice/);
  assert.match(result.stdout, /ROLLBACK/);
  const rolledBack = sql("select has_function_privilege('authenticated','private.clair_queue_permission_for_destination(text,text)','EXECUTE');");
  assert.match(rolledBack.stdout, /\n f\s*\n/);
  console.log("PASS: missing-grant reproduction; candidate apply/reapply; authorized row; foreign/inactive/missing-capability denial; direct-write denial; unchanged RLS/table ACL; no anon/service grant; rollback");
} finally {
  if (owned) command(["rm", "--force", "--volumes", container]);
}
