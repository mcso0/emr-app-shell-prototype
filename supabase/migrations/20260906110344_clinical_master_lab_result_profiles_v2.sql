-- OED-LAB04: explicit immutable profiles; no range/device selection fallback.
set lock_timeout='5s';
set statement_timeout='120s';

create function private.clair_lab_profile_rule_valid(r jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $f$
declare k text; bounds jsonb;
begin
  if jsonb_typeof(r) is distinct from 'object' or length(btrim(r->>'testMasterKey')) not between 1 and 200
    or length(btrim(r->>'code')) not between 1 and 100 or r->>'resultValueKind' not in ('numeric','text','coded')
    or jsonb_typeof(r->'supported') is distinct from 'boolean'
    or jsonb_typeof(r->'unit') not in ('null','string') or (jsonb_typeof(r->'unit')='string' and length(btrim(r->>'unit')) not between 1 and 100)
    or jsonb_typeof(r->'decimalScale') not in ('null','number')
    or (jsonb_typeof(r->'decimalScale')='number' and ((r->>'decimalScale')::numeric<>trunc((r->>'decimalScale')::numeric) or (r->>'decimalScale')::numeric not between 0 and 9))
    or r->>'referenceStatus' not in ('source_found','synthetic_functional_fixture','not_applicable','unavailable')
    or jsonb_typeof(r->'provenance') is distinct from 'object'
    or jsonb_typeof(r->'codes') is distinct from 'array' then return false; end if;
  if not r ?& array['testMasterKey','code','resultValueKind','unit','decimalScale','supported','numericMin','numericMax','referenceInterval','displayRange','codes','referenceStatus','provenance'] then return false; end if;
  foreach k in array array['numericMin','numericMax'] loop
    if jsonb_typeof(r->k) not in ('number','null') then return false; end if;
  end loop;
  if jsonb_typeof(r->'numericMin')='number' and jsonb_typeof(r->'numericMax')='number'
    and (r->>'numericMin')::numeric>(r->>'numericMax')::numeric then return false; end if;
  foreach k in array array['referenceInterval','displayRange'] loop
    bounds:=r->k;
    if bounds<>'null'::jsonb and (jsonb_typeof(bounds) is distinct from 'object'
      or jsonb_typeof(bounds->'low') is distinct from 'number' or jsonb_typeof(bounds->'high') is distinct from 'number'
      or (bounds->>'low')::numeric>(bounds->>'high')::numeric) then return false; end if;
  end loop;
  if r->'referenceInterval'<>'null'::jsonb and (r#>'{referenceInterval,lowInclusive}' is distinct from 'true'::jsonb
    or r#>'{referenceInterval,highInclusive}' is distinct from 'true'::jsonb) then return false; end if;
  if jsonb_array_length(r->'codes')>100 or exists(select 1 from jsonb_array_elements(r->'codes') c
    where jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'code') is distinct from 'string'
      or length(btrim(c->>'code')) not between 1 and 100 or jsonb_typeof(c->'label') is distinct from 'string'
      or length(btrim(c->>'label')) not between 1 and 200 or c->>'judgment' not in ('low','normal','high','critical','abnormal','not_judged')
      or not c ? 'judgment') then return false; end if;
  if (select count(distinct value->>'code') from jsonb_array_elements(r->'codes'))<>jsonb_array_length(r->'codes') then return false; end if;
  if r->>'resultValueKind'='numeric' then return jsonb_array_length(r->'codes')=0; end if;
  return r->'referenceInterval'='null'::jsonb and r->'displayRange'='null'::jsonb
    and r->'numericMin'='null'::jsonb and r->'numericMax'='null'::jsonb and r->'decimalScale'='null'::jsonb
    and (r->>'resultValueKind'<>'coded' or jsonb_array_length(r->'codes')>0);
exception when others then return false;
end $f$;
revoke all on function private.clair_lab_profile_rule_valid(jsonb) from public,anon,authenticated,service_role;

create function private.clair_lab_result_profile_valid(p jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,private as $f$
begin
  if jsonb_typeof(p) is distinct from 'object' or p->'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(p->'revision') is distinct from 'number' or (p->>'revision')::numeric<1
    or (p->>'revision')::numeric<>trunc((p->>'revision')::numeric)
    or not p ?& array['id','profileKey','name','species','specimenMasterKey','method','device','dataOrigin','provenance']
    or exists(select 1 from unnest(array['id','profileKey','name','specimenMasterKey','method']) k
      where jsonb_typeof(p->k) is distinct from 'string' or length(btrim(p->>k)) not between 1 and 4000)
    or p->>'species' not in ('dog','cat') or p->>'entryMode' is distinct from 'manual_entry'
    or p->>'integrationStatus' is distinct from 'not_integrated' or p->'clinicalUseAllowed' is distinct from 'false'::jsonb
    or p->>'clinicalValidation' is distinct from 'not_clinically_validated'
    or p->>'dataOrigin' not in ('synthetic_research_informed','synthetic_functional_fixture')
    or jsonb_typeof(p->'provenance') is distinct from 'object' or jsonb_typeof(p->'device') is distinct from 'object'
    or not (p->'device') ?& array['manufacturer','model','kind']
    or jsonb_typeof(p#>'{device,manufacturer}') is distinct from 'string' or length(btrim(p#>>'{device,manufacturer}')) not between 1 and 200
    or jsonb_typeof(p#>'{device,model}') is distinct from 'string' or length(btrim(p#>>'{device,model}')) not between 1 and 200
    or p#>>'{device,kind}' not in ('manual','analyzer_reference') or jsonb_typeof(p->'rules') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p->'rules') not between 1 and 200 or exists(select 1 from jsonb_array_elements(p->'rules') r
    where not private.clair_lab_profile_rule_valid(r)) then return false; end if;
  return (select count(distinct value->>'testMasterKey') from jsonb_array_elements(p->'rules'))=jsonb_array_length(p->'rules')
    and (select count(distinct value->>'code') from jsonb_array_elements(p->'rules'))=jsonb_array_length(p->'rules');
exception when others then return false;
end $f$;
revoke all on function private.clair_lab_result_profile_valid(jsonb) from public,anon,authenticated,service_role;

create table master.lab_result_profile_versions (
  id uuid primary key, profile_key text not null, revision integer not null check(revision>0),
  release_id uuid not null references master.master_releases(id) on delete restrict,
  definition jsonb not null check(private.clair_lab_result_profile_valid(definition)),
  definition_sha256 text not null check(definition_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(), unique(profile_key,revision),
  check(definition->>'id'=id::text and definition->>'profileKey'=profile_key and (definition->>'revision')::integer=revision),
  check(definition_sha256=private.clinical_master_sha256(definition))
);
revoke all on master.lab_result_profile_versions from public,anon,authenticated,service_role;
create function private.clair_guard_lab_profile_history() returns trigger
language plpgsql security definer set search_path=pg_catalog as $f$
begin raise exception 'lab_profile_version_immutable' using errcode='55000'; end $f$;
revoke all on function private.clair_guard_lab_profile_history() from public,anon,authenticated,service_role;
create trigger lab_profile_version_immutable before update or delete on master.lab_result_profile_versions
  for each row execute function private.clair_guard_lab_profile_history();

create table public.workspace_lab_devices (
  id uuid primary key default gen_random_uuid(), workspace_id text not null references public.workspaces(id) on delete restrict,
  name text not null check(length(btrim(name)) between 1 and 200), manufacturer text not null, model text not null,
  kind text not null check(kind in ('manual','analyzer_reference')), entry_mode text not null default 'manual_entry' check(entry_mode='manual_entry'),
  integration_status text not null default 'not_integrated' check(integration_status='not_integrated'),
  active boolean not null default true, row_revision integer not null default 1 check(row_revision>0),
  created_by_user_id uuid not null references public.users(id), created_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create table public.workspace_lab_result_profile_bindings (
  workspace_id text not null, order_catalog_item_id text not null, species text not null check(species in ('dog','cat')),
  device_id uuid not null, profile_version_id uuid not null references master.lab_result_profile_versions(id) on delete restrict,
  row_revision integer not null default 1 check(row_revision>0), selected_by_user_id uuid not null references public.users(id),
  selected_at timestamptz not null default now(), primary key(workspace_id,order_catalog_item_id,species),
  foreign key(workspace_id,order_catalog_item_id) references public.order_catalog_items(workspace_id,id) on delete restrict,
  foreign key(workspace_id,device_id) references public.workspace_lab_devices(workspace_id,id) on delete restrict
);
alter table public.workspace_lab_devices enable row level security;
alter table public.workspace_lab_result_profile_bindings enable row level security;
revoke all on public.workspace_lab_devices,public.workspace_lab_result_profile_bindings from public,anon,authenticated,service_role;

-- Requirement is pinned to the adopted master order revision, not inferred by name.
create table master.lab_order_result_requirements (
  master_order_record_id uuid not null, master_order_revision integer not null,
  requires_profile boolean not null check(requires_profile), primary key(master_order_record_id,master_order_revision),
  foreign key(master_order_record_id,master_order_revision) references master.master_record_versions(master_record_id,revision) on delete restrict
);
revoke all on master.lab_order_result_requirements from public,anon,authenticated,service_role;
create trigger lab_result_requirement_immutable before update or delete on master.lab_order_result_requirements
  for each row execute function private.clair_guard_lab_profile_history();

alter table public.orders add column selected_lab_profile_version_id uuid references master.lab_result_profile_versions(id) on delete restrict;
alter table public.orders add column selected_lab_device_id uuid;
alter table public.orders add constraint order_lab_device_scope foreign key(workspace_id,selected_lab_device_id)
  references public.workspace_lab_devices(workspace_id,id) on delete restrict;
alter table public.orders add constraint order_lab_profile_pair check((selected_lab_profile_version_id is null)=(selected_lab_device_id is null));

create function private.clair_evaluate_lab_profile_value(r jsonb,p_value text,p_qualifier text default 'exact',p_device_flag text default null,p_state text default 'value') returns jsonb
language plpgsql immutable set search_path=pg_catalog as $f$
declare v text:=nullif(btrim(p_value),''); n numeric; c jsonb; state text; judgment text;
begin
  if not coalesce((r->>'supported')::boolean,false) then raise exception 'unsupported_parameter'; end if;
  if p_qualifier is null or p_qualifier not in ('exact','less_than','greater_than') or p_state is null or p_state not in ('value','instrument_no_result')
    or (p_device_flag is not null and length(btrim(p_device_flag)) not between 1 and 200) then raise exception 'invalid_result_metadata'; end if;
  if p_state='instrument_no_result' then
    if v is not null or p_qualifier<>'exact' or p_device_flag is not null then raise exception 'invalid_result_metadata'; end if;
    return jsonb_build_object('state','instrument_no_result','judgment','not_judged','value',null);
  end if;
  if v is null then
    if p_qualifier<>'exact' or p_device_flag is not null then raise exception 'invalid_result_metadata'; end if;
    return jsonb_build_object('state','not_entered','judgment','not_judged','value',null);
  end if;
  if length(v)>4096 then raise exception 'invalid_text'; end if;
  if r->>'resultValueKind'<>'numeric' then
    if p_qualifier<>'exact' or p_device_flag is not null then raise exception 'invalid_result_metadata'; end if;
    if r->>'resultValueKind'='text' then return jsonb_build_object('state','recorded_without_interval','judgment','not_judged','value',v); end if;
    select value into c from jsonb_array_elements(r->'codes') where value->>'code'=v;
    if not found then raise exception 'invalid_code'; end if;
    return jsonb_build_object('state','recorded','judgment',c->>'judgment','value',v);
  end if;
  if v !~ '^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' then raise exception 'invalid_number'; end if;
  n:=v::numeric;
  if (r->>'numericMin' is not null and n<(r->>'numericMin')::numeric) or (r->>'numericMax' is not null and n>(r->>'numericMax')::numeric) then raise exception 'invalid_number'; end if;
  if p_qualifier<>'exact' then state:='qualified_result';
  elsif p_device_flag is not null then state:='flagged_result';
  elsif r->'displayRange'<>'null'::jsonb and (n<(r#>>'{displayRange,low}')::numeric or n>(r#>>'{displayRange,high}')::numeric) then state:='outside_documented_display_range';
  elsif r->'referenceInterval'='null'::jsonb then state:='recorded_without_interval';
  else state:='recorded'; end if;
  judgment:=case when state<>'recorded' then 'not_judged' when n<(r#>>'{referenceInterval,low}')::numeric then 'low'
    when n>(r#>>'{referenceInterval,high}')::numeric then 'high' else 'normal' end;
  return jsonb_build_object('state',state,'judgment',judgment,'value',v);
end $f$;
revoke all on function private.clair_evaluate_lab_profile_value(jsonb,text,text,text,text) from public,anon,authenticated,service_role;

create function private.clair_freeze_lab_result_profile(p_workspace_id text,p_order_id uuid,s jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare o public.orders; profile master.lab_result_profile_versions; device public.workspace_lab_devices;
  v_patient_species text; row jsonb; rule jsonb; rows jsonb:='[]'; master_key text; specimen_key text;
begin
  select * into strict o from public.orders where workspace_id=p_workspace_id and id=p_order_id;
  if o.selected_lab_profile_version_id is null then
    if exists(select 1 from master.lab_order_result_requirements q where q.master_order_record_id=o.source_master_record_id
      and q.master_order_revision=o.source_master_revision and q.requires_profile) then raise exception 'lab_result_profile_selection_required'; end if;
    return s;
  end if;
  select * into strict profile from master.lab_result_profile_versions where id=o.selected_lab_profile_version_id;
  select * into device from public.workspace_lab_devices where workspace_id=p_workspace_id and id=o.selected_lab_device_id and active;
  if not found then raise exception 'lab_result_device_unavailable'; end if;
  if device.model is distinct from profile.definition#>>'{device,model}'
    or device.manufacturer is distinct from profile.definition#>>'{device,manufacturer}'
    or device.kind is distinct from profile.definition#>>'{device,kind}' then raise exception 'lab_result_device_profile_mismatch'; end if;
  select p.species into v_patient_species from public.patients p join public.encounters e on e.workspace_id=p.workspace_id and e.patient_id=p.id
    where e.workspace_id=p_workspace_id and e.id=o.encounter_id;
  if v_patient_species is distinct from profile.definition->>'species' then raise exception 'lab_result_profile_species_mismatch'; end if;
  if not exists(select 1 from public.workspace_lab_result_profile_bindings b where b.workspace_id=p_workspace_id
    and b.order_catalog_item_id=o.workspace_catalog_item_id and b.species=v_patient_species
    and b.profile_version_id=profile.id and b.device_id=device.id) then raise exception 'lab_result_profile_binding_required'; end if;
  select m.master_key into specimen_key from master.master_records m where m.id=nullif(s#>>'{source,profile,specimenTypeRecordId}','')::uuid;
  if specimen_key is distinct from profile.definition->>'specimenMasterKey' then raise exception 'lab_result_profile_specimen_mismatch'; end if;
  for row in select value from jsonb_array_elements(s->'rows') loop
    select m.master_key into master_key from master.master_records m where m.id=nullif(row->>'sourceMasterTestRecordId','')::uuid;
    select value into rule from jsonb_array_elements(profile.definition->'rules') r(value) where value->>'testMasterKey'=master_key;
    if not found or rule->'supported' is distinct from 'true'::jsonb then raise exception 'lab_result_profile_parameter_unsupported'; end if;
    if rule->>'resultValueKind' is distinct from row->>'resultValueKind' then raise exception 'lab_result_profile_kind_mismatch'; end if;
    rows:=rows||jsonb_build_array(row||jsonb_build_object('unit',rule->'unit','decimalScale',rule->'decimalScale',
      'referenceRange',case when rule->'referenceInterval'='null'::jsonb then null else
        (rule#>>'{referenceInterval,low}')||'–'||(rule#>>'{referenceInterval,high}') end,'interpretationRule',rule));
  end loop;
  return s||jsonb_build_object('schemaVersion',2,'rows',rows,'resultProfile',jsonb_build_object(
    'versionId',profile.id,'profileKey',profile.profile_key,'revision',profile.revision,'definitionSha256',profile.definition_sha256,
    'species',v_patient_species,'specimenMasterKey',specimen_key,'method',profile.definition->'method','dataOrigin',profile.definition->'dataOrigin',
    'clinicalUseAllowed',false,'clinicalValidation','not_clinically_validated','entryMode','manual_entry','integrationStatus','not_integrated',
    'device',jsonb_build_object('id',device.id,'name',device.name,'manufacturer',device.manufacturer,'model',device.model,'kind',device.kind)));
end $f$;
revoke all on function private.clair_freeze_lab_result_profile(text,uuid,jsonb) from public,anon,authenticated,service_role;

-- Exact snapshot assertion retains every existing source/link/version check.
-- V2 adds a separate equipment/reference profile, never overwriting source.profile.
create function private.clair_assert_lab_result_profile_snapshot(p_workspace_id text,s jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare profile master.lab_result_profile_versions; row jsonb; rule jsonb; test_key text; chosen jsonb:=s->'resultProfile';
begin
  if s->>'schemaVersion'<>'2' then return; end if;
  select * into profile from master.lab_result_profile_versions where id=(chosen->>'versionId')::uuid;
  if not found or chosen->>'definitionSha256' is distinct from profile.definition_sha256
    or chosen->>'profileKey' is distinct from profile.profile_key or (chosen->>'revision')::integer is distinct from profile.revision
    or chosen->>'species' is distinct from profile.definition->>'species' or chosen->>'specimenMasterKey' is distinct from profile.definition->>'specimenMasterKey'
    or chosen->>'method' is distinct from profile.definition->>'method' or chosen->>'dataOrigin' is distinct from profile.definition->>'dataOrigin'
    or chosen->'clinicalUseAllowed' is distinct from 'false'::jsonb or chosen->>'clinicalValidation' is distinct from 'not_clinically_validated'
    or chosen->>'entryMode' is distinct from 'manual_entry' or chosen->>'integrationStatus' is distinct from 'not_integrated'
    or not exists(select 1 from public.workspace_lab_devices d where d.workspace_id=p_workspace_id and d.id=(chosen#>>'{device,id}')::uuid) then
    raise exception 'lab_result_definition_snapshot_invalid'; end if;
  for row in select value from jsonb_array_elements(s->'rows') loop
    select master_key into test_key from master.master_records where id=(row->>'sourceMasterTestRecordId')::uuid;
    select value into rule from jsonb_array_elements(profile.definition->'rules') r(value) where value->>'testMasterKey'=test_key;
    if not found or row->'interpretationRule' is distinct from rule or rule->'supported' is distinct from 'true'::jsonb
      or row->'unit' is distinct from rule->'unit' or row->'decimalScale' is distinct from rule->'decimalScale'
      or row->>'resultValueKind' is distinct from rule->>'resultValueKind'
      or row->>'referenceRange' is distinct from (case when rule->'referenceInterval'='null'::jsonb then null else
        (rule#>>'{referenceInterval,low}')||'–'||(rule#>>'{referenceInterval,high}') end) then raise exception 'lab_result_definition_snapshot_invalid'; end if;
  end loop;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'lab_result_definition_snapshot_invalid';
end $f$;
revoke all on function private.clair_assert_lab_result_profile_snapshot(text,jsonb) from public,anon,authenticated,service_role;

alter table public.lab_result_entry_rows add column result_presence text not null default 'value' check(result_presence in ('value','instrument_no_result'));
alter table public.lab_result_entries drop constraint lab_result_entries_abnormal_flag_check;
alter table public.lab_result_entries add constraint lab_result_entries_abnormal_flag_check check(abnormal_flag in ('low','normal','high','critical','abnormal','not_judged'));
alter table public.lab_result_entry_rows drop constraint lab_result_entry_rows_judgment_check;
alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_judgment_check check(judgment in ('low','normal','high','critical','abnormal','not_judged'));
alter table public.lab_result_entry_rows add column result_qualifier text not null default 'exact' check(result_qualifier in ('exact','less_than','greater_than'));
alter table public.lab_result_entry_rows add column device_flag text check(device_flag is null or length(btrim(device_flag)) between 1 and 200);
alter table public.lab_result_entry_rows add column result_state text not null default 'not_entered'
  check(result_state in ('not_entered','recorded','recorded_without_interval','instrument_no_result','qualified_result','flagged_result','outside_documented_display_range'));

create function private.clair_derive_lab_result_profile_value() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare snapshot jsonb; rule jsonb; evaluated jsonb;
begin
  select result_definition_snapshot into snapshot from public.lab_result_entries where workspace_id=new.workspace_id and id=new.lab_result_entry_id;
  if snapshot->>'schemaVersion' is distinct from '2' then return new; end if;
  select value->'interpretationRule' into rule from jsonb_array_elements(snapshot->'rows') where value->>'rowId'=new.row_id;
  if not found then raise exception 'lab_result_row_not_found'; end if;
  evaluated:=private.clair_evaluate_lab_profile_value(rule,new.result_value,new.result_qualifier,new.device_flag,new.result_presence);
  new.result_value:=evaluated->>'value'; new.result_state:=evaluated->>'state'; new.judgment:=evaluated->>'judgment';
  return new;
end $f$;
revoke all on function private.clair_derive_lab_result_profile_value() from public,anon,authenticated,service_role;
create trigger aa_lab_result_derive_profile_value before insert or update on public.lab_result_entry_rows
  for each row execute function private.clair_derive_lab_result_profile_value();

do $patch$
declare d text; old text; replacement text;
begin
  d:=pg_get_functiondef('private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)'::regprocedure);
  old:='  insert into public.lab_result_entries(workspace_id,result_id,encounter_id,order_id,result_status,result_payload,abnormal_flag,entry_write_revision,';
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_freeze_anchor_mismatch'; end if;
  d:=replace(d,old,E'  v_snapshot := private.clair_freeze_lab_result_profile(p_workspace_id,p_order_id,v_snapshot);\n  v_rows := v_snapshot->''rows'';\n'||old);
  old:=$a$v_row->>'analyteName',null,v_row->>'unit',null,'not_judged'$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_row_freeze_anchor_mismatch'; end if;
  execute replace(d,old,$a$v_row->>'analyteName',null,v_row->>'unit',v_row->>'referenceRange','not_judged'$a$);

  d:=pg_get_functiondef('private.clair_assert_lab_result_definition_snapshot(text,uuid)'::regprocedure);
  d:=replace(d,$a$array['rows','schemaVersion','source']::text[]$a$,$a$(case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then array['resultProfile','rows','schemaVersion','source'] else array['rows','schemaVersion','source'] end)::text[]$a$);
  d:=replace(d,$a$v_entry.result_definition_snapshot->>'schemaVersion' <> '1'$a$,$a$v_entry.result_definition_snapshot->>'schemaVersion' not in ('1','2')$a$);
  d:=replace(d,$a$v_source := v_entry.result_definition_snapshot->'source';$a$,$a$v_source := v_entry.result_definition_snapshot->'source';
  if v_entry.result_definition_snapshot->>'schemaVersion'='2' then
    perform private.clair_assert_lab_result_profile_snapshot(p_workspace_id,v_entry.result_definition_snapshot);
    select array_agg(key order by key) into v_expected_keys from unnest(v_expected_keys||array['interpretationRule']) key;
  end if;$a$);
  d:=replace(d,$a$coalesce(jsonb_typeof(v_row->'referenceRange'),'missing') <> 'null'$a$,$a$(case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then coalesce(jsonb_typeof(v_row->'referenceRange'),'missing') not in ('null','string') else coalesce(jsonb_typeof(v_row->'referenceRange'),'missing') <> 'null' end)$a$);
  d:=replace(d,$a$or v_row->>'referenceRange' is not null$a$,$a$or (v_entry.result_definition_snapshot->>'schemaVersion'='1' and v_row->>'referenceRange' is not null)$a$);
  d:=replace(d,$a$or v_stored.reference_range is not null$a$,$a$or v_stored.reference_range is distinct from v_row->>'referenceRange'$a$);
  old:=$a$or v_stored.judgment is distinct from 'not_judged'$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_snapshot_assert_anchor_mismatch'; end if;
  replacement:=$a$or v_stored.judgment is distinct from (case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then
    private.clair_evaluate_lab_profile_value(v_row->'interpretationRule',v_stored.result_value,v_stored.result_qualifier,v_stored.device_flag,v_stored.result_presence)->>'judgment' else 'not_judged' end)
       or (v_entry.result_definition_snapshot->>'schemaVersion'='2' and v_stored.result_state is distinct from
    private.clair_evaluate_lab_profile_value(v_row->'interpretationRule',v_stored.result_value,v_stored.result_qualifier,v_stored.device_flag,v_stored.result_presence)->>'state')$a$;
  execute replace(d,old,replacement);

  d:=pg_get_functiondef('private.clair_guard_canonical_lab_result_row_definition()'::regprocedure);
  d:=replace(d,'declare v_origin text;','declare v_origin text; v_schema text;');
  d:=replace(d,'select result_definition_origin into v_origin','select result_definition_origin, result_definition_snapshot->>''schemaVersion'' into v_origin,v_schema');
  old:='or NEW.judgment is distinct from OLD.judgment';
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_row_guard_anchor_mismatch'; end if;
  execute replace(d,old,'or (v_schema is distinct from ''2'' and NEW.judgment is distinct from OLD.judgment)');
end $patch$;

create table master.lab_result_profile_release_payloads (
  release_id uuid primary key references master.master_releases(id), payload_sha256 text not null,
  payload jsonb not null, created_at timestamptz not null default now(),
  check(payload_sha256=private.clinical_master_sha256(payload))
);
revoke all on master.lab_result_profile_release_payloads from public,anon,authenticated,service_role;
create trigger lab_profile_release_payload_immutable before update or delete on master.lab_result_profile_release_payloads
  for each row execute function private.clair_guard_lab_profile_history();
alter function private.publish_clinical_master_release(jsonb,uuid) rename to publish_clinical_master_release_before_lab_profiles;
create function private.publish_clinical_master_release(p_payload jsonb,p_actor_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare result jsonb; v_release_id uuid; existing_release uuid; extra jsonb; profile jsonb; saved master.lab_result_profile_versions;
  key text; record master.master_records; saved_hash text;
begin
  if not (p_payload ? 'labResultProfiles' or p_payload ? 'labResultProfileOrderKeys') then
    return private.publish_clinical_master_release_before_lab_profiles(p_payload,p_actor_user_id); end if;
  if jsonb_typeof(p_payload->'labResultProfiles') is distinct from 'array' or jsonb_array_length(p_payload->'labResultProfiles') not between 1 and 200
    or jsonb_typeof(p_payload->'labResultProfileOrderKeys') is distinct from 'array' or jsonb_array_length(p_payload->'labResultProfileOrderKeys') not between 1 and 300
    or exists(select 1 from jsonb_array_elements(p_payload->'labResultProfiles') p where not private.clair_lab_result_profile_valid(p))
    or exists(select 1 from jsonb_array_elements(p_payload->'labResultProfileOrderKeys') k where jsonb_typeof(k)<>'string' or length(btrim(k#>>'{}'))=0) then
    raise exception 'invalid_lab_result_profile_release'; end if;
  extra:=jsonb_build_object('labResultProfiles',p_payload->'labResultProfiles','labResultProfileOrderKeys',p_payload->'labResultProfileOrderKeys');
  select id into existing_release from master.master_releases where release_key=p_payload->>'releaseKey';
  result:=private.publish_clinical_master_release_before_lab_profiles(p_payload-array['labResultProfiles','labResultProfileOrderKeys'],p_actor_user_id);
  v_release_id:=(result->>'releaseId')::uuid;
  select payload_sha256 into saved_hash from master.lab_result_profile_release_payloads x where x.release_id=v_release_id;
  if found then
    if saved_hash is distinct from private.clinical_master_sha256(extra) then raise exception 'lab_result_profile_release_retry_conflict'; end if;
    return result||jsonb_build_object('labResultProfileCount',jsonb_array_length(p_payload->'labResultProfiles'));
  end if;
  if existing_release is not null then raise exception 'lab_result_profile_release_late_attachment'; end if;
  for profile in select value from jsonb_array_elements(p_payload->'labResultProfiles') loop
    if exists(select 1 from jsonb_array_elements(profile->'rules') r where not exists(select 1 from master.master_records m
      where m.master_key=r->>'testMasterKey' and m.record_type='lab_test')) then raise exception 'lab_result_profile_test_missing'; end if;
    select * into saved from master.lab_result_profile_versions where profile_key=profile->>'profileKey' and revision=(profile->>'revision')::integer;
    if found then
      if saved.id is distinct from (profile->>'id')::uuid or saved.definition is distinct from profile then raise exception 'lab_profile_version_conflict'; end if;
    else
      insert into master.lab_result_profile_versions(id,profile_key,revision,release_id,definition,definition_sha256)
      values((profile->>'id')::uuid,profile->>'profileKey',(profile->>'revision')::integer,v_release_id,profile,private.clinical_master_sha256(profile));
    end if;
  end loop;
  for key in select value#>>'{}' from jsonb_array_elements(p_payload->'labResultProfileOrderKeys') loop
    if not exists(select 1 from jsonb_array_elements(p_payload->'records') r where r->>'masterKey'=key and r->>'recordType'='order') then
      raise exception 'lab_result_requirement_not_in_release'; end if;
    select * into strict record from master.master_records where master_key=key and record_type='order';
    insert into master.lab_order_result_requirements(master_order_record_id,master_order_revision,requires_profile)
      values(record.id,record.current_revision,true) on conflict do nothing;
  end loop;
  insert into master.lab_result_profile_release_payloads values(v_release_id,private.clinical_master_sha256(extra),extra,now());
  return result||jsonb_build_object('labResultProfileCount',jsonb_array_length(p_payload->'labResultProfiles'));
end $f$;
revoke all on function private.publish_clinical_master_release(jsonb,uuid) from public,anon,authenticated,service_role;

create table public.workspace_lab_profile_events (
  id uuid primary key default gen_random_uuid(), workspace_id text not null references public.workspaces(id),
  actor_user_id uuid not null references public.users(id), event_type text not null,
  target_id text not null, before_snapshot jsonb, after_snapshot jsonb not null, created_at timestamptz not null default now()
);
alter table public.workspace_lab_profile_events enable row level security;
revoke all on public.workspace_lab_profile_events from public,anon,authenticated,service_role;
create trigger workspace_lab_profile_events_immutable before update or delete on public.workspace_lab_profile_events
  for each row execute function private.clair_guard_lab_profile_history();

create function public.clair_register_workspace_lab_device(p_workspace_id text,p_id uuid,p_name text,p_profile_version_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare profile master.lab_result_profile_versions; d public.workspace_lab_devices;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 200 then raise exception 'invalid_lab_device'; end if;
  select * into strict profile from master.lab_result_profile_versions where id=p_profile_version_id;
  select * into d from public.workspace_lab_devices where workspace_id=p_workspace_id and id=p_id for update;
  if found then
    if d.name is distinct from btrim(p_name) or d.model is distinct from profile.definition#>>'{device,model}'
      or d.manufacturer is distinct from profile.definition#>>'{device,manufacturer}' then raise exception 'lab_device_identity_conflict'; end if;
    return to_jsonb(d);
  end if;
  insert into public.workspace_lab_devices(id,workspace_id,name,manufacturer,model,kind,created_by_user_id)
    values(p_id,p_workspace_id,btrim(p_name),profile.definition#>>'{device,manufacturer}',profile.definition#>>'{device,model}',profile.definition#>>'{device,kind}',auth.uid()) returning * into d;
  insert into public.workspace_lab_profile_events(workspace_id,actor_user_id,event_type,target_id,after_snapshot)
    values(p_workspace_id,auth.uid(),'device_registered',d.id::text,to_jsonb(d));
  return to_jsonb(d);
end $f$;
revoke all on function public.clair_register_workspace_lab_device(text,uuid,text,uuid) from public,anon,service_role;
grant execute on function public.clair_register_workspace_lab_device(text,uuid,text,uuid) to authenticated;

create function public.clair_bind_workspace_lab_result_profile(p_workspace_id text,p_catalog_item_id text,p_profile_version_id uuid,p_device_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare profile master.lab_result_profile_versions; device public.workspace_lab_devices; prior public.workspace_lab_result_profile_bindings; bound public.workspace_lab_result_profile_bindings;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid_expected_revision'; end if;
  perform 1 from public.order_catalog_items where workspace_id=p_workspace_id and id=p_catalog_item_id and clinical_order_type in ('clinical_lab','external_lab') for update;
  if not found then raise exception 'catalog_item_not_found'; end if;
  select * into strict profile from master.lab_result_profile_versions where id=p_profile_version_id;
  select * into device from public.workspace_lab_devices where workspace_id=p_workspace_id and id=p_device_id and active;
  if not found or device.model is distinct from profile.definition#>>'{device,model}' or device.manufacturer is distinct from profile.definition#>>'{device,manufacturer}'
    or device.kind is distinct from profile.definition#>>'{device,kind}' then raise exception 'lab_result_device_profile_mismatch'; end if;
  if not exists(select 1 from public.order_catalog_lab_test_item_links l where l.workspace_id=p_workspace_id and l.order_catalog_item_id=p_catalog_item_id)
    or exists(select 1 from public.order_catalog_lab_test_item_links l join master.master_records m on m.id=l.source_master_test_record_id
      where l.workspace_id=p_workspace_id and l.order_catalog_item_id=p_catalog_item_id and not exists(
        select 1 from jsonb_array_elements(profile.definition->'rules') r where r->>'testMasterKey'=m.master_key and r->'supported'='true'::jsonb)) then
    raise exception 'lab_result_profile_parameter_unsupported'; end if;
  select * into prior from public.workspace_lab_result_profile_bindings where workspace_id=p_workspace_id and order_catalog_item_id=p_catalog_item_id
    and species=profile.definition->>'species' for update;
  if found and prior.profile_version_id=p_profile_version_id and prior.device_id=p_device_id then return to_jsonb(prior); end if;
  if coalesce(prior.row_revision,0)<>p_expected_revision then raise exception 'lab_profile_binding_revision_conflict'; end if;
  insert into public.workspace_lab_result_profile_bindings(workspace_id,order_catalog_item_id,species,device_id,profile_version_id,row_revision,selected_by_user_id)
    values(p_workspace_id,p_catalog_item_id,profile.definition->>'species',p_device_id,p_profile_version_id,coalesce(prior.row_revision,0)+1,auth.uid())
    on conflict(workspace_id,order_catalog_item_id,species) do update set device_id=excluded.device_id,profile_version_id=excluded.profile_version_id,
      row_revision=excluded.row_revision,selected_by_user_id=excluded.selected_by_user_id,selected_at=now() returning * into bound;
  insert into public.workspace_lab_profile_events(workspace_id,actor_user_id,event_type,target_id,before_snapshot,after_snapshot)
    values(p_workspace_id,auth.uid(),'profile_bound',p_catalog_item_id,to_jsonb(prior),to_jsonb(bound));
  return to_jsonb(bound);
end $f$;
revoke all on function public.clair_bind_workspace_lab_result_profile(text,text,uuid,uuid,integer) from public,anon,service_role;
grant execute on function public.clair_bind_workspace_lab_result_profile(text,text,uuid,uuid,integer) to authenticated;

create function public.clair_select_lab_order_result_profile(p_workspace_id text,p_order_id uuid,p_expected_updated_at timestamptz,p_profile_version_id uuid,p_device_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare o public.orders; before_value jsonb; v_patient_species text;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update') then raise exception 'permission_missing' using errcode='42501'; end if;
  select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id for update;
  if not found or o.clinical_order_type not in ('clinical_lab','external_lab') then raise exception 'order_unavailable'; end if;
  if o.order_confirmation_status<>'draft' then raise exception 'confirmed_lab_profile_immutable'; end if;
  select p.species into v_patient_species from public.patients p join public.encounters e on e.workspace_id=p.workspace_id and e.patient_id=p.id
    where e.workspace_id=p_workspace_id and e.id=o.encounter_id;
  if not exists(select 1 from public.workspace_lab_result_profile_bindings b join public.workspace_lab_devices d on d.workspace_id=b.workspace_id and d.id=b.device_id
    where b.workspace_id=p_workspace_id and b.order_catalog_item_id=o.workspace_catalog_item_id and b.species=v_patient_species
      and b.profile_version_id=p_profile_version_id and b.device_id=p_device_id and d.active) then raise exception 'lab_result_profile_binding_required'; end if;
  if o.selected_lab_profile_version_id=p_profile_version_id and o.selected_lab_device_id=p_device_id then return jsonb_build_object('orderId',o.id,'updatedAt',o.updated_at); end if;
  if o.updated_at is distinct from p_expected_updated_at then raise exception 'order_revision_conflict'; end if;
  before_value:=jsonb_build_object('profileVersionId',o.selected_lab_profile_version_id,'deviceId',o.selected_lab_device_id);
  update public.orders set selected_lab_profile_version_id=p_profile_version_id,selected_lab_device_id=p_device_id,updated_at=clock_timestamp()
    where workspace_id=p_workspace_id and id=p_order_id returning * into o;
  insert into public.workspace_lab_profile_events(workspace_id,actor_user_id,event_type,target_id,before_snapshot,after_snapshot)
    values(p_workspace_id,auth.uid(),'order_profile_selected',o.id::text,before_value,jsonb_build_object('profileVersionId',p_profile_version_id,'deviceId',p_device_id));
  return jsonb_build_object('orderId',o.id,'updatedAt',o.updated_at);
end $f$;
revoke all on function public.clair_select_lab_order_result_profile(text,uuid,timestamptz,uuid,uuid) from public,anon,service_role;
grant execute on function public.clair_select_lab_order_result_profile(text,uuid,timestamptz,uuid,uuid) to authenticated;

create function private.clair_guard_order_lab_profile_selection() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,master as $f$
begin
  if tg_op='UPDATE' and old.order_confirmation_status<>'draft' then
    if new.selected_lab_profile_version_id is distinct from old.selected_lab_profile_version_id
      or new.selected_lab_device_id is distinct from old.selected_lab_device_id then raise exception 'confirmed_lab_profile_immutable'; end if;
    return new;
  end if;
  if tg_op='INSERT' and new.selected_lab_profile_version_id is null and new.clinical_order_type in ('clinical_lab','external_lab') then
    -- The unique persisted catalog/species binding is an explicit workspace choice.
    -- It seeds new requests only; it never changes an existing or confirmed pin.
    select b.profile_version_id,b.device_id into new.selected_lab_profile_version_id,new.selected_lab_device_id
    from public.workspace_lab_result_profile_bindings b join public.workspace_lab_devices d on d.workspace_id=b.workspace_id and d.id=b.device_id and d.active
    join public.encounters e on e.workspace_id=b.workspace_id and e.id=new.encounter_id
    join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id and p.species=b.species
    where b.workspace_id=new.workspace_id and b.order_catalog_item_id=new.workspace_catalog_item_id;
  end if;
  if new.selected_lab_profile_version_id is not null and not exists(
    select 1 from public.workspace_lab_result_profile_bindings b
    join public.workspace_lab_devices d on d.workspace_id=b.workspace_id and d.id=b.device_id and d.active
    join master.lab_result_profile_versions v on v.id=b.profile_version_id
    join public.encounters e on e.workspace_id=b.workspace_id and e.id=new.encounter_id
    join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id and p.species=b.species
    where b.workspace_id=new.workspace_id and b.order_catalog_item_id=new.workspace_catalog_item_id
      and b.profile_version_id=new.selected_lab_profile_version_id and b.device_id=new.selected_lab_device_id
      and new.clinical_order_type in ('clinical_lab','external_lab')
      and v.definition->>'species'=p.species and d.model=v.definition#>>'{device,model}'
      and d.manufacturer=v.definition#>>'{device,manufacturer}' and d.kind=v.definition#>>'{device,kind}'
  ) then raise exception 'lab_result_profile_binding_required'; end if;
  return new;
end $f$;
revoke all on function private.clair_guard_order_lab_profile_selection() from public,anon,authenticated,service_role;
create trigger orders_lab_profile_selection_guard before insert or update on public.orders for each row execute function private.clair_guard_order_lab_profile_selection();

create function private.clair_lab_result_aggregate_judgment(p_workspace_id text,p_entry_id uuid) returns text
language sql stable set search_path=pg_catalog,public as $f$
  select case when bool_or(judgment='critical') then 'critical' when bool_or(judgment='abnormal') then 'abnormal'
    when bool_or(judgment='high') then 'high' when bool_or(judgment='low') then 'low'
    when bool_and(judgment='normal') then 'normal' else 'not_judged' end
  from public.lab_result_entry_rows where workspace_id=p_workspace_id and lab_result_entry_id=p_entry_id;
$f$;
revoke all on function private.clair_lab_result_aggregate_judgment(text,uuid) from public,anon,authenticated,service_role;

do $patch$
declare d text; old text;
begin
  d:=pg_get_functiondef('public.clair_save_lab_result_entry_v2(text,uuid,text,uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure);
  old:=$a$if jsonb_typeof(v_row) <> 'object' or (select count(*) from jsonb_object_keys(v_row)) <> 3 or exists(select 1 from jsonb_object_keys(v_row) key where key not in ('rowId','value','note')) then raise exception 'invalid_lab_result_entry_payload'; end if;$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_writer_payload_anchor_mismatch'; end if;
  d:=replace(d,old,$a$if jsonb_typeof(v_row) <> 'object' or not v_row ?& array['rowId','value','note']
      or exists(select 1 from jsonb_object_keys(v_row) key where key not in ('rowId','value','note','qualifier','deviceFlag','resultState'))
      or (v_entry.result_definition_snapshot->>'schemaVersion'<>'2' and (select count(*) from jsonb_object_keys(v_row))<>3)
      or (v_row ? 'qualifier' and (jsonb_typeof(v_row->'qualifier') is distinct from 'string' or v_row->>'qualifier' not in ('exact','less_than','greater_than')))
      or (v_row ? 'resultState' and (jsonb_typeof(v_row->'resultState') is distinct from 'string' or v_row->>'resultState' not in ('value','instrument_no_result')))
      or (v_row ? 'deviceFlag' and (jsonb_typeof(v_row->'deviceFlag') not in ('null','string') or (jsonb_typeof(v_row->'deviceFlag')='string' and length(btrim(v_row->>'deviceFlag')) not between 1 and 200)))
      then raise exception 'invalid_lab_result_entry_payload'; end if;$a$);
  old:=$a$v_normalized := v_normalized || jsonb_build_array(jsonb_build_object('rowId',v_id,'value',case when jsonb_typeof(v_row->'value')='null' then null else v_row->>'value' end,'note',case when jsonb_typeof(v_row->'note')='null' then null else v_row->>'note' end));$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_writer_normalize_anchor_mismatch'; end if;
  d:=replace(d,old,$a$v_normalized := v_normalized || jsonb_build_array(jsonb_build_object('rowId',v_id,'value',case when jsonb_typeof(v_row->'value')='null' then null else v_row->>'value' end,'note',case when jsonb_typeof(v_row->'note')='null' then null else v_row->>'note' end)
      ||case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then jsonb_build_object('qualifier',coalesce(v_row->>'qualifier','exact'),'deviceFlag',nullif(btrim(v_row->>'deviceFlag'),''),'resultState',coalesce(v_row->>'resultState','value')) else '{}'::jsonb end);$a$);
  old:=$a$,judgment='not_judged',updated_at=now() where workspace_id=p_workspace_id and lab_result_entry_id=v_entry.id and row_id=v_row->>'rowId';$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_writer_update_anchor_mismatch'; end if;
  d:=replace(d,old,$a$,judgment='not_judged',result_presence=coalesce(v_row->>'resultState','value'),result_qualifier=coalesce(v_row->>'qualifier','exact'),device_flag=v_row->>'deviceFlag',updated_at=now() where workspace_id=p_workspace_id and lab_result_entry_id=v_entry.id and row_id=v_row->>'rowId';$a$);
  d:=replace(d,$a$entry_write_revision=v_next_revision,abnormal_flag='not_judged'$a$,$a$entry_write_revision=v_next_revision,abnormal_flag=case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then private.clair_lab_result_aggregate_judgment(p_workspace_id,v_entry.id) else 'not_judged' end$a$);
  execute d;
  d:=pg_get_functiondef('private.clair_serialize_lab_result_entry(text,uuid)'::regprocedure);
  d:=replace(d,$a$'abnormalFlag','not_judged'$a$,$a$'abnormalFlag',v_entry.abnormal_flag$a$);
  old:=$a$'workspaceResultRevision',row.workspace_result_revision$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_profile_serializer_anchor_mismatch'; end if;
  d:=replace(d,old,$a$'workspaceResultRevision',row.workspace_result_revision,
    'resultState',case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then row.result_state else null end,
    'resultPresence',case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then row.result_presence else null end,
    'qualifier',case when v_entry.result_definition_snapshot->>'schemaVersion'='2' then row.result_qualifier else null end,
    'deviceFlag',row.device_flag,
    'interpretationRule',(select r->'interpretationRule' from jsonb_array_elements(v_entry.result_definition_snapshot->'rows') r where r->>'rowId'=row.row_id)$a$);
  execute d;
end $patch$;

create function private.clair_guard_lab_profile_completion() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $f$
declare entry public.lab_result_entries;
begin
  if new.task_role<>'execution' or new.clinical_order_type not in ('clinical_lab','external_lab')
    or new.status<>'complete' or old.status='complete' then return new; end if;
  select * into entry from public.lab_result_entries where workspace_id=new.workspace_id and order_id=new.order_id and result_definition_origin='canonical';
  if not found or entry.result_definition_snapshot->>'schemaVersion' is distinct from '2' then return new; end if;
  if entry.result_status not in ('entered','reviewed','corrected') or exists(select 1 from public.lab_result_entry_rows r
    where r.workspace_id=new.workspace_id and r.lab_result_entry_id=entry.id and r.required
      and (r.result_state not in ('recorded','recorded_without_interval') or r.result_value is null or r.result_value='not_performed')) then
    raise exception 'required_lab_results_incomplete'; end if;
  return new;
end $f$;
revoke all on function private.clair_guard_lab_profile_completion() from public,anon,authenticated,service_role;
create trigger order_tasks_lab_profile_completion before update on public.order_tasks for each row execute function private.clair_guard_lab_profile_completion();

create function public.clair_get_lab_result_profile_configuration(p_workspace_id text,p_order_id uuid default null,p_catalog_item_id text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare o public.orders; catalog_id text:=p_catalog_item_id; v_patient_species text; profile_rows jsonb; devices jsonb; bindings jsonb; order_info jsonb:=null;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,case when p_order_id is null then 'service_catalog:view' else 'chart:view' end) then raise exception 'permission_missing' using errcode='42501'; end if;
  if p_order_id is not null then
    select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id and clinical_order_type in ('clinical_lab','external_lab');
    if not found then raise exception 'order_unavailable'; end if;
    if p_catalog_item_id is not null and p_catalog_item_id is distinct from o.workspace_catalog_item_id then raise exception 'catalog_item_not_found'; end if;
    catalog_id:=o.workspace_catalog_item_id;
    select p.species into v_patient_species from public.patients p join public.encounters e on e.workspace_id=p.workspace_id and e.patient_id=p.id
      where e.workspace_id=p_workspace_id and e.id=o.encounter_id;
    order_info:=jsonb_build_object('id',o.id,'updatedAt',o.updated_at,'confirmationStatus',o.order_confirmation_status,'species',v_patient_species,
      'selectedProfileVersionId',o.selected_lab_profile_version_id,'selectedDeviceId',o.selected_lab_device_id,
      'requiresProfile',exists(select 1 from master.lab_order_result_requirements q where q.master_order_record_id=o.source_master_record_id and q.master_order_revision=o.source_master_revision));
  elsif catalog_id is not null and not exists(select 1 from public.order_catalog_items c where c.workspace_id=p_workspace_id and c.id=catalog_id and c.clinical_order_type in ('clinical_lab','external_lab')) then
    raise exception 'catalog_item_not_found';
  end if;
  select coalesce(jsonb_agg(v.definition order by v.profile_key,v.revision),'[]'::jsonb) into profile_rows from master.lab_result_profile_versions v
    where p_order_id is null or v.id=o.selected_lab_profile_version_id or exists(select 1 from public.workspace_lab_result_profile_bindings b
      where b.workspace_id=p_workspace_id and b.order_catalog_item_id=catalog_id and b.species=v_patient_species and b.profile_version_id=v.id);
  select coalesce(jsonb_agg(to_jsonb(d) order by d.name,d.id),'[]'::jsonb) into devices from public.workspace_lab_devices d where d.workspace_id=p_workspace_id;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.order_catalog_item_id,b.species),'[]'::jsonb) into bindings from public.workspace_lab_result_profile_bindings b
    where b.workspace_id=p_workspace_id and (catalog_id is null or b.order_catalog_item_id=catalog_id) and (p_order_id is null or b.species=v_patient_species);
  return jsonb_build_object('workspaceId',p_workspace_id,'catalogItemId',catalog_id,'order',order_info,
    'canConfigure',private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage'),
    'canSelect',p_order_id is not null and o.order_confirmation_status='draft' and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update'),
    'canRetest',p_order_id is not null and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update') and private.clair_current_user_has_workspace_permission(p_workspace_id,'lab:view'),
    'profiles',profile_rows,'devices',devices,'bindings',bindings);
end $f$;
revoke all on function public.clair_get_lab_result_profile_configuration(text,uuid,text) from public,anon,service_role;
grant execute on function public.clair_get_lab_result_profile_configuration(text,uuid,text) to authenticated;
