import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const container = `public-security-${process.pid}`;
const image = "postgres:17-alpine";
const sources = [
  "supabase/seed.sql",
  "supabase/snippets/den-468-491_cheongdam_master_seed.sql",
  "supabase/snippets/workspace_creator_profile_preservation_replay.sql",
  "supabase/migrations/20260702142317_cheongdam_realistic_roster_remote_backfill.sql",
  "supabase/migrations/20260702152054_20260702142317_cheongdam_realistic_roster_remote_backfill.sql",
].map((path) => readFileSync(path, "utf8"));
for (const source of sources) {
  assert.doesNotMatch(source, /\bcrypt\s*\(\s*'/i);
  assert.doesNotMatch(source, /encrypted_password\s*=\s*excluded\.encrypted_password/i);
}
const inserts = sources.flatMap((sql) => {
  const variables = [...sql.matchAll(/\b(v_\w+)\s+uuid\s*:=\s*'([0-9a-f-]{36})'/gi)];
  return (sql.match(/insert into auth\.users\s*\([\s\S]*?;/gi) ?? []).map((statement) => {
    for (const [,name,value] of variables) statement = statement.replaceAll(new RegExp(`\\b${name}\\b`, "g"), `'${value}'::uuid`);
    return statement;
  });
}).join("\n");
assert.ok(inserts.includes("extensions.gen_random_bytes(32)"));
const rotation = readFileSync("supabase/migrations/20261017060638_rotate_published_demo_credentials.sql", "utf8");
const revoke = readFileSync("supabase/migrations/20261017060654_revoke_legacy_lab_result_getter.sql", "utf8");
const original = readFileSync("supabase/migrations/20260609112000_lab_result_entry_persistence.sql", "utf8");
const b1 = readFileSync("supabase/migrations/20260819172501_clinical_master_phase1b1_laboratory_slice.sql", "utf8");
function between(sql, start, end) {
  const a = sql.indexOf(start), b = sql.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing SQL boundary: ${start}`);
  return sql.slice(a, b);
}
const legacy = between(original, "create or replace function public.clair_get_lab_result_entry(", "grant execute on function public.clair_save_lab_result_entry");
const guarded = between(b1, "create or replace function public.clair_get_lab_result_entry(\n  p_workspace_id text,\n  p_actor_user_id uuid,", "-- Compatibility getter used only");
const compatibility = between(b1, "-- Compatibility getter used only", "-- A1's inline type check");
const rename = b1.match(/alter function public\.clair_get_lab_result_entry\(text,text,uuid,uuid\)\s+rename to clair_get_lab_result_entry_legacy_base;/)?.[0];
assert.ok(rename);
const sql = `
begin;
create schema extensions; create extension pgcrypto with schema extensions;
create schema auth; create schema private; create schema master;
create schema supabase_migrations;
create role anon; create role authenticated; create role service_role;
grant usage on schema public,auth to anon,authenticated,service_role;
create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,
  email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz);
create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id));
create table auth.refresh_tokens(user_id text,session_id uuid references auth.sessions(id) on delete cascade);
create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
create table public.user_memberships(id uuid default gen_random_uuid(),user_id uuid,workspace_id text,roles text[],status text);
create table public.workspace_permission_roles(id uuid,workspace_id text,status text,role_type text);
create table public.workspace_membership_permission_role_assignments(membership_id uuid,workspace_id text,permission_role_id uuid);
${inserts}
create temp table seed_hashes as select id,encrypted_password from auth.users;
${inserts}
do $check$ begin
  if exists(select 1 from auth.users u join seed_hashes h using(id) where u.encrypted_password is distinct from h.encrypted_password)
  then raise exception 'seed replay overwrote existing password'; end if;
  if exists(select 1 from auth.users where encrypted_password is null or encrypted_password='')
  then raise exception 'new seed password missing'; end if;
end $check$;

create temp table test_secret as select encode(extensions.gen_random_bytes(24),'hex') as value;
insert into supabase_migrations.schema_migrations(version,statements)
select '20260702142317',array[format('select extensions.%s(%L,salt);','crypt',value)] from test_secret;
update auth.users set encrypted_password=extensions.crypt((select value from test_secret),extensions.gen_salt('bf'));
insert into public.user_memberships(user_id,workspace_id,roles,status)
values('00000000-0000-4000-8000-000000000001','workspace-contract',array['hospital_admin'],'active');
insert into auth.users(id,email,encrypted_password) values('eeeeeeee-1111-4111-8111-111111111111','personal@example.invalid',
  extensions.crypt(encode(extensions.gen_random_bytes(24),'hex'),extensions.gen_salt('bf')));
insert into auth.sessions(user_id) select id from auth.users;
insert into auth.refresh_tokens(user_id,session_id) select user_id::text,id from auth.sessions;
savepoint manually_rotated_first_apply;
update auth.users set encrypted_password=extensions.crypt(encode(extensions.gen_random_bytes(24),'hex'),extensions.gen_salt('bf'));
${rotation}
do $check$ begin
  if exists(select 1 from auth.sessions where user_id<>'eeeeeeee-1111-4111-8111-111111111111')
    or (select count(*) from auth.refresh_tokens)<>1
  then raise exception 'first apply missed sessions after manual password changes'; end if;
end $check$;
rollback to savepoint manually_rotated_first_apply;
do $guard_check$ begin
  begin
    execute $rotation_sql$${rotation}$rotation_sql$;
    raise exception 'rotation unexpectedly removed the last usable administrator';
  exception when sqlstate '55000' then
    if sqlerrm <> 'rotation_requires_unexposed_admin' then raise; end if;
  end;
end $guard_check$;
update auth.users set encrypted_password=extensions.crypt(encode(extensions.gen_random_bytes(24),'hex'),extensions.gen_salt('bf'))
where id='00000000-0000-4000-8000-000000000001';
create temp table preserved_hashes as select id,encrypted_password from auth.users
where id in('00000000-0000-4000-8000-000000000001','eeeeeeee-1111-4111-8111-111111111111');
${rotation}
do $check$ begin
  if exists(select 1 from auth.users u cross join test_secret s where extensions.crypt(s.value,u.encrypted_password)=u.encrypted_password)
  then raise exception 'published password still authenticates'; end if;
  if exists(select 1 from auth.users u join preserved_hashes h using(id) where u.encrypted_password<>h.encrypted_password)
  then raise exception 'private credential changed'; end if;
  if exists(select 1 from auth.sessions where user_id<>'eeeeeeee-1111-4111-8111-111111111111')
  then raise exception 'old demo session remains'; end if;
  if (select count(*) from auth.refresh_tokens)<>1 then raise exception 'refresh-token scope failed'; end if;
end $check$;
insert into supabase_migrations.schema_migrations(version,name) values('20261017060638','rotate_published_demo_credentials');
insert into auth.sessions(user_id) values('00000000-0000-4000-8000-000000000001');
${rotation}
do $check$ begin
  if (select count(*) from auth.sessions)<>2 then raise exception 'reapply revoked a new session'; end if;
end $check$;
select 'PASS credential_provisioning_rotation_and_replay';

create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function private.clair_is_active_workspace_member(p_workspace text) returns boolean language sql as
$$select p_workspace='workspace-contract' and coalesce(current_setting('test.active',true),'false')='true'$$;
create function private.clair_current_user_has_workspace_permission(p_workspace text,p_permission text) returns boolean language sql as
$$select p_workspace='workspace-contract' and p_permission='lab:view' and coalesce(current_setting('test.lab_view',true),'false')='true'$$;
create table public.lab_result_entries(id uuid primary key,workspace_id text,result_id text,work_item_id uuid,order_id uuid,
  encounter_id uuid,result_status text,abnormal_flag text,entered_by_user_id uuid,created_at timestamptz,updated_at timestamptz,result_payload jsonb);
create table public.lab_result_entry_rows(lab_result_entry_id uuid,row_id text,lab_test_item_id uuid,analyte_name text,
  result_value text,result_unit text,reference_range text,judgment text,note text,sort_order int);
insert into public.lab_result_entries(id,workspace_id,result_id,updated_at,result_payload)
values('dddddddd-1111-4111-8111-111111111111','workspace-contract','result-contract',now(),'{"synthetic":true}');
create function private.clair_assert_lab_result_definition_snapshot(text,uuid) returns void language plpgsql as $$begin null; end$$;
create function private.clair_serialize_lab_result_entry(p_workspace text,p_id uuid) returns jsonb language sql as
$$select jsonb_build_object('ok',true,'savedResult',result_payload) from public.lab_result_entries where id=p_id and workspace_id=p_workspace$$;
${legacy}
grant execute on function public.clair_get_lab_result_entry(text,text,uuid,uuid) to authenticated;
${rename}
${guarded}
${compatibility}
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local test.active='true'; set local test.lab_view='false';
set local role authenticated;
do $check$ begin
  if public.clair_get_lab_result_entry_legacy_base('workspace-contract',null,null,null)->'savedResult' is null
  then raise exception 'baseline bypass did not reproduce'; end if;
end $check$;
reset role;
${revoke}
${revoke}
do $check$ begin
  if has_function_privilege('anon','public.clair_get_lab_result_entry_legacy_base(text,text,uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.clair_get_lab_result_entry_legacy_base(text,text,uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.clair_get_lab_result_entry_legacy_base(text,text,uuid,uuid)','EXECUTE')
  then raise exception 'client legacy ACL remains'; end if;
end $check$;
set local role authenticated;
do $check$ begin
  begin
    perform public.clair_get_lab_result_entry_legacy_base('workspace-contract','result-contract',null,null);
    raise exception 'explicit selector bypass remains';
  exception when insufficient_privilege then null; end;
  begin
    perform public.clair_get_lab_result_entry_legacy_base('workspace-contract',null,null,null);
    raise exception 'null selector bypass remains';
  exception when insufficient_privilege then null; end;
  begin
    perform public.clair_get_lab_result_entry('workspace-contract',auth.uid(),'result-contract',null,null);
    raise exception 'guarded getter allows non-viewer';
  exception when raise_exception then if sqlerrm<>'permission_missing' then raise; end if; end;
end $check$;
set local test.lab_view='true';
do $check$ begin
  if public.clair_get_lab_result_entry('workspace-contract',auth.uid(),'result-contract',null,null)
    <> '{"ok":true,"savedResult":{"synthetic":true}}'::jsonb
  then raise exception 'permitted result payload changed'; end if;
  begin
    perform public.clair_get_lab_result_entry('workspace-contract'::text,'result-contract'::text,null::uuid,null::uuid);
    raise exception 'owner-only wrapper is directly callable';
  exception when insufficient_privilege then null; end;
end $check$;
reset role;
create function public.test_internal_compat() returns jsonb language sql security definer as
$$select public.clair_get_lab_result_entry('workspace-contract'::text,'result-contract'::text,null::uuid,null::uuid)$$;
set local role authenticated;
do $check$ begin
  if public.test_internal_compat()<>'{"ok":true,"savedResult":{"synthetic":true}}'::jsonb
  then raise exception 'owner compatibility path changed'; end if;
end $check$;
reset role;
select 'PASS legacy_getter_denial_and_permitted_compatibility';
rollback;
`;

function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.slice(-4000));
  return result.stdout;
}
let owned = false;
try {
  docker(["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_PASSWORD=synthetic-local-test",image]);
  owned = true;
  assert.equal(docker(["inspect","--format","{{.HostConfig.NetworkMode}}",container]).trim(), "none");
  for (let i=0;i<30;i++) {
    if (spawnSync("docker",["exec",container,"pg_isready","-h","127.0.0.1","-U","postgres"],{stdio:"ignore"}).status===0) break;
    await new Promise((resolve)=>setTimeout(resolve,1000));
  }
  const output = docker(["exec","-i",container,"psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],sql);
  assert.ok(output.includes("PASS credential_provisioning_rotation_and_replay"));
  assert.ok(output.includes("PASS legacy_getter_denial_and_permitted_compatibility"));
  assert.ok(output.includes("ROLLBACK"));
  console.log("PASS: actual SQL seed/replay preserves private hashes; last-admin guard, rotation/session scope, idempotence, legacy bypass denial, allowed getter and owner compatibility; isolated rollback");
} finally {
  if (owned) docker(["stop",container]);
}
