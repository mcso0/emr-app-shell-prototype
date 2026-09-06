-- V2 names planning quantities explicitly. V1 orders retain their original math.
-- The legacy actualDispense* RPC keys remain transport aliases for planning only;
-- they are not fulfillment evidence. No existing order or snapshot is rewritten.
alter function private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz)
  rename to clair_compute_dispense_before_preparation_v2;

create function private.clair_normalize_preparation_v2(p jsonb)
returns jsonb language sql immutable set search_path=pg_catalog
as $$ select case when p->>'preparationSchemaVersion'='2' then p || jsonb_build_object(
  'plannedPracticalDispenseQuantity',p->'actualDispenseQuantity',
  'plannedPracticalDispenseUnit',p->'actualDispenseUnit',
  'plannedPracticalDispenseSource',p->'actualDispenseSource',
  'plannedPracticalTotalQuantity',case when p->>'preparationQuantityScope'='course_total'
    then p->'actualDispenseQuantity' else p->'totalRequiredDispenseQuantity' end,
  'totalRequiredDispenseQuantity',case when p->>'preparationQuantityScope'='course_total'
    then p->'actualDispenseQuantity' else p->'totalRequiredDispenseQuantity' end
) else p end $$;
revoke all on function private.clair_normalize_preparation_v2(jsonb) from public,anon,authenticated,service_role;

