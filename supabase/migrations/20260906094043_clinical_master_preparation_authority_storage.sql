-- Persist calculation/product authority as a typed atomic catalog-default field.
-- It is stripped from clinical detail inputs and projected separately from the
-- exact catalog row into new snapshots. No client can set snapshot authority.
create function private.clair_plan_order_authority_is_valid(a jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $fn$
declare mode text:=a->>'calculationMode'; p jsonb:=a->'preparationPolicy'; r jsonb:=a->'productReference';
  s jsonb:=a->'productStrength'; x jsonb; k text;
begin
  if jsonb_typeof(a) is distinct from 'object' or octet_length(a::text)>16384
    or a->>'schemaVersion' not in ('1','2') or jsonb_typeof(a->'schemaVersion') is distinct from 'number'
    or coalesce(mode,'') not in ('ingredient_based','fixed_product','product_unit','not_applicable')
    or exists(select 1 from jsonb_object_keys(a) key where key not in
      ('schemaVersion','calculationMode','dispenseUnit','referenceIngredientId','productStrength','unitConversions',
       'fixedProductQuantity','fixedProductQuantityBasis','preparationPolicy','priceBasis','billingUnit','taxClass',
       'setBillingOwner','setAmountStrategy','productReference')) then return false; end if;
  foreach k in array array['dispenseUnit','referenceIngredientId','billingUnit'] loop
    if a ? k and a->k<>'null'::jsonb and (jsonb_typeof(a->k)<>'string' or length(btrim(a->>k))=0) then return false; end if;
  end loop;
  if mode<>'not_applicable' and nullif(btrim(a->>'dispenseUnit'),'') is null then return false; end if;
  if mode='product_unit' and (a->>'schemaVersion'<>'2' or a ? 'fixedProductQuantity' or a ? 'fixedProductQuantityBasis') then return false; end if;
  if mode='fixed_product' and (jsonb_typeof(a->'fixedProductQuantity') is distinct from 'number'
    or (a->>'fixedProductQuantity')::numeric<=0 or coalesce(a->>'fixedProductQuantityBasis','') not in ('head','kg')) then return false; end if;
  if s is not null and s<>'null'::jsonb then
    if jsonb_typeof(s)<>'object' or exists(select 1 from jsonb_object_keys(s) key where key not in
      ('numeratorValue','numeratorUnit','denominatorValue','denominatorUnit')) then return false; end if;
    foreach k in array array['numeratorValue','denominatorValue'] loop
      if jsonb_typeof(s->k) is distinct from 'number' or (s->>k)::numeric<=0 then return false; end if;
    end loop;
    foreach k in array array['numeratorUnit','denominatorUnit'] loop
      if jsonb_typeof(s->k) is distinct from 'string' or length(btrim(s->>k))=0 then return false; end if;
    end loop;
  end if;
  if mode='ingredient_based' and (s is null or s='null'::jsonb or nullif(btrim(a->>'referenceIngredientId'),'') is null) then return false; end if;
  if a ? 'unitConversions' then
    if jsonb_typeof(a->'unitConversions')<>'array' then return false; end if;
    for x in select value from jsonb_array_elements(a->'unitConversions') loop
      if jsonb_typeof(x)<>'object' or exists(select 1 from jsonb_object_keys(x) key where key not in ('fromUnit','toUnit','factor'))
        or jsonb_typeof(x->'factor') is distinct from 'number' or (x->>'factor')::numeric<=0
        or jsonb_typeof(x->'fromUnit') is distinct from 'string' or nullif(btrim(x->>'fromUnit'),'') is null
        or jsonb_typeof(x->'toUnit') is distinct from 'string' or nullif(btrim(x->>'toUnit'),'') is null then return false; end if;
    end loop;
  end if;
  if a->>'schemaVersion'='2' and mode<>'not_applicable' and
    (jsonb_typeof(p) is distinct from 'object' or coalesce(p->>'quantityScope','') not in ('course_total','per_administration')) then return false; end if;
  if p is not null and p<>'null'::jsonb then
    if mode='not_applicable' or jsonb_typeof(p)<>'object'
      or exists(select 1 from jsonb_object_keys(p) key where key not in
        ('quantityScope','increment','roundingMode','displayPrecision','minimum','maximum','noReasonTolerance'))
      or (a->>'schemaVersion'='1' and p ? 'quantityScope')
      or jsonb_typeof(p->'increment') is distinct from 'number' or (p->>'increment')::numeric<=0
      or coalesce(p->>'roundingMode','') not in ('up','down','nearest')
      or jsonb_typeof(p->'displayPrecision') is distinct from 'number'
      or (p->>'displayPrecision')::numeric<>trunc((p->>'displayPrecision')::numeric)
      or (p->>'displayPrecision')::numeric not between 0 and (case a->>'schemaVersion' when '2' then 9 else 12 end) then return false; end if;
    foreach k in array array['minimum','maximum','noReasonTolerance'] loop
      if p ? k and p->k<>'null'::jsonb and (jsonb_typeof(p->k)<>'number' or (p->>k)::numeric<0
        or (k<>'noReasonTolerance' and (p->>k)::numeric=0)) then return false; end if;
    end loop;
    if (p->>'minimum')::numeric>(p->>'maximum')::numeric then return false; end if;
  end if;
  if coalesce(a->>'priceBasis','')<>'' and a->>'priceBasis' not in
    ('per_order','per_day','per_administration','per_product_unit','per_kg','fixed_set') then return false; end if;
  if (nullif(a->>'priceBasis','') is null)<>(nullif(a->>'billingUnit','') is null) then return false; end if;
  if a->>'taxClass' not in ('taxable','non_taxable') or a->>'setBillingOwner' not in ('parent','children')
    or a->>'setAmountStrategy' not in ('fixed_set','included_order_sum','range_price') then return false; end if;
  if (a->>'priceBasis'='fixed_set' and coalesce(a->>'setBillingOwner','')<>'parent')
    or (a->>'setBillingOwner'='children' and a->>'setAmountStrategy'='fixed_set') then return false; end if;
  if r is not null then
    if a->>'schemaVersion'<>'2' or jsonb_typeof(r)<>'object' or r->'clinicalUseAllowed' is distinct from 'false'::jsonb
      or exists(select 1 from jsonb_object_keys(r) key where key not in
        ('referenceKey','productName','dosageForm','strengthDescription','sourceUri','referenceSpecies','clinicalUseAllowed')) then return false; end if;
    foreach k in array array['referenceKey','productName','dosageForm','strengthDescription','sourceUri'] loop
      if jsonb_typeof(r->k) is distinct from 'string' or length(btrim(r->>k)) not between 1 and 2000 then return false; end if;
    end loop;
    if r->>'sourceUri' not like 'https://%' or jsonb_typeof(r->'referenceSpecies') is distinct from 'array'
      or jsonb_array_length(r->'referenceSpecies')<1 then return false; end if;
    if exists(select 1 from jsonb_array_elements(r->'referenceSpecies') species where jsonb_typeof(species)<>'string'
      or species#>>'{}' not in ('dog','cat','horse','human'))
      or (select count(distinct species) from jsonb_array_elements(r->'referenceSpecies') species)<>jsonb_array_length(r->'referenceSpecies') then return false; end if;
  end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $fn$;
revoke all on function private.clair_plan_order_authority_is_valid(jsonb) from public,anon,authenticated,service_role;

alter function private.clair_order_execution_preset_contract_is_valid(text,integer,jsonb,jsonb)
  rename to clair_execution_contract_before_authority;
create function private.clair_order_execution_preset_contract_is_valid(
  p_clinical_order_type text,p_detail_schema_version integer,p_default_detail_inputs jsonb,p_field_policies jsonb
) returns boolean language plpgsql stable security definer set search_path='' as $fn$
begin
  if jsonb_typeof(p_default_detail_inputs) is distinct from 'object' or jsonb_typeof(p_field_policies) is distinct from 'object' then return false; end if;
  if p_default_detail_inputs ? 'planOrderAuthority' and
    (not private.clair_plan_order_authority_is_valid(p_default_detail_inputs->'planOrderAuthority')
      or coalesce(p_field_policies->>'planOrderAuthority','') not in ('preset_fixed','workspace_resolved','derived_from_profile')) then return false; end if;
  if not (p_default_detail_inputs ? 'planOrderAuthority') and p_field_policies ? 'planOrderAuthority'
    and p_field_policies->>'planOrderAuthority' is distinct from 'workspace_resolved' then return false; end if;
  return private.clair_execution_contract_before_authority(p_clinical_order_type,p_detail_schema_version,
    p_default_detail_inputs-'planOrderAuthority',p_field_policies-'planOrderAuthority');
end $fn$;
revoke all on function private.clair_execution_contract_before_authority(text,integer,jsonb,jsonb),
  private.clair_order_execution_preset_contract_is_valid(text,integer,jsonb,jsonb) from public,anon,authenticated,service_role;

-- CHECK expressions bind function OIDs, not names. Rebind the existing exact
-- contract checks to the new wrapper; otherwise renamed legacy validation would
-- still reject the reserved field even though publisher/API validation accepts it.
do $checks$
declare c record; definition text;
begin
  for c in select con.oid,con.conname,con.conrelid::regclass as relation
    from pg_constraint con where con.contype='c'
      and con.conrelid in ('master.order_execution_presets'::regclass,'public.order_catalog_items'::regclass)
      and pg_get_constraintdef(con.oid) like '%clair_execution_contract_before_authority%'
  loop
    definition:=replace(pg_get_constraintdef(c.oid),'clair_execution_contract_before_authority','clair_order_execution_preset_contract_is_valid');
    execute format('alter table %s drop constraint %I',c.relation,c.conname);
    execute format('alter table %s add constraint %I %s',c.relation,c.conname,definition);
  end loop;
end $checks$;

alter table public.order_catalog_items drop constraint order_catalog_items_default_detail_inputs_object_check;
alter table public.order_catalog_items add constraint order_catalog_items_default_detail_inputs_object_check check (
  jsonb_typeof(default_detail_inputs)='object' and octet_length(default_detail_inputs::text)<=65536
  and (not (default_detail_inputs ? 'planOrderAuthority') or
    private.clair_plan_order_authority_is_valid(default_detail_inputs->'planOrderAuthority'))
  and (default_detail_inputs='{}'::jsonb or private.clair_order_detail_inputs_are_valid(
    clinical_order_type,coalesce(detail_schema_version,1),default_detail_inputs-'planOrderAuthority',false))
);

alter function private.clair_catalog_effective_default_detail_inputs(public.order_catalog_items)
  rename to clair_catalog_defaults_before_authority;
create function private.clair_catalog_effective_default_detail_inputs(p_catalog public.order_catalog_items)
returns jsonb language sql stable security invoker set search_path='' as $fn$
  select private.clair_catalog_defaults_before_authority(p_catalog)-'planOrderAuthority';
$fn$;
revoke all on function private.clair_catalog_defaults_before_authority(public.order_catalog_items),
  private.clair_catalog_effective_default_detail_inputs(public.order_catalog_items) from public,anon,authenticated,service_role;

alter function private.clair_build_catalog_order_snapshot(text,text,numeric) rename to clair_catalog_snapshot_before_authority;
create function private.clair_build_catalog_order_snapshot(p_workspace_id text,p_catalog_item_id text,p_quantity numeric)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare base jsonb; authority jsonb;
begin
  base:=private.clair_catalog_snapshot_before_authority(p_workspace_id,p_catalog_item_id,p_quantity);
  select default_detail_inputs->'planOrderAuthority' into authority from public.order_catalog_items
    where workspace_id=p_workspace_id and id=p_catalog_item_id;
  if authority is not null and not private.clair_plan_order_authority_is_valid(authority) then
    raise exception 'catalog_authority_invalid' using errcode='22023'; end if;
  return base||jsonb_build_object('planOrderAuthority',authority);
end $fn$;
revoke all on function private.clair_catalog_snapshot_before_authority(text,text,numeric),
  private.clair_build_catalog_order_snapshot(text,text,numeric) from public,anon,authenticated,service_role;
do $search$
declare body text; anchor text:='''clinicalOrderType'', catalog.clinical_order_type,';
begin
  body:=pg_get_functiondef('public.clair_list_order_catalog_chart_search_v2(text)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'preparation authority search anchor drift'; end if;
  execute replace(body,anchor,anchor||E'\n        ''planOrderAuthority'', catalog.default_detail_inputs->''planOrderAuthority'',');
end $search$;
