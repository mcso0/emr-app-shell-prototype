-- Local candidate. Course request quantities are distinct from execution results.
-- No existing orders, masters, presets, or confirmed snapshots are rewritten.
create table public.workspace_dispense_quantity_rules (
  workspace_id text primary key references public.workspaces(id),
  revision integer not null check (revision > 0),
  default_rules jsonb not null default '{}' check (jsonb_typeof(default_rules)='object'),
  product_rules jsonb not null default '{}' check (jsonb_typeof(product_rules)='object'),
  updated_by_user_id uuid not null references public.users(id),
  updated_at timestamptz not null default now()
);
create table public.workspace_dispense_quantity_rule_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id),
  revision integer not null,
  snapshot jsonb not null,
  created_by_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique(workspace_id,revision)
);
alter table public.workspace_dispense_quantity_rules enable row level security;
alter table public.workspace_dispense_quantity_rule_events enable row level security;
revoke all on public.workspace_dispense_quantity_rules,public.workspace_dispense_quantity_rule_events from public,anon,authenticated;
grant select on public.workspace_dispense_quantity_rules,public.workspace_dispense_quantity_rule_events to authenticated;
create policy dispense_rules_read on public.workspace_dispense_quantity_rules for select to authenticated using (
  private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'));
create policy dispense_rule_events_read on public.workspace_dispense_quantity_rule_events for select to authenticated using (
  private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'));

create function private.clair_dispense_quantity_rule_valid(r jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
begin
  if r is null or r='null'::jsonb then return true; end if;
  return jsonb_typeof(r)='object'
    and not exists(select 1 from jsonb_object_keys(r) k where k not in ('mode','increment','unit','displayPrecision'))
    and coalesce(r->>'mode','') in ('exact','nearest','up','down')
    and jsonb_typeof(r->'increment')='number' and (r->>'increment')::numeric>0
    and jsonb_typeof(r->'unit')='string' and length(btrim(r->>'unit')) between 1 and 40
    and jsonb_typeof(r->'displayPrecision')='number'
    and (r->>'displayPrecision')::numeric between 0 and 9
    and (r->>'displayPrecision')::numeric=trunc((r->>'displayPrecision')::numeric)
    and (r->>'mode'='exact' or (r->>'increment')::numeric=round((r->>'increment')::numeric,(r->>'displayPrecision')::integer));
exception when others then return false;
end $$;

-- Product reference + strength/form/unit identify reusable products. A missing
-- reference stays catalog-local; ingredient/name alone never groups products.
create function private.clair_dispense_rule_product_key(c public.order_catalog_items)
returns text language sql stable set search_path=pg_catalog as $$
  select case when c.source_medication_product_id is not null then 'medication-product:'||c.source_medication_product_id::text||':'||coalesce(c.default_detail_inputs#>>'{planOrderAuthority,dispenseUnit}','')
    when nullif(c.default_detail_inputs#>>'{planOrderAuthority,productReference,referenceKey}','') is not null
    then 'product:'||md5(jsonb_build_array(
      c.default_detail_inputs#>>'{planOrderAuthority,productReference,referenceKey}',
      c.default_detail_inputs#>>'{planOrderAuthority,productReference,dosageForm}',
      c.default_detail_inputs#>>'{planOrderAuthority,productReference,strengthDescription}',
      c.default_detail_inputs#>'{planOrderAuthority,productStrength}',
      c.default_detail_inputs#>>'{planOrderAuthority,dispenseUnit}')::text)
    else 'catalog:'||c.id end
$$;

create function public.clair_get_dispense_quantity_rules(p_workspace_id text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare settings public.workspace_dispense_quantity_rules; products jsonb;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:view')
  then raise exception 'permission_missing' using errcode='42501'; end if;
  select * into settings from public.workspace_dispense_quantity_rules where workspace_id=p_workspace_id;
  select coalesce(jsonb_agg(jsonb_build_object('catalogItemId',c.id,'productKey',private.clair_dispense_rule_product_key(c),
    'name',c.in_hospital_order_name,'unit',c.default_detail_inputs#>>'{planOrderAuthority,dispenseUnit}') order by c.in_hospital_order_name,c.id),'[]')
  into products from public.order_catalog_items c where c.workspace_id=p_workspace_id and c.clinical_order_type='dispensing';
  return jsonb_build_object('revision',coalesce(settings.revision,0),'defaultRules',coalesce(settings.default_rules,'{}'),
    'productRules',coalesce(settings.product_rules,'{}'),'products',products,
    'canManage',private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage'));
end $$;

create function public.clair_save_dispense_quantity_rules(p_workspace_id text,p_expected_revision integer,p_target text,p_rule jsonb,p_catalog_item_ids text[],p_unit text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare settings public.workspace_dispense_quantity_rules; c public.order_catalog_items; k text; revision_value integer;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage')
  then raise exception 'permission_missing' using errcode='42501'; end if;
  if p_unit is null or length(btrim(p_unit)) not between 1 and 40 or p_expected_revision is null or p_expected_revision<0 or p_target is null or p_target not in ('hospital','products')
    or not coalesce(private.clair_dispense_quantity_rule_valid(p_rule),false)
    or (p_target='products' and (coalesce(cardinality(p_catalog_item_ids),0) not between 1 and 500))
  then raise exception 'invalid_rule_input' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dispense_rules:'||p_workspace_id,0));
  select * into settings from public.workspace_dispense_quantity_rules where workspace_id=p_workspace_id for update;
  if coalesce(settings.revision,0)<>p_expected_revision then raise exception 'revision_conflict'; end if;
  settings.product_rules:=coalesce(settings.product_rules,'{}');
  settings.default_rules:=coalesce(settings.default_rules,'{}');
  if p_target='hospital' then
    if p_rule is null or p_rule='null'::jsonb then settings.default_rules:=settings.default_rules-p_unit;
    elsif p_rule->>'unit' is distinct from p_unit then raise exception 'rule_unit_mismatch';
    else settings.default_rules:=jsonb_set(settings.default_rules,array[p_unit],p_rule,true); end if;
  else
    foreach k in array p_catalog_item_ids loop
      select * into c from public.order_catalog_items where workspace_id=p_workspace_id and id=k and clinical_order_type='dispensing';
      if not found then raise exception 'catalog_item_unavailable'; end if;
      if p_rule is not null and p_rule<>'null'::jsonb and p_rule->>'mode'<>'exact'
        and p_rule->>'unit' is distinct from c.default_detail_inputs#>>'{planOrderAuthority,dispenseUnit}'
      then raise exception 'rule_unit_mismatch'; end if;
      if p_rule is null or p_rule='null'::jsonb then settings.product_rules:=settings.product_rules-private.clair_dispense_rule_product_key(c);
      else settings.product_rules:=jsonb_set(settings.product_rules,array[private.clair_dispense_rule_product_key(c)],p_rule,true); end if;
    end loop;
  end if;
  revision_value:=p_expected_revision+1;
  insert into public.workspace_dispense_quantity_rules(workspace_id,revision,default_rules,product_rules,updated_by_user_id)
    values(p_workspace_id,revision_value,settings.default_rules,settings.product_rules,auth.uid())
    on conflict(workspace_id) do update set revision=excluded.revision,default_rules=excluded.default_rules,
      product_rules=excluded.product_rules,updated_by_user_id=excluded.updated_by_user_id,updated_at=now();
  insert into public.workspace_dispense_quantity_rule_events(workspace_id,revision,snapshot,created_by_user_id)
    values(p_workspace_id,revision_value,jsonb_build_object('defaultRules',coalesce(settings.default_rules,'{}'),'productRules',settings.product_rules),auth.uid());
  return public.clair_get_dispense_quantity_rules(p_workspace_id);
end $$;
revoke all on function private.clair_dispense_quantity_rule_valid(jsonb),private.clair_dispense_rule_product_key(public.order_catalog_items) from public,anon,authenticated,service_role;
revoke all on function public.clair_get_dispense_quantity_rules(text),public.clair_save_dispense_quantity_rules(text,integer,text,jsonb,text[],text) from public,anon,authenticated,service_role;
grant execute on function public.clair_get_dispense_quantity_rules(text),public.clair_save_dispense_quantity_rules(text,integer,text,jsonb,text[],text) to authenticated;

create trigger workspace_dispense_rule_events_immutable before update or delete on public.workspace_dispense_quantity_rule_events
  for each row execute function private.clair_reject_prebilling_override_mutation();

alter table public.orders add column dispense_request_rule_snapshot jsonb;
create function private.clair_capture_dispense_request_rule()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c public.order_catalog_items; settings public.workspace_dispense_quantity_rules; k text; r jsonb; source_value text; a jsonb;
begin
  if tg_op='UPDATE' then
    new.dispense_request_rule_snapshot:=old.dispense_request_rule_snapshot;
    return new;
  end if;
  if new.clinical_order_type<>'dispensing' or new.row_type='set' then
    new.dispense_request_rule_snapshot:=null; return new;
  end if;
  select * into c from public.order_catalog_items where workspace_id=new.workspace_id and id=new.workspace_catalog_item_id;
  k:=case when found then private.clair_dispense_rule_product_key(c) else null end;
  select * into settings from public.workspace_dispense_quantity_rules where workspace_id=new.workspace_id;
  r:=settings.product_rules->k; source_value:='product';
  if r is null then a:=private.clair_order_dispensing_authority(new); r:=settings.default_rules->(a->>'dispenseUnit'); source_value:='hospital'; end if;
  if r is null then source_value:='theoretical'; end if;
  new.dispense_request_rule_snapshot:=jsonb_build_object('schemaVersion',1,'version',coalesce(settings.revision,0),
    'source',source_value,'rule',r,'productKey',k);
  return new;
end $$;
-- After dedicated set-child authority capture, before calculation projection.
create trigger orders_execution_contract_zzz_dispense_rule_trg before insert or update on public.orders
  for each row execute function private.clair_capture_dispense_request_rule();
revoke all on function private.clair_capture_dispense_request_rule() from public,anon,authenticated,service_role;

-- Existing configured bounds remain independent of automatic rounding steps.
-- A historical per-administration bound is converted to the same course scope.
create function private.clair_dispense_request_within_limits(o public.orders,q numeric,outputs jsonb)
returns boolean language plpgsql stable set search_path=pg_catalog,public,private as $$
declare p jsonb:=private.clair_order_dispensing_authority(o)->'preparationPolicy'; factor numeric:=1;
  minimum_value numeric; maximum_value numeric;
begin
  if q is null or q<=0 or q::text in ('NaN','Infinity','-Infinity') then return false; end if;
  if coalesce(p->>'quantityScope','per_administration')<>'course_total' then factor:=(outputs->>'totalOccurrences')::numeric; end if;
  if jsonb_typeof(p->'minimum')='number' then minimum_value:=(p->>'minimum')::numeric*factor; end if;
  if jsonb_typeof(p->'maximum')='number' then maximum_value:=(p->>'maximum')::numeric*factor; end if;
  return (minimum_value is null or q>=minimum_value) and (maximum_value is null or q<=maximum_value);
end $$;
revoke all on function private.clair_dispense_request_within_limits(public.orders,numeric,jsonb) from public,anon,authenticated,service_role;

-- Preserve historical manual course totals before an incomplete input clears projections.
create function private.clair_existing_manual_dispense_total(existing jsonb)
returns numeric language sql immutable set search_path=pg_catalog as $$
  select case when existing->>'actualDispenseSource'<>'manual_override' or jsonb_typeof(existing->'actualDispenseQuantity')<>'number' then null
    when existing->>'dispenseRequestSchemaVersion'='1' or existing->>'preparationQuantityScope'='course_total'
      then (existing->>'actualDispenseQuantity')::numeric
    when jsonb_typeof(existing->'totalRequiredDispenseQuantity')='number'
      then (existing->>'totalRequiredDispenseQuantity')::numeric
    when jsonb_typeof(existing->'totalOccurrences')='number'
      then (existing->>'actualDispenseQuantity')::numeric*(existing->>'totalOccurrences')::numeric
    else null end
$$;
revoke all on function private.clair_existing_manual_dispense_total(jsonb) from public,anon,authenticated,service_role;
create function private.clair_dispense_request_failure(existing jsonb, reason text)
returns jsonb language sql immutable set search_path=pg_catalog as $$
  select private.clair_plan_order_dispense_failure(existing,'applicable',reason)||jsonb_build_object(
    'theoreticalTotalQuantity',null,'calculatedDispenseQuantity',null,'plannedPracticalDispenseQuantity',null,
    'plannedPracticalTotalQuantity',null,'proposedPlannedPracticalQuantity',null,
    'actualDispenseQuantity',case when existing->>'actualDispenseSource'='manual_override'
      then coalesce(to_jsonb(private.clair_existing_manual_dispense_total(existing)),existing->'actualDispenseQuantity') else null end)
    ||case when private.clair_existing_manual_dispense_total(existing) is not null
      then jsonb_build_object('dispenseRequestSchemaVersion',1,'preparationQuantityScope','course_total') else '{}'::jsonb end
$$;
revoke all on function private.clair_dispense_request_failure(jsonb,text) from public,anon,authenticated,service_role;

alter function private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz) rename to clair_compute_dispense_before_request_totals;
create function private.clair_compute_plan_order_dispense_projection(p_order public.orders,p_effective_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private,extensions as $$
declare a jsonb:=private.clair_order_dispensing_authority(p_order); scratch public.orders:=p_order;
  result jsonb; rule_snapshot jsonb:=p_order.dispense_request_rule_snapshot; r jsonb; legacy_policy jsonb;
  total numeric; count_value numeric; proposed numeric; actual numeric; step_value numeric;
  source_value text; fingerprint text; existing jsonb:=coalesce(p_order.calculation_outputs,'{}');
  dose_unit text; unit_value text; precision_value integer; expected_count numeric;
begin
  -- Historical confirmed quantities remain immutable. Re-request recalculation
  -- uses the copied rule when present, without ever rereading hospital settings.
  if p_order.clinical_order_type<>'dispensing' or p_order.row_type='set' then
    return private.clair_compute_dispense_before_request_totals(p_order,p_effective_at);
  end if;
  if a is null or jsonb_typeof(a) is distinct from 'object' or coalesce(a->>'calculationMode','') not in ('ingredient_based','fixed_product','product_unit') then
    return private.clair_dispense_request_failure(existing,'configuration_missing'); end if;
  if rule_snapshot is null then
    legacy_policy:=a->'preparationPolicy';
    rule_snapshot:=jsonb_build_object('schemaVersion',1,'version',0,'source','legacy',
      'rule',case when jsonb_typeof(legacy_policy)='object' then jsonb_build_object(
        'mode',legacy_policy->>'roundingMode','increment',legacy_policy->'increment',
        'unit',a->>'dispenseUnit','displayPrecision',legacy_policy->'displayPrecision') else null end);
  end if;
  r:=nullif(rule_snapshot->'rule','null'::jsonb);
  if not coalesce(private.clair_dispense_quantity_rule_valid(r),false) then
    return private.clair_dispense_request_failure(existing,'dispense_rule_invalid'); end if;
  unit_value:=a->>'dispenseUnit';
  dose_unit:=p_order.detail_inputs->>'doseUnit';
  if p_order.detail_inputs->>'doseBasis'='kg' then dose_unit:=regexp_replace(dose_unit,'/kg$',''); end if;
  if a->>'calculationMode' in ('product_unit','fixed_product') then
    if dose_unit is distinct from unit_value then
      return private.clair_dispense_request_failure(existing,'unit_conversion_missing'); end if;
    a:=a||jsonb_build_object('calculationMode','fixed_product','fixedProductQuantity',p_order.detail_inputs->'dose',
      'fixedProductQuantityBasis',case p_order.detail_inputs->>'doseBasis' when 'patient' then 'head' else p_order.detail_inputs->>'doseBasis' end);
  end if;
  a:=(a-'preparationPolicy')||jsonb_build_object('schemaVersion',1);
  scratch.applied_snapshot:=jsonb_set(scratch.applied_snapshot,'{planOrderAuthority}',a);
  scratch.dispensing_authority_snapshot:=a;
  scratch.calculation_outputs:='{}';
  result:=private.clair_compute_dispense_before_preparation_v2(scratch,p_effective_at);
  if result->>'calculationStatus' is distinct from 'ready' then return private.clair_dispense_request_failure(existing,result->>'calculationError'); end if;
  count_value:=(result->>'totalOccurrences')::numeric;
  if count_value is null or count_value<=0 or count_value<>trunc(count_value) then
    return private.clair_dispense_request_failure(existing,'occurrence_plan_required'); end if;
  if (p_order.detail_inputs->>'frequency' in ('sid','bid','tid','qid') and
    (jsonb_typeof(p_order.detail_inputs->'durationDays') is distinct from 'number' or
      (p_order.detail_inputs->>'durationDays')::numeric<1 or
      (p_order.detail_inputs->>'durationDays')::numeric<>trunc((p_order.detail_inputs->>'durationDays')::numeric)))
  then return private.clair_dispense_request_failure(existing,'occurrence_plan_required'); end if;
  expected_count:=case p_order.detail_inputs->>'frequency'
    when 'once' then 1
    when 'sid' then (p_order.detail_inputs->>'durationDays')::numeric
    when 'bid' then (p_order.detail_inputs->>'durationDays')::numeric*2
    when 'tid' then (p_order.detail_inputs->>'durationDays')::numeric*3
    when 'qid' then (p_order.detail_inputs->>'durationDays')::numeric*4 else null end;
  if (expected_count is not null and count_value<>expected_count) or
    (p_order.detail_inputs->>'frequency'='once' and p_order.detail_inputs ? 'durationDays' and
      (p_order.detail_inputs->>'durationDays')::numeric<>1)
  then return private.clair_dispense_request_failure(existing,'occurrence_plan_conflict'); end if;
  if (p_order.detail_inputs ? 'totalOccurrences' and
    (jsonb_typeof(p_order.detail_inputs->'totalOccurrences') is distinct from 'number' or
      (p_order.detail_inputs->>'totalOccurrences')::numeric<>count_value))
  then return private.clair_dispense_request_failure(existing,'occurrence_plan_conflict'); end if;
  total:=(result->>'theoreticalDispenseQuantity')::numeric*count_value;
  proposed:=total;
  if r is not null and r->>'mode'<>'exact' then
    if r->>'unit' is distinct from unit_value then return private.clair_dispense_request_failure(existing,'rule_unit_mismatch'); end if;
    step_value:=(r->>'increment')::numeric;
    proposed:=(case r->>'mode' when 'up' then ceil(total/step_value) when 'down' then floor(total/step_value) else round(total/step_value) end)*step_value;
  end if;
  if not private.clair_dispense_request_within_limits(p_order,proposed,result) then return private.clair_dispense_request_failure(existing,'prepared_quantity_out_of_range'); end if;
  fingerprint:=encode(digest(jsonb_build_object('authority',a,'rule',rule_snapshot,'inputs',p_order.detail_inputs,
    'weight',result->'weightSnapshot','total',total,'count',count_value)::text,'sha256'),'hex');
  actual:=proposed; source_value:='preparation_policy';
  if existing->>'actualDispenseSource'='manual_override' and jsonb_typeof(existing->'actualDispenseQuantity')='number' then
    source_value:='manual_override'; actual:=private.clair_existing_manual_dispense_total(existing);
    if actual is null then return private.clair_dispense_request_failure(existing,'historical_quantity_scope_missing'); end if;
  end if;
  return result||jsonb_build_object('dispenseRequestSchemaVersion',1,'preparationSchemaVersion',2,'preparationQuantityScope','course_total',
    'dispenseRuleSnapshot',rule_snapshot,'theoreticalTotalQuantity',total,'preparationPolicy',r,
    'proposedActualDispenseQuantity',proposed,'proposedPlannedPracticalQuantity',proposed,
    'actualDispenseQuantity',actual,'actualDispenseSource',source_value,'actualDispenseUnit',unit_value,
    'actualDispenseOverride',case when source_value='manual_override' then existing->'actualDispenseOverride' else null end,
    'plannedPracticalDispenseQuantity',actual,'plannedPracticalTotalQuantity',actual,'plannedPracticalDispenseUnit',unit_value,
    'plannedPracticalDispenseSource',source_value,'totalRequiredDispenseQuantity',actual,'inputFingerprint',fingerprint,
    'requiresReconfirmation',source_value='manual_override' and (coalesce((existing->>'requiresReconfirmation')::boolean,false) or existing->>'inputFingerprint' is distinct from fingerprint));
end $$;
revoke all on function private.clair_compute_dispense_before_request_totals(public.orders,timestamptz),private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.clair_save_order_dispense_request(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_expected_order_updated_at timestamptz,
  p_actual_quantity numeric,
  p_mode text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_order public.orders%rowtype;
  v_existing public.order_actual_dispense_overrides%rowtype;
  v_override public.order_actual_dispense_overrides%rowtype;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_reason text := null;
  v_hash text;
  v_outputs jsonb;
  v_policy jsonb;
  v_proposed numeric;
  v_previous numeric;
  v_increment numeric;
  v_minimum numeric;
  v_maximum numeric;
  v_tolerance numeric;
  v_reason_required boolean;
  v_version integer;
  v_now timestamptz := now();
  v_result jsonb;
  v_actor_membership_id uuid;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'chart:update'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_order_updated_at is null
    or p_actual_quantity is null or p_actual_quantity <= 0
    or length(v_key) not between 8 and 160
    or p_mode is null or p_mode not in ('manual','automatic','reconfirm')
    or p_actual_quantity::text in ('NaN','Infinity','-Infinity')
  then raise exception 'invalid_actual_dispense_input'; end if;

  v_hash := encode(digest(jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'orderId', p_order_id,
    'expectedOrderUpdatedAt', p_expected_order_updated_at,
    'actualQuantity', p_actual_quantity,
    'mode', p_mode
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'order_actual_dispense:' || p_workspace_id || ':' || v_key, 0
  ));
  select * into v_existing
  from public.order_actual_dispense_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.idempotency_key = v_key;
  if found then
    if v_existing.request_sha256 is distinct from v_hash
      or v_existing.order_id is distinct from p_order_id
    then raise exception 'idempotency_conflict'; end if;
    if v_existing.result is null then
      raise exception 'actual_dispense_command_in_progress';
    end if;
    return v_existing.result;
  end if;

  select orders.* into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  for update;
  if not found
    or v_order.order_confirmation_status not in ('draft','pending')
    or v_order.status = 'cancelled'
    or v_order.clinical_order_type is distinct from 'dispensing'
    or v_order.row_type not in ('individual','set_child')
  then raise exception 'order_unavailable'; end if;
  if v_order.updated_at is distinct from p_expected_order_updated_at then
    raise exception 'revision_conflict';
  end if;
  v_outputs := private.clair_compute_plan_order_dispense_projection(v_order,v_now);
  if v_outputs ->> 'calculationStatus' <> 'ready'
    or v_outputs ->> 'dispenseApplicability' <> 'true'
    or jsonb_typeof(v_outputs -> 'proposedActualDispenseQuantity') <> 'number'
    or jsonb_typeof(v_outputs -> 'actualDispenseQuantity') <> 'number'
  then raise exception 'actual_dispense_calculation_unavailable'; end if;
  v_proposed := (v_outputs ->> 'proposedActualDispenseQuantity')::numeric;
  v_previous := (v_outputs ->> 'actualDispenseQuantity')::numeric;
  if p_mode='automatic' then p_actual_quantity:=v_proposed; end if;
  if p_mode='reconfirm' and (v_outputs->>'actualDispenseSource' is distinct from 'manual_override' or p_actual_quantity is distinct from v_previous)
  then raise exception 'invalid_actual_dispense_input'; end if;
  if not private.clair_dispense_request_within_limits(v_order,p_actual_quantity,v_outputs) then raise exception 'actual_dispense_out_of_policy'; end if;
  v_reason_required := false;

  select coalesce(max(override_row.version_no), 0) + 1 into v_version
  from public.order_actual_dispense_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.order_id = p_order_id;
  insert into public.order_actual_dispense_overrides (
    workspace_id, order_id, version_no, idempotency_key, request_sha256,
    expected_order_updated_at, proposed_quantity, previous_quantity,
    actual_quantity, actual_unit, reason, reason_required,
    created_by_user_id, created_at
  ) values (
    p_workspace_id, p_order_id, v_version, v_key, v_hash,
    p_expected_order_updated_at, v_proposed, v_previous,
    p_actual_quantity, v_outputs ->> 'actualDispenseUnit', v_reason,
    v_reason_required, p_actor_user_id, v_now
  ) returning * into v_override;

  v_outputs := v_outputs || jsonb_build_object(
    'actualDispenseQuantity', p_actual_quantity,
    'actualDispenseSource', case
      when p_mode='automatic'
        then 'preparation_policy'
      else 'manual_override' end,
    'actualDispenseOverride', case
      when p_mode='automatic' then null
      else jsonb_build_object(
        'versionNo', v_version,
        'overrideId', v_override.id,
        'reason', v_reason,
        'reasonRequired', v_reason_required,
        'createdByUserId', p_actor_user_id,
        'createdAt', v_now
      ) end,
    'requiresReconfirmation', false,
    'totalRequiredDispenseQuantity', case
      when jsonb_typeof(v_outputs -> 'totalOccurrences') = 'number'
        then p_actual_quantity * (v_outputs ->> 'totalOccurrences')::numeric
      else null end
  );
  v_outputs := private.clair_normalize_preparation_v2(v_outputs);
  update public.orders orders
  set calculation_outputs = v_outputs, updated_at = v_now
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  returning * into v_order;
  v_result := jsonb_build_object(
    'overrideId', v_override.id,
    'versionNo', v_version,
    'orderId', p_order_id,
    'actualDispenseQuantity', p_actual_quantity,
    'actualDispenseUnit', v_outputs ->> 'actualDispenseUnit',
    'actualDispenseSource', v_outputs ->> 'actualDispenseSource',
    'actualDispenseOverride', v_outputs -> 'actualDispenseOverride',
    'requiresReconfirmation', false,
    'updatedAt', v_order.updated_at
  );
  v_result:=v_result||jsonb_build_object('preparationSchemaVersion',2,'preparationQuantityScope','course_total',
    'plannedPracticalDispenseQuantity',p_actual_quantity,'plannedPracticalTotalQuantity',p_actual_quantity);
  update public.order_actual_dispense_overrides override_row
  set result = v_result
  where override_row.workspace_id = p_workspace_id
    and override_row.id = v_override.id;

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id, p_order_id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action', case when p_mode='automatic'
        then 'actual_dispense_reset' else 'actual_dispense_override' end,
      'overrideId', v_override.id,
      'versionNo', v_version,
      'previousQuantity', v_previous,
      'proposedQuantity', v_proposed,
      'actualQuantity', p_actual_quantity,
      'unit', v_outputs ->> 'actualDispenseUnit',
      'reason', v_reason,
      'reasonRequired', v_reason_required
    ),
    v_now
  );
  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;
  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    reason, before_snapshot, after_snapshot, metadata,
    occurred_at, created_at
  ) values (
    'order-actual-dispense-' || v_override.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'order.draft_changed', 'order', p_order_id::text,
    v_order.encounter_id, v_override.id::text, v_reason,
    jsonb_build_object('actualDispenseQuantity', v_previous),
    jsonb_build_object('actualDispenseQuantity', p_actual_quantity),
    jsonb_build_object(
      'source', 'order-actual-dispense-v1',
      'versionNo', v_version,
      'reasonRequired', v_reason_required,
      'idempotencyKey', v_key
    ),
    v_now, v_now
  );
  return v_result;
end;
$function$;
revoke all on function public.clair_save_order_dispense_request(text,uuid,uuid,timestamptz,numeric,text,text) from public,anon,authenticated,service_role;
grant execute on function public.clair_save_order_dispense_request(text,uuid,uuid,timestamptz,numeric,text,text) to authenticated;

-- Legacy callers use per-administration policy semantics. Dispensing requests
-- must use the course-total RPC above; preserve the old path for other types.
do $legacy_boundary$
declare body text; anchor text := '  if v_order.updated_at is distinct from p_expected_order_updated_at then';
begin
  body := pg_get_functiondef('public.clair_save_order_actual_dispense_override(text,uuid,uuid,timestamptz,numeric,text,text)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then
    raise exception 'legacy dispense boundary anchor drift';
  end if;
  body := replace(body,anchor,E'  if v_order.clinical_order_type = ''dispensing'' then\n'
    || E'    raise exception ''actual_dispense_override_disabled'';\n  end if;\n' || anchor);
  execute body;
end $legacy_boundary$;

-- Update only the request-quantity branch in the established re-request flow.
-- Amendment/re-request reasons, set parent locks, ownership and billing gates stay intact.
do $patch$
declare body text; start_at integer; end_at integer; section text; validation text; anchor text;
begin
  body:=pg_get_functiondef('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)'::regprocedure);
  -- A set child may change request mode while keeping prescription inputs equal.
  anchor:='and coalesce(v_changes->''actualDispenseQuantity'',v_order.calculation_outputs->''actualDispenseQuantity'') is not distinct from v_order.calculation_outputs->''actualDispenseQuantity'' then raise exception ''unchanged_instruction''; end if;';
  if strpos(body,anchor)=0 then raise exception 'dispense child request mode anchor drift'; end if;
  body:=replace(body,anchor,$child$
    and coalesce(v_changes->'actualDispenseQuantity',v_order.calculation_outputs->'actualDispenseQuantity') is not distinct from v_order.calculation_outputs->'actualDispenseQuantity'
    and coalesce(v_changes->>'actualDispenseMode',case when v_order.calculation_outputs->>'actualDispenseSource'='manual_override' then 'manual' else 'automatic' end)
      = (case when v_order.calculation_outputs->>'actualDispenseSource'='manual_override' then 'manual' else 'automatic' end)
    then raise exception 'unchanged_instruction'; end if;$child$);
  anchor:=E'        ''actualDispenseQuantity''\n';
  if strpos(body,anchor)=0 then raise exception 'dispense re-request fields anchor drift'; end if;
  body:=replace(body,anchor,E'        ''actualDispenseQuantity'', ''actualDispenseMode''\n');
  anchor:=E'      v_order.detail_inputs := v_detail_inputs;\n      v_order.detail_schema_version := v_detail_schema_version;\n      v_calculation_outputs :=';
  if strpos(body,anchor)=0 then raise exception 'dispense re-request intent anchor drift'; end if;
  body:=replace(body,anchor,$intent$
      if v_changes ? 'actualDispenseMode' then
        if v_order.clinical_order_type is distinct from 'dispensing'
          or coalesce(v_changes->>'actualDispenseMode','') not in ('automatic','manual')
          or (v_changes->>'actualDispenseMode'='manual' and not (v_changes ? 'actualDispenseQuantity'))
          or (v_changes->>'actualDispenseMode'='automatic' and v_changes ? 'actualDispenseQuantity')
        then raise exception 'invalid_re_request_fields'; end if;
        if v_changes->>'actualDispenseMode'='automatic' then
          v_order.calculation_outputs:=v_order.calculation_outputs||jsonb_build_object(
            'actualDispenseSource','preparation_policy','actualDispenseOverride',null,'requiresReconfirmation',false);
        end if;
      end if;
      v_order.detail_inputs := v_detail_inputs;
      v_order.detail_schema_version := v_detail_schema_version;
      v_calculation_outputs :=$intent$);
  start_at:=strpos(body,'        v_preparation_policy := v_calculation_outputs');
  end_at:=strpos(body,'        select coalesce(max(override_row.version_no)');
  if start_at=0 or end_at<=start_at then raise exception 'dispense re-request validation anchor drift'; end if;
  validation:=substr(body,start_at,end_at-start_at);
  section:=$validation$        if v_order.clinical_order_type='dispensing' then
          if not private.clair_dispense_request_within_limits(v_order,v_actual_quantity,v_calculation_outputs)
          then raise exception 'actual_dispense_out_of_policy'; end if;
          v_actual_reason_required := false;
        else
$validation$||validation||E'        end if;\n';
  body:=overlay(body placing section from start_at for end_at-start_at);
  start_at:=strpos(body,'        v_actual_override_id := gen_random_uuid();');
  end_at:=strpos(body,E'      end if;\n      if (\n        v_calculation_outputs');
  if start_at=0 or end_at<=start_at then raise exception 'dispense re-request history anchor drift'; end if;
  section:=substr(body,start_at,end_at-start_at);
  section:=replace(section,'''reason'', v_reason','''reason'', case when v_order.clinical_order_type=''dispensing'' then null else v_reason end');
  section:=replace(section,'v_reason, v_actual_reason_required,','case when v_order.clinical_order_type=''dispensing'' then null else v_reason end, v_actual_reason_required,');
  section:=replace(section,'when v_actual_quantity is not distinct from v_proposed_quantity','when v_order.clinical_order_type<>''dispensing'' and v_actual_quantity is not distinct from v_proposed_quantity');
  body:=overlay(body placing section from start_at for end_at-start_at);
  execute body;
end $patch$;
