-- Additive actual fields; historical V1 planned and actual records are untouched.
set lock_timeout='5s';
set statement_timeout='120s';

alter function private.clair_execution_result_payload_valid(text,jsonb)
  rename to clair_execution_result_payload_before_treatment_v2;
create function private.clair_execution_result_payload_valid(p_type text,p_payload jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public,private as $f$
declare extra text[]:=array['performedCount','performedCountUnit','measurementValue','measurementUnit',
  'deviceIdentity','deviceSettingsPolicy','deviceParameters','observations','materialIdentity']; k text; pair text[]; e jsonb;
begin
  if p_type<>'treatment' then return private.clair_execution_result_payload_before_treatment_v2(p_type,p_payload); end if;
  if octet_length(p_payload::text)>32000 or not private.clair_execution_result_payload_before_treatment_v2(p_type,p_payload-extra) then return false; end if;
  foreach pair slice 1 in array array[['performedCount','performedCountUnit'],['measurementValue','measurementUnit']] loop
    if (p_payload ? pair[1]) is distinct from (p_payload ? pair[2]) then return false; end if;
  end loop;
  foreach k in array array['performedCount','measurementValue'] loop
    if p_payload ? k and (jsonb_typeof(p_payload->k) is distinct from 'number'
      or (p_payload->>k)::numeric not between (case k when 'performedCount' then 0 else -1000000 end) and 1000000) then return false; end if;
  end loop;
  foreach k in array array['performedCountUnit','measurementUnit','deviceIdentity','deviceSettingsPolicy','materialIdentity'] loop
    if p_payload ? k and (jsonb_typeof(p_payload->k) is distinct from 'string' or length(btrim(p_payload->>k)) not between 1 and 4000) then return false; end if;
  end loop;
  if p_payload ? 'deviceSettingsPolicy' and p_payload->>'deviceSettingsPolicy' not in ('recorded_parameters','not_adjustable') then return false; end if;
  if p_payload->>'deviceSettingsPolicy'='recorded_parameters' and not p_payload ? 'deviceParameters' then return false; end if;
  if p_payload->>'deviceSettingsPolicy'='not_adjustable' and p_payload ? 'deviceParameters' then return false; end if;
  if p_payload ? 'deviceParameters' then
    if jsonb_typeof(p_payload->'deviceParameters') is distinct from 'array' then return false; end if;
    if jsonb_array_length(p_payload->'deviceParameters') not between 1 and 100 then return false; end if;
    for e in select value from jsonb_array_elements(p_payload->'deviceParameters') loop
      if jsonb_typeof(e) is distinct from 'object' then return false; end if;
      if (select count(*) from jsonb_object_keys(e))<>3 or jsonb_typeof(e->'name') is distinct from 'string'
        or length(btrim(e->>'name')) not between 1 and 200 or jsonb_typeof(e->'unit') is distinct from 'string'
        or length(btrim(e->>'unit')) not between 1 and 200 or jsonb_typeof(e->'value') is distinct from 'number'
        or abs((e->>'value')::numeric)>1000000 then return false; end if;
    end loop;
    if (select count(distinct btrim(value->>'name')) from jsonb_array_elements(p_payload->'deviceParameters'))<>jsonb_array_length(p_payload->'deviceParameters') then return false; end if;
  end if;
  if p_payload ? 'observations' then
    if jsonb_typeof(p_payload->'observations') is distinct from 'array' then return false; end if;
    if jsonb_array_length(p_payload->'observations') not between 1 and 100 or exists(select 1 from jsonb_array_elements(p_payload->'observations') e
      where jsonb_typeof(e) is distinct from 'string' or length(btrim(e#>>'{}')) not between 1 and 200) then return false; end if;
  end if;
  return true;
exception when others then return false;
end $f$;
revoke all on function private.clair_execution_result_payload_valid(text,jsonb) from public,anon,authenticated,service_role;

create function private.clair_guard_treatment_actual_v2() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare p jsonb:=new.plan_snapshot->'detailInputs'; a jsonb:=new.payload; differs boolean:=false;
begin
  if new.clinical_order_type<>'treatment' then return new; end if;
  if not private.clair_execution_result_payload_valid('treatment',a) then raise exception 'invalid_execution_payload'; end if;
  if new.plan_snapshot->>'detailSchemaVersion' is distinct from '2' then return new; end if;
  if not a ? 'performedCount'
    or (p->>'procedureKind'='measurement' and not a ? 'measurementValue')
    or (p ? 'deviceProtocol' and p->>'procedureKind'<>'monitoring' and (not a ? 'deviceIdentity' or not a ? 'deviceSettingsPolicy'))
    or (p->>'procedureKind'='monitoring' and not a ? 'observations')
    or (p->>'administrationPolicy'='direct_quantity' and (not a ? 'materialIdentity' or not a ? 'administeredAmount')) then
    raise exception 'invalid_execution_payload'; end if;
  differs:=(a->'performedCount' is distinct from p->'plannedProcedureCount')
    or (a->>'performedCountUnit' is distinct from p->>'procedureCountUnit')
    or (a ? 'measurementValue' and a->>'measurementUnit' is distinct from p->>'measurementUnit');
  if a ? 'administeredAmount' then differs:=differs or a->'administeredAmount' is distinct from p->'plannedAmount'
    or a->>'administeredUnit' is distinct from p->>'plannedAmountUnit'; end if;
  if differs and nullif(btrim(new.variance_reason),'') is null then raise exception 'variance_reason_required'; end if;
  return new;
end $f$;
revoke all on function private.clair_guard_treatment_actual_v2() from public,anon,authenticated,service_role;
create trigger order_execution_treatment_actual_v2 before insert on public.order_execution_result_versions
  for each row execute function private.clair_guard_treatment_actual_v2();