create function private.clair_compute_plan_order_dispense_projection(
  p_order public.orders,p_effective_at timestamptz
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private,extensions
as $fn$
declare
  a jsonb:=p_order.applied_snapshot->'planOrderAuthority';
  policy jsonb:=a->'preparationPolicy';
  scope text:=policy->>'quantityScope';
  scratch public.orders:=p_order;
  result jsonb; existing jsonb:=coalesce(p_order.calculation_outputs,'{}');
  theoretical numeric; count numeric; proposed numeric; actual numeric;
  increment_value numeric; precision_value integer; fingerprint text; source text;
  unit_value text; dose_unit text; baseline_quantity numeric; expected_count numeric;
begin
  if a->>'schemaVersion' is distinct from '2' then
    return private.clair_compute_dispense_before_preparation_v2(p_order,p_effective_at);
  end if;
  if a->>'calculationMode'='not_applicable' then
    return private.clair_compute_dispense_before_preparation_v2(p_order,p_effective_at);
  end if;
  if scope is null or scope not in ('course_total','per_administration')
    or jsonb_typeof(policy->'increment') is distinct from 'number'
    or (policy->>'increment')::numeric<=0
    or coalesce(policy->>'roundingMode','') not in ('up','down','nearest')
    or jsonb_typeof(policy->'displayPrecision') is distinct from 'number'
    or (policy->>'displayPrecision')::numeric<>trunc((policy->>'displayPrecision')::numeric)
    or (policy->>'displayPrecision')::numeric not between 0 and 9
  then return private.clair_plan_order_dispense_failure('{}','applicable','preparation_policy_invalid'); end if;
  unit_value:=nullif(btrim(a->>'dispenseUnit'),'');
  if a->>'calculationMode'='product_unit' then
    dose_unit:=nullif(btrim(p_order.detail_inputs->>'doseUnit'),'');
    if p_order.detail_inputs->>'doseBasis'='kg' then dose_unit:=regexp_replace(dose_unit,'/kg$',''); end if;
    if unit_value is null or dose_unit is distinct from unit_value then
      return private.clair_plan_order_dispense_failure('{}','applicable','unit_conversion_missing');
    end if;
    if a ? 'fixedProductQuantity' or a ? 'fixedProductQuantityBasis' then
      return private.clair_plan_order_dispense_failure('{}','applicable','product_unit_uses_order_dose');
    end if;
    -- Reuse the exact encounter/time weight guard and occurrence resolver. This
    -- scratch authority never persists and makes no ingredient conversion claim.
    scratch.applied_snapshot:=jsonb_set(scratch.applied_snapshot,'{planOrderAuthority}',
      a || jsonb_build_object('calculationMode','fixed_product',
        'fixedProductQuantity',p_order.detail_inputs->'dose',
        'fixedProductQuantityBasis',case p_order.detail_inputs->>'doseBasis'
          when 'patient' then 'head' else p_order.detail_inputs->>'doseBasis' end));
  end if;
  scratch.applied_snapshot:=jsonb_set(scratch.applied_snapshot,'{planOrderAuthority}',
    (scratch.applied_snapshot->'planOrderAuthority')-'preparationPolicy');
  scratch.calculation_outputs:='{}';
  result:=private.clair_compute_dispense_before_preparation_v2(scratch,p_effective_at);
  if result->>'calculationStatus' is distinct from 'ready' then return result; end if;
  theoretical:=(result->>'theoreticalDispenseQuantity')::numeric;
  count:=(result->>'totalOccurrences')::numeric;
  -- No inferred one-day course: require explicit daily duration, once, or an
  -- explicit custom/PRN authorized count. Empty and fractional counts fail closed.
  if count is null or count<=0 or count<>trunc(count)
    or (p_order.detail_inputs->>'frequency' in ('sid','bid','tid','qid')
      and (jsonb_typeof(p_order.detail_inputs->'durationDays') is distinct from 'number'
        or (p_order.detail_inputs->>'durationDays')::numeric<1
        or (p_order.detail_inputs->>'durationDays')::numeric<>trunc((p_order.detail_inputs->>'durationDays')::numeric)))
  then return private.clair_plan_order_dispense_failure('{}','applicable','occurrence_plan_required'); end if;
  expected_count:=case p_order.detail_inputs->>'frequency'
    when 'once' then 1
    when 'sid' then (p_order.detail_inputs->>'durationDays')::numeric
    when 'bid' then (p_order.detail_inputs->>'durationDays')::numeric*2
    when 'tid' then (p_order.detail_inputs->>'durationDays')::numeric*3
    when 'qid' then (p_order.detail_inputs->>'durationDays')::numeric*4 else null end;
  if (expected_count is not null and count<>expected_count)
    or (p_order.detail_inputs ? 'totalOccurrences' and
      (jsonb_typeof(p_order.detail_inputs->'totalOccurrences') is distinct from 'number'
       or (p_order.detail_inputs->>'totalOccurrences')::numeric<>count))
    or (p_order.detail_inputs->>'frequency'='once' and
      p_order.detail_inputs ? 'durationDays' and (p_order.detail_inputs->>'durationDays')::numeric<>1)
  then return private.clair_plan_order_dispense_failure('{}','applicable','occurrence_plan_conflict'); end if;
  baseline_quantity:=case when scope='course_total' then theoretical*count else theoretical end;
  increment_value:=(policy->>'increment')::numeric;
  precision_value:=(policy->>'displayPrecision')::integer;
  proposed:=round((case policy->>'roundingMode'
    when 'up' then ceil(baseline_quantity/increment_value)
    when 'down' then floor(baseline_quantity/increment_value)
    else round(baseline_quantity/increment_value) end)*increment_value,precision_value);
  if proposed<=0
    or (jsonb_typeof(policy->'minimum')='number' and proposed<(policy->>'minimum')::numeric)
    or (jsonb_typeof(policy->'maximum')='number' and proposed>(policy->>'maximum')::numeric)
  then return private.clair_plan_order_dispense_failure('{}','applicable','prepared_quantity_out_of_range'); end if;
  fingerprint:=encode(digest(jsonb_build_object('authority',a,'dose',p_order.detail_inputs->'dose',
    'doseBasis',result->'doseBasis','doseUnit',result->'doseUnit','weightSnapshot',result->'weightSnapshot',
    'totalOccurrences',count,'theoreticalTotalQuantity',theoretical*count,'proposed',proposed)::text,'sha256'),'hex');
  source:='preparation_policy'; actual:=proposed;
  if existing->>'preparationSchemaVersion'='2' and existing->>'actualDispenseSource'='manual_override'
    and jsonb_typeof(existing->'actualDispenseQuantity')='number' then
    actual:=(existing->>'actualDispenseQuantity')::numeric; source:='manual_override';
  end if;
  result:=result || jsonb_build_object(
    'preparationSchemaVersion',2,'preparationQuantityScope',scope,
    'calculationMode',a->>'calculationMode','preparationPolicy',policy,
    'theoreticalTotalQuantity',theoretical*count,
    'proposedActualDispenseQuantity',proposed,'proposedPlannedPracticalQuantity',proposed,
    'actualDispenseQuantity',actual,'actualDispenseSource',source,
    'actualDispenseOverride',case when source='manual_override' then existing->'actualDispenseOverride' else null end,
    'requiresReconfirmation',source='manual_override' and (
      coalesce((existing->>'requiresReconfirmation')::boolean,false)
      or existing->>'inputFingerprint' is distinct from fingerprint),
    'totalRequiredDispenseQuantity',case when scope='course_total' then actual else actual*count end,
    'inputFingerprint',fingerprint);
  return private.clair_normalize_preparation_v2(result);
end $fn$;
revoke all on function private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function private.clair_compute_dispense_before_preparation_v2(public.orders,timestamptz)
  from public,anon,authenticated,service_role;

-- Preserve the existing authenticated permission/CAS/idempotency/append-only
-- override contracts. Normalize immediately after their local quantity update,
-- before confirmed snapshots and billing consume it. Fail on upstream drift.
do $patch$
declare name text; definition text; anchor text; replacement text;
begin
  foreach name in array array[
    'public.clair_save_order_actual_dispense_override(text,uuid,uuid,timestamp with time zone,numeric,text,text)',
    'public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)'
  ] loop
    definition:=pg_get_functiondef(name::regprocedure);
    if name like '%clair_save_order_actual_dispense_override%' then
      anchor:=E'  update public.orders orders\n  set calculation_outputs = v_outputs, updated_at = v_now';
      replacement:=E'  v_outputs := private.clair_normalize_preparation_v2(v_outputs);\n'||anchor;
    else
      anchor:=E'      v_confirmed_snapshot := coalesce(\n        v_order.confirmed_snapshot,';
      replacement:=E'      v_calculation_outputs := private.clair_normalize_preparation_v2(v_calculation_outputs);\n'||anchor;
    end if;
    if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
      raise exception 'preparation v2 function anchor drift: %',name;
    end if;
    definition:=replace(definition,anchor,replacement);
    if name like '%clair_save_order_actual_dispense_override%' then
      anchor:=E'  update public.order_actual_dispense_overrides override_row\n  set result = v_result';
      replacement:=E'  if v_outputs->>''preparationSchemaVersion''=''2'' then\n'
        ||E'    v_result := v_result || jsonb_build_object(\n'
        ||E'      ''preparationSchemaVersion'',2,''preparationQuantityScope'',v_outputs->''preparationQuantityScope'',\n'
        ||E'      ''plannedPracticalDispenseQuantity'',v_outputs->''plannedPracticalDispenseQuantity'',\n'
        ||E'      ''plannedPracticalTotalQuantity'',v_outputs->''plannedPracticalTotalQuantity'');\n'
        ||E'  end if;\n'||anchor;
      if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
        raise exception 'preparation v2 response anchor drift';
      end if;
      definition:=replace(definition,anchor,replacement);
    end if;
    execute definition;
  end loop;
end $patch$;
