// Dedicated local synthetic DB only. Never accepts a hosted database URL.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const role = Number(value("--role", "1"));
const date = value("--date", "2026-10-03");
if (!Number.isInteger(role) || role < 1 || role > 6 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid local proof arguments");
const legacy = args.includes("--legacy");
const completed = args.includes("--completed");
const cancelled = args.includes("--cancelled");
const container = process.env.HOME_TEST_DOCKER_CONTAINER ?? "supabase_db_emr-app-shell-prototype";
if (!/^[a-zA-Z0-9_-]+$/.test(container)) throw new Error("Invalid local Docker container");
const guard = "do $$begin if current_database() <> 'item5_synthetic' then raise exception 'requires item5_synthetic local database'; end if; end$$;";
const actor = `99500000-0000-4000-8000-${String(role).padStart(12, "0")}`;
const seeding = args.includes("--seed");
const sql = seeding
  ? ["BEGIN;", "SET LOCAL client_min_messages = error;", guard,
    readFileSync("tests/sql/home_scoped_read_fixture.sql", "utf8"),
    readFileSync("tests/sql/home_scoped_read_edges.sql", "utf8"), "COMMIT;"].join("\n")
  : `BEGIN;
${guard}
set local role authenticated;
do $$begin perform set_config('request.jwt.claim.sub','${actor}',true); end$$;
create temporary table item5_export(data jsonb);
do $$
declare
  v_sources jsonb := '{}'; v_page jsonb; v_fulfillment jsonb := '{}';
  v_table text; v_queue text; v_offset integer := 0; v_exhausted boolean;
  v_calls integer := 0; v_bytes bigint := 0;
  v_call_started timestamptz; v_elapsed numeric := 0;
begin
  ${legacy ? `loop
    v_call_started := clock_timestamp();
    v_page := public.clair_get_home_operations_source_snapshot('home-local-proof',v_offset,500);
    v_elapsed := v_elapsed + extract(epoch from clock_timestamp()-v_call_started)*1000;
    v_calls := v_calls+1; v_bytes := v_bytes+octet_length(v_page::text); v_exhausted := true;
    foreach v_table in array array['appointments','encounters','waiting_queue_entries','patients','guardians','invoices','invoice_lines','orders','user_memberships'] loop
      v_sources := jsonb_set(v_sources,array[v_table],coalesce(v_sources->v_table,'[]') || (v_page->v_table));
      if jsonb_array_length(v_page->v_table) >= 500 then v_exhausted := false; end if;
    end loop;
    exit when v_exhausted;
    v_offset := v_offset+500;
  end loop;` : `v_call_started := clock_timestamp();
    v_sources := public.clair_get_home_operations_source_snapshot_v2('home-local-proof','${date}',${completed},${cancelled});
    v_elapsed := v_elapsed + extract(epoch from clock_timestamp()-v_call_started)*1000;
    v_calls := 1; v_bytes := octet_length(v_sources::text);`}
  foreach v_queue in array array['lab','imaging','dispensing','treatment'] loop
    if private.clair_current_user_has_workspace_permission('home-local-proof',
      case when v_queue = 'treatment' then 'dispensing:view' else v_queue || ':view' end) then
      v_call_started := clock_timestamp();
      v_page := ${legacy ? "public.clair_list_fulfillment_work_items('home-local-proof',v_queue)" : `public.clair_list_home_fulfillment_work_items('home-local-proof',v_queue,'${date}',${completed},${cancelled})`};
      v_elapsed := v_elapsed + extract(epoch from clock_timestamp()-v_call_started)*1000;
      v_calls := v_calls+1; v_bytes := v_bytes+octet_length(v_page::text);
      v_fulfillment := jsonb_set(v_fulfillment,array[v_queue],v_page);
    end if;
  end loop;
  insert into item5_export values(jsonb_build_object('sources',v_sources,'fulfillment',v_fulfillment,
    'measurement',jsonb_build_object('rpcCalls',v_calls,'postgresJsonTextBytes',v_bytes,
      'sqlElapsedMs',v_elapsed)));
end$$;
select data from item5_export;
ROLLBACK;`;

const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", "item5_synthetic", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
if (result.error) throw result.error;
if (result.status !== 0) { process.stderr.write(result.stderr ?? ""); process.exit(result.status ?? 1); }
if (seeding) { console.log("PASS dedicated local synthetic Home fixture seeded"); }
else if (args.includes("--output")) {
  const data = JSON.parse(result.stdout);
  writeFileSync(value("--output"), JSON.stringify(data));
  console.log(JSON.stringify(data.measurement));
} else process.stdout.write(result.stdout);
