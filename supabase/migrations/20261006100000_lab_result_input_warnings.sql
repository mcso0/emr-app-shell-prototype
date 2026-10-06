-- Lab-only input warnings. No master, historical row, RLS, RPC or completion-policy backfill.
set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.lab_result_entry_rows drop constraint lab_result_entry_rows_result_state_check;
alter table public.lab_result_entry_rows add constraint lab_result_entry_rows_result_state_check
  check (result_state in ('not_entered','recorded','recorded_without_interval','instrument_no_result',
    'qualified_result','flagged_result','outside_documented_display_range','invalid_numeric_format',
    'outside_input_range','unrecognized_code','unsupported_qualifier'));

-- Preserve the existing validator and reject malformed optional qualifier permission lists.
do $patch$
declare d text; anchor text; addition text;
begin
  d := pg_get_functiondef('private.clair_lab_profile_rule_valid(jsonb)'::regprocedure);
  anchor := $a$if r->>'resultValueKind'='numeric' then return jsonb_array_length(r->'codes')=0; end if;$a$;
  addition := $a$-- lab_result_allowed_qualifiers_v1
  if r ? 'allowedQualifiers' then
    if r->>'resultValueKind'<>'numeric' or jsonb_typeof(r->'allowedQualifiers') is distinct from 'array' then return false; end if;
    if jsonb_array_length(r->'allowedQualifiers') not between 1 and 3 or not (r->'allowedQualifiers') @> '["exact"]'::jsonb
      or exists(select 1 from jsonb_array_elements(r->'allowedQualifiers') q
        where jsonb_typeof(q)<>'string' or q#>>'{}' not in ('exact','less_than','greater_than'))
      or (select count(distinct q) from jsonb_array_elements(r->'allowedQualifiers') q)<>jsonb_array_length(r->'allowedQualifiers') then return false; end if;
  end if;
  $a$;
  if position('lab_result_allowed_qualifiers_v1' in d)=0 then
    if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'lab_rule_qualifier_anchor_mismatch'; end if;
    execute replace(d,anchor,addition||anchor);
  end if;
end $patch$;

-- Shared token normalization keeps raw storage and the existing completion exclusion aligned.
create or replace function private.clair_lab_result_value_token(p_value text) returns text
language sql immutable set search_path=pg_catalog as $f$
  select nullif(btrim(p_value,E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)),'');
$f$;
revoke all on function private.clair_lab_result_value_token(text) from public,anon,authenticated,service_role;

create or replace function private.clair_evaluate_lab_profile_value(r jsonb,p_value text,p_qualifier text default 'exact',p_device_flag text default null,p_state text default 'value') returns jsonb
language plpgsql immutable set search_path=pg_catalog as $f$
declare v text:=private.clair_lab_result_value_token(p_value); n numeric; c jsonb; state text; judgment text;
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
  if length(p_value)>4096 then raise exception 'invalid_text'; end if;
  if r->>'resultValueKind'<>'numeric' then
    if p_qualifier<>'exact' or p_device_flag is not null then raise exception 'invalid_result_metadata'; end if;
    if r->>'resultValueKind'='text' then return jsonb_build_object('state','recorded_without_interval','judgment','not_judged','value',p_value); end if;
    select value into c from jsonb_array_elements(r->'codes') where value->>'code'=v;
    if not found then return jsonb_build_object('state','unrecognized_code','judgment','not_judged','value',p_value); end if;
    return jsonb_build_object('state','recorded','judgment',c->>'judgment','value',p_value);
  end if;
  if v !~ '^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' then
    return jsonb_build_object('state','invalid_numeric_format','judgment','not_judged','value',p_value);
  end if;
  -- Match JS finite Number conversion; retain arbitrarily large raw values as warnings.
  begin
    perform v::double precision;
  exception when numeric_value_out_of_range then
    if abs(v::numeric)<1 then null;
    else return jsonb_build_object('state','invalid_numeric_format','judgment','not_judged','value',p_value); end if;
  end;
  n:=v::numeric;
  if (r->>'numericMin' is not null and n<(r->>'numericMin')::numeric)
    or (r->>'numericMax' is not null and n>(r->>'numericMax')::numeric) then
    return jsonb_build_object('state','outside_input_range','judgment','not_judged','value',p_value);
  end if;
  if r ? 'allowedQualifiers' and not (r->'allowedQualifiers') @> jsonb_build_array(p_qualifier) then
    return jsonb_build_object('state','unsupported_qualifier','judgment','not_judged','value',p_value);
  end if;
  if p_qualifier<>'exact' then state:='qualified_result';
  elsif p_device_flag is not null then state:='flagged_result';
  elsif r->'displayRange'<>'null'::jsonb and (n<(r#>>'{displayRange,low}')::numeric or n>(r#>>'{displayRange,high}')::numeric) then state:='outside_documented_display_range';
  elsif r->'referenceInterval'='null'::jsonb then state:='recorded_without_interval';
  else state:='recorded'; end if;
  judgment:=case when state<>'recorded' then 'not_judged' when n<(r#>>'{referenceInterval,low}')::numeric then 'low'
    when n>(r#>>'{referenceInterval,high}')::numeric then 'high' else 'normal' end;
  return jsonb_build_object('state',state,'judgment',judgment,'value',p_value);
end $f$;
revoke all on function private.clair_evaluate_lab_profile_value(jsonb,text,text,text,text) from public,anon,authenticated,service_role;

-- Preserve completion policy; whitespace in the retained raw code cannot bypass it.
create or replace function private.clair_guard_lab_profile_completion() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $f$
declare entry public.lab_result_entries;
begin
  if new.task_role<>'execution' or new.clinical_order_type not in ('clinical_lab','external_lab')
    or new.status<>'complete' or old.status='complete' then return new; end if;
  select * into entry from public.lab_result_entries where workspace_id=new.workspace_id and order_id=new.order_id and result_definition_origin='canonical';
  if not found or entry.result_definition_snapshot->>'schemaVersion' is distinct from '2' then return new; end if;
  if entry.result_status not in ('entered','reviewed','corrected') or exists(select 1 from public.lab_result_entry_rows r
    where r.workspace_id=new.workspace_id and r.lab_result_entry_id=entry.id and r.required
      and (r.result_state not in ('recorded','recorded_without_interval') or r.result_value is null or private.clair_lab_result_value_token(r.result_value)='not_performed')) then
    raise exception 'required_lab_results_incomplete'; end if;
  return new;
end $f$;
revoke all on function private.clair_guard_lab_profile_completion() from public,anon,authenticated,service_role;
