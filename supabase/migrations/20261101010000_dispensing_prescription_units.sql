-- Local candidate: preserve physical prescription quantity across unit edits.
-- No historical row rewrite, permission widening, or change to prior calculators.
set lock_timeout = '5s';
set statement_timeout = '120s';

alter function private.clair_order_detail_field_schema_v1(text) rename to clair_order_detail_field_schema_before_units;
create function private.clair_order_detail_field_schema_v1(p_clinical_order_type text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_clinical_order_type <> 'dispensing' then schema else
    pg_catalog.jsonb_set(schema,'{fields}',(select pg_catalog.jsonb_agg(
      case field->>'key'
        when 'doseUnit' then pg_catalog.jsonb_set(field,'{options}',
          '["mcg","mg","g","mL","L","tablet","capsule","drop","pipette","application","spray","mcg/kg","mg/kg","g/kg","mL/kg","L/kg","ml","ml/kg"]')
        when 'totalQuantityUnit' then pg_catalog.jsonb_set(field,'{options}',
          '["mcg","mg","g","mL","L","tablet","capsule","drop","pipette","application","spray","ml"]')
        else field end order by position)
      from pg_catalog.jsonb_array_elements(schema->'fields') with ordinality f(field,position))) end
  from (select private.clair_order_detail_field_schema_before_units(p_clinical_order_type) schema) source
$$;

create function private.clair_dispense_unit_key(unit_value text)
returns text language sql immutable set search_path='' as $$
  select case unit_value when 'ml' then 'mL' when 'ml/kg' then 'mL/kg' else unit_value end
$$;
create function private.clair_dispense_quantity_equal(a numeric,b numeric)
returns boolean language sql immutable set search_path='' as $$
  select a is not null and b is not null and abs(a-b)<=greatest(abs(a),abs(b))*0.000000000001
$$;

-- Traverse only SI edges and this product's explicit ratios, with reciprocal
-- edges. A conflicting reachable ratio invalidates the conversion component.
create function private.clair_dispense_conversion_factors(a jsonb,source_unit text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,private as $$
declare edges jsonb := '[{"fromUnit":"g","toUnit":"mg","factor":1000},{"fromUnit":"mg","toUnit":"mcg","factor":1000},{"fromUnit":"L","toUnit":"mL","factor":1000}]';
  edge jsonb; values_map jsonb:=jsonb_build_object(source_unit,1); queue text[]:=array[source_unit];
  position integer:=1; current_unit text; target_unit text; from_unit text; to_unit text;
  edge_factor numeric; factor numeric; previous numeric;
begin
  if a ? 'unitConversions' and jsonb_typeof(a->'unitConversions')<>'array' then return null; end if;
  for edge in select value from jsonb_array_elements(coalesce(a->'unitConversions','[]')) loop
    if jsonb_typeof(edge->'factor') is distinct from 'number' or (edge->>'factor')::numeric<=0
      or nullif(edge->>'fromUnit','') is null or nullif(edge->>'toUnit','') is null
      or strpos(edge->>'fromUnit','/')>0 or strpos(edge->>'toUnit','/')>0 then return null; end if;
    edges:=edges||jsonb_build_array(jsonb_build_object(
      'fromUnit',private.clair_dispense_unit_key(edge->>'fromUnit'),
      'toUnit',private.clair_dispense_unit_key(edge->>'toUnit'),'factor',edge->'factor'));
  end loop;
  while position<=cardinality(queue) loop
    current_unit:=queue[position]; position:=position+1;
    for edge in select value from jsonb_array_elements(edges) loop
      from_unit:=edge->>'fromUnit'; to_unit:=edge->>'toUnit'; edge_factor:=(edge->>'factor')::numeric;
      if from_unit=current_unit then target_unit:=to_unit;
      elsif to_unit=current_unit then target_unit:=from_unit; edge_factor:=1/edge_factor;
      else continue; end if;
      factor:=(values_map->>current_unit)::numeric*edge_factor;
      previous:=(values_map->>target_unit)::numeric;
      if previous is not null then
        if not private.clair_dispense_quantity_equal(previous,factor) then return null; end if;
      else
        values_map:=values_map||jsonb_build_object(target_unit,factor); queue:=array_append(queue,target_unit);
      end if;
    end loop;
  end loop;
  return values_map;
end $$;

create function private.clair_dispense_dose_factor(a jsonb,input_unit text,dose_basis text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,private as $$
declare source_unit text; output_unit text; factors jsonb; output_factors jsonb; strength jsonb:=a->'productStrength';
  numerator text; denominator text; ingredient_factor numeric; product_factor numeric; denominator_factor numeric; factor numeric;
begin
  if nullif(a->>'dispenseUnit','') is null or coalesce(a->>'calculationMode','') not in ('ingredient_based','product_unit','fixed_product') then
    return jsonb_build_object('error','configuration_missing'); end if;
  if input_unit is null or coalesce(dose_basis,'') not in ('patient','head','kg') or (input_unit like '%/kg' and dose_basis<>'kg') then
    return jsonb_build_object('error','unit_conversion_missing'); end if;
  source_unit:=private.clair_dispense_unit_key(case when dose_basis='kg' then regexp_replace(input_unit,'/kg$','') else input_unit end);
  output_unit:=private.clair_dispense_unit_key(a->>'dispenseUnit');
  factors:=private.clair_dispense_conversion_factors(a,source_unit);
  if factors is null then return jsonb_build_object('error','unit_conversion_ambiguous'); end if;
  product_factor:=(factors->>output_unit)::numeric;
  if jsonb_typeof(strength)='object' and nullif(a->>'referenceIngredientId','') is not null then
    if jsonb_typeof(strength->'numeratorValue') is distinct from 'number' or jsonb_typeof(strength->'denominatorValue') is distinct from 'number'
      or (strength->>'numeratorValue')::numeric<=0 or (strength->>'denominatorValue')::numeric<=0 then return jsonb_build_object('error','configuration_missing'); end if;
    numerator:=private.clair_dispense_unit_key(strength->>'numeratorUnit'); denominator:=private.clair_dispense_unit_key(strength->>'denominatorUnit');
    if numerator is null or denominator is null then return jsonb_build_object('error','configuration_missing'); end if;
    output_factors:=private.clair_dispense_conversion_factors(a,denominator);
    if output_factors is null then return jsonb_build_object('error','unit_conversion_ambiguous'); end if;
    denominator_factor:=(output_factors->>output_unit)::numeric;
    if denominator_factor is null then return jsonb_build_object('error','configuration_missing'); end if;
    ingredient_factor:=(factors->>numerator)::numeric*(strength->>'denominatorValue')::numeric/(strength->>'numeratorValue')::numeric*denominator_factor;
    if ingredient_factor is not null and product_factor is not null and not private.clair_dispense_quantity_equal(ingredient_factor,product_factor) then
      if a->>'calculationMode'='ingredient_based' and source_unit=numerator and numerator<>denominator and
        ((numerator in ('mcg','mg','g') and denominator in ('mcg','mg','g')) or (numerator in ('mL','L') and denominator in ('mL','L'))) then
        return jsonb_build_object('factor',ingredient_factor); end if;
      return jsonb_build_object('error','unit_conversion_ambiguous');
    end if;
  elsif a->>'calculationMode'='ingredient_based' then return jsonb_build_object('error','configuration_missing'); end if;
  factor:=coalesce(ingredient_factor,product_factor);
  if factor is null or factor<=0 then return jsonb_build_object('error','unit_conversion_missing'); end if;
  return jsonb_build_object('factor',factor);
end $$;

alter function private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz) rename to clair_compute_dispense_before_unit_inputs;
create function private.clair_compute_plan_order_dispense_projection(p_order public.orders,p_effective_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private,extensions as $$
declare a jsonb:=private.clair_order_dispensing_authority(p_order); scratch public.orders:=p_order;
  existing jsonb:=coalesce(p_order.calculation_outputs,'{}'); conversion jsonb; product_dose numeric;
  context_hash text; semantic_hash text; fingerprint text; result jsonb; unchanged boolean;
begin
  if p_order.clinical_order_type<>'dispensing' or p_order.row_type='set' then
    return private.clair_compute_dispense_before_unit_inputs(p_order,p_effective_at); end if;
  if jsonb_typeof(p_order.detail_inputs->'dose') is distinct from 'number' or (p_order.detail_inputs->>'dose')::numeric<=0 then
    return private.clair_dispense_request_failure(existing,'dose_missing'); end if;
  conversion:=private.clair_dispense_dose_factor(a,p_order.detail_inputs->>'doseUnit',p_order.detail_inputs->>'doseBasis');
  if conversion ? 'error' then return private.clair_dispense_request_failure(existing,conversion->>'error'); end if;
  product_dose:=(p_order.detail_inputs->>'dose')::numeric*(conversion->>'factor')::numeric;
  context_hash:=encode(digest(jsonb_build_object('authority',a,'rule',p_order.dispense_request_rule_snapshot,
    'inputs',p_order.detail_inputs-'dose'-'doseUnit')::text,'sha256'),'hex');
  -- Keep the previous exact quantity across binary-number representation noise.
  -- Real amount/basis/rule changes still recalculate and require confirmation.
  if existing->>'prescriptionUnitContext'=context_hash and private.clair_dispense_quantity_equal(
    (existing->>'prescriptionProductDose')::numeric,product_dose) then
    product_dose:=(existing->>'prescriptionProductDose')::numeric; end if;
  scratch.detail_inputs:=p_order.detail_inputs||jsonb_build_object('dose',product_dose,'doseUnit',a->>'dispenseUnit');
  scratch.dispensing_authority_snapshot:=a||jsonb_build_object('calculationMode','fixed_product','fixedProductQuantity',product_dose,
    'fixedProductQuantityBasis',case p_order.detail_inputs->>'doseBasis' when 'patient' then 'head' else p_order.detail_inputs->>'doseBasis' end);
  scratch.applied_snapshot:=jsonb_set(coalesce(scratch.applied_snapshot,'{}'),'{planOrderAuthority}',scratch.dispensing_authority_snapshot);
  result:=private.clair_compute_dispense_before_unit_inputs(scratch,p_effective_at);
  if result->>'calculationStatus' is distinct from 'ready' then return result; end if;
  semantic_hash:=encode(digest(jsonb_build_object('context',context_hash,'weight',result->'weightSnapshot',
    'count',result->'totalOccurrences')::text,'sha256'),'hex');
  unchanged:=coalesce(existing->>'prescriptionSemanticContext'=semantic_hash and private.clair_dispense_quantity_equal(
    (existing->>'prescriptionProductDose')::numeric,product_dose),false);
  fingerprint:=case when unchanged then existing->>'inputFingerprint' else encode(digest(
    jsonb_build_object('context',semantic_hash,'productDose',product_dose)::text,'sha256'),'hex') end;
  return result||jsonb_build_object('calculationMode',a->>'calculationMode','dosePerAdministration',p_order.detail_inputs->'dose',
    'doseUnit',p_order.detail_inputs->>'doseUnit','productStrength',a->'productStrength','referenceIngredientId',a->>'referenceIngredientId',
    'prescriptionProductDose',product_dose,'prescriptionUnitContext',context_hash,'prescriptionSemanticContext',semantic_hash,
    'inputFingerprint',fingerprint,'requiresReconfirmation',result->>'actualDispenseSource'='manual_override' and
      (coalesce((existing->>'requiresReconfirmation')::boolean,false) or not unchanged));
end $$;

revoke all on function private.clair_order_detail_field_schema_before_units(text),private.clair_order_detail_field_schema_v1(text),
  private.clair_dispense_unit_key(text),private.clair_dispense_quantity_equal(numeric,numeric),private.clair_dispense_conversion_factors(jsonb,text),
  private.clair_dispense_dose_factor(jsonb,text,text),private.clair_compute_dispense_before_unit_inputs(public.orders,timestamptz),
  private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz)
from public,anon,authenticated,service_role;
