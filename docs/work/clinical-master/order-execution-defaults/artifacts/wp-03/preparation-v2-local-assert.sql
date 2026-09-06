-- Direct real PostgreSQL calculator parity; no inserted clinical order required.
do $test$
declare o public.orders; a jsonb; result jsonb; previous jsonb; fingerprint text;
begin
  o.workspace_id:='clair-demo'; o.clinical_order_type:='dispensing';
  o.detail_inputs:='{"dose":0.25,"doseUnit":"tablet","doseBasis":"head","frequency":"tid","durationDays":5}';
  a:='{"schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"tablet","preparationPolicy":{"quantityScope":"course_total","increment":0.5,"roundingMode":"up","displayPrecision":1}}';
  o.applied_snapshot:=jsonb_build_object('planOrderAuthority',a);
  o.calculation_outputs:='{}';
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if result->>'calculationStatus' is distinct from 'ready' or (result->>'theoreticalTotalQuantity')::numeric is distinct from 3.75
    or (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 4
    or (result->>'totalRequiredDispenseQuantity')::numeric is distinct from 4
    or result ? 'actualPerformedQuantity' then raise exception 'test course rounding failed: %',result; end if;
  previous:=result;
  o.detail_inputs:=o.detail_inputs||'{"totalOccurrences":2}';
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if result->>'calculationError' is distinct from 'occurrence_plan_conflict' then raise exception 'test conflicting count accepted'; end if;
  o.detail_inputs:=o.detail_inputs-'totalOccurrences';
  o.detail_inputs:=jsonb_set(jsonb_set(o.detail_inputs,'{dose}','0.1'),'{durationDays}','1');
  o.applied_snapshot:=jsonb_set(o.applied_snapshot,'{planOrderAuthority,preparationPolicy,increment}','0.1');
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 0.3 then raise exception 'test decimal increment parity'; end if;
  o.applied_snapshot:=jsonb_build_object('planOrderAuthority',a);
  o.detail_inputs:=jsonb_set(o.detail_inputs,'{durationDays}','5');
  o.detail_inputs:=jsonb_set(o.detail_inputs,'{dose}','0.5');
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 7.5 then raise exception 'test edited product dose ignored'; end if;
  o.detail_inputs:=jsonb_set(o.detail_inputs,'{dose}','0.25');
  o.calculation_outputs:=previous||'{"actualDispenseQuantity":4.5,"actualDispenseSource":"manual_override"}';
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 4.5 or (result->>'requiresReconfirmation')::boolean then
    raise exception 'test unchanged manual preparation lost'; end if;
  o.detail_inputs:=jsonb_set(o.detail_inputs,'{durationDays}','6');
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if not (result->>'requiresReconfirmation')::boolean then raise exception 'test changed course did not invalidate override'; end if;
  o.calculation_outputs:=result;
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if not (result->>'requiresReconfirmation')::boolean then raise exception 'test recalculation silently confirmed override'; end if;
  o.calculation_outputs:='{}';
  o.detail_inputs:='{"dose":0.25,"doseUnit":"tablet","doseBasis":"head","frequency":"sid","durationDays":1}';
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if (result->>'theoreticalTotalQuantity')::numeric is distinct from 0.25 or (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 0.5 then
    raise exception 'test a006858 rounding failed'; end if;
  o.detail_inputs:=o.detail_inputs-'durationDays';
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if result->>'calculationError' is distinct from 'occurrence_plan_required' then raise exception 'test implicit course accepted: %',result; end if;
  o.detail_inputs:=o.detail_inputs||'{"doseUnit":"drop","durationDays":1}';
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if result->>'calculationError' is distinct from 'unit_conversion_missing' then raise exception 'test invented product unit conversion'; end if;
  o.detail_inputs:=o.detail_inputs||'{"doseUnit":"tablet","frequency":"tid","durationDays":5}';
  o.applied_snapshot:=jsonb_set(o.applied_snapshot,'{planOrderAuthority,preparationPolicy,quantityScope}','"per_administration"');
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 7.5 then raise exception 'test explicit per administration changed'; end if;
  -- Version 1 keeps its original fixed-product and per-administration semantics.
  o.applied_snapshot:=jsonb_build_object('planOrderAuthority',(a-'preparationPolicy')||
    '{"schemaVersion":1,"calculationMode":"fixed_product","fixedProductQuantity":0.25,"fixedProductQuantityBasis":"head"}');
  result:=private.clair_compute_plan_order_dispense_projection(o,now());
  if result is distinct from private.clair_compute_dispense_before_preparation_v2(o,now()) then raise exception 'test V1 calculation changed'; end if;
  -- Normalizer is the shared post-override boundary, before billing/snapshots.
  result:=private.clair_normalize_preparation_v2(previous||'{"actualDispenseQuantity":5,"totalRequiredDispenseQuantity":75}');
  if (result->>'totalRequiredDispenseQuantity')::numeric is distinct from 5 or (result->>'plannedPracticalTotalQuantity')::numeric is distinct from 5 then
    raise exception 'test override multiplied total twice'; end if;
end $test$;
