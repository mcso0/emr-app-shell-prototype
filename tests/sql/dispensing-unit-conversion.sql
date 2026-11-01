-- Executed with the real V1 detail schema/validator and request calculator chain.
do $$
declare p public.orders; a jsonb; result jsonb; baseline jsonb; sample jsonb; factor jsonb;
begin
  a:='{"schemaVersion":1,"calculationMode":"ingredient_based","dispenseUnit":"mL","referenceIngredientId":"synthetic-reference","productStrength":{"numeratorValue":16,"numeratorUnit":"mg","denominatorValue":1,"denominatorUnit":"mL"}}';
  p.id:='80000000-0000-4000-8000-000000000001'; p.workspace_id:='hospital-a';
  p.encounter_id:='81000000-0000-4000-8000-000000000001'; p.row_type:='individual'; p.clinical_order_type:='dispensing';
  p.order_confirmation_status:='draft'; p.status:='requested'; p.applied_snapshot:=jsonb_build_object('planOrderAuthority',a);
  p.dispensing_authority_snapshot:=a; p.calculation_outputs:='{}';
  p.detail_inputs:='{"dose":16,"doseUnit":"mg","doseBasis":"patient","frequency":"bid","durationDays":3,"route":"PO","totalQuantity":1}';
  baseline:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  perform pg_temp.assert_true(baseline->>'calculationStatus'='ready' and (baseline->>'theoreticalTotalQuantity')::numeric=6,'unit baseline 16mg/mL: '||baseline::text);
  for sample in select value from jsonb_array_elements('[{"dose":16000,"doseUnit":"mcg"},{"dose":16,"doseUnit":"mg"},{"dose":0.016,"doseUnit":"g"},{"dose":1,"doseUnit":"mL"},{"dose":1,"doseUnit":"ml"},{"dose":0.001,"doseUnit":"L"}]') loop
    p.detail_inputs:=p.detail_inputs||sample;
    perform pg_temp.assert_true(private.clair_order_detail_inputs_are_valid('dispensing',1,p.detail_inputs,true),'real detail validator accepts '||(sample->>'doseUnit'));
    result:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
    perform pg_temp.assert_true(result->>'calculationStatus'='ready' and (result->>'theoreticalDispenseQuantity')::numeric=1 and (result->>'theoreticalTotalQuantity')::numeric=6,'equivalent product dose '||(sample->>'doseUnit'));
    perform pg_temp.assert_true(result->>'doseUnit'=sample->>'doseUnit' and result->'dosePerAdministration'=sample->'dose','original prescription representation retained');
  end loop;
  p.row_type:='set_child'; p.applied_snapshot:='{"exactB3":"unchanged"}';
  result:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  perform pg_temp.assert_true((result->>'theoreticalDispenseQuantity')::numeric=1 and p.applied_snapshot='{"exactB3":"unchanged"}'::jsonb,'set child uses dedicated authority without mutating B3');
  p.row_type:='individual'; p.applied_snapshot:=jsonb_build_object('planOrderAuthority',a);
  perform pg_temp.assert_true(not private.clair_order_detail_inputs_are_valid('dispensing',1,p.detail_inputs||'{"doseUnit":"bucket"}',true),'real validator rejects unknown unit');
  perform pg_temp.assert_true(not private.clair_order_detail_inputs_are_valid('dispensing',1,p.detail_inputs||'{"dose":"abc"}',true),'real validator rejects nonnumeric dose');

  -- Manual values and confirmation state survive an equivalent unit-only edit.
  p.calculation_outputs:=baseline||'{"actualDispenseSource":"manual_override","actualDispenseQuantity":5.5,"requiresReconfirmation":false}';
  p.detail_inputs:=p.detail_inputs||'{"dose":1,"doseUnit":"mL"}';
  result:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  perform pg_temp.assert_true((result->>'actualDispenseQuantity')::numeric=5.5 and result->>'requiresReconfirmation'='false' and result->>'inputFingerprint'=baseline->>'inputFingerprint','manual value and fingerprint survive equivalent unit edit');
  p.calculation_outputs:=result; p.detail_inputs:=p.detail_inputs||'{"dose":2}';
  result:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  perform pg_temp.assert_true((result->>'actualDispenseQuantity')::numeric=5.5 and result->>'requiresReconfirmation'='true','real dose change retains manual amount and requires acknowledgment');

  -- kg is a separate prescription basis, using the encounter-scoped weight.
  insert into patient_vital_measurements(workspace_id,encounter_id,weight_kg,measured_at) values('hospital-a',p.encounter_id,5,'2026-10-31T23:00:00Z');
  p.calculation_outputs:='{}'; p.detail_inputs:=p.detail_inputs||'{"dose":1,"doseUnit":"mL/kg","doseBasis":"kg"}';
  result:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  perform pg_temp.assert_true((result->>'theoreticalDispenseQuantity')::numeric=5 and (result->>'theoreticalTotalQuantity')::numeric=30,'kg conversion applies weight once');
  p.encounter_id:='81000000-0000-4000-8000-000000000002';
  result:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  perform pg_temp.assert_true(result->>'calculationStatus'<>'ready','foreign encounter weight unavailable');
  perform pg_temp.assert_true(private.clair_dispense_dose_factor(a,'mL/kg','patient') ? 'error','per-kg unit cannot be used for head');
  perform pg_temp.assert_true(private.clair_dispense_dose_factor(a,'mg','body_surface_area') ? 'error','unsupported BSA remains blocked');

  -- No generic count/volume mapping. Only snapshot-specific ratios are allowed.
  perform pg_temp.assert_true(private.clair_dispense_dose_factor(a,'drop','patient') ? 'error','drops without product ratio blocked');
  factor:=private.clair_dispense_dose_factor(a||'{"unitConversions":[{"fromUnit":"mL","toUnit":"drop","factor":20},{"fromUnit":"spray","toUnit":"drop","factor":2}]}','spray','patient');
  perform pg_temp.assert_true((factor->>'factor')::numeric=0.1,'explicit inverse and chained ratio');
  perform pg_temp.assert_true(private.clair_dispense_dose_factor(a||'{"unitConversions":[{"fromUnit":"mL","toUnit":"drop","factor":20},{"fromUnit":"drop","toUnit":"ml","factor":0.1}]}','mg','patient')->>'error'='unit_conversion_ambiguous','conflicting alias ratios blocked');
  perform pg_temp.assert_true(private.clair_dispense_dose_factor(a||'{"unitConversions":[{"fromUnit":"mg","toUnit":"mL","factor":1}]}','mg','patient')->>'error'='unit_conversion_ambiguous','explicit ratio cannot contradict strength');
  perform pg_temp.assert_true(private.clair_dispense_dose_factor(jsonb_set(a,'{productStrength,numeratorValue}','0'),'mg','patient') ? 'error','zero strength blocked');
  perform pg_temp.assert_true(private.clair_dispense_dose_factor(a-'referenceIngredientId','mg','patient') ? 'error','compound reference ingredient required');
  factor:=private.clair_dispense_dose_factor('{"schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"ml"}','L','patient');
  perform pg_temp.assert_true((factor->>'factor')::numeric=1000,'product-only volume scaling');
  factor:=private.clair_dispense_dose_factor(a||'{"dispenseUnit":"tablet","productStrength":{"numeratorValue":20,"numeratorUnit":"mg","denominatorValue":1,"denominatorUnit":"tablet"}}','mg','patient');
  perform pg_temp.assert_true((factor->>'factor')::numeric=0.05,'tablet strength does not round fraction');
  factor:=private.clair_dispense_dose_factor(a||'{"dispenseUnit":"capsule","productStrength":{"numeratorValue":20,"numeratorUnit":"mg","denominatorValue":1,"denominatorUnit":"capsule"}}','capsule','patient');
  perform pg_temp.assert_true((factor->>'factor')::numeric=1,'capsule product input');
  factor:=private.clair_dispense_dose_factor(a||'{"dispenseUnit":"g","productStrength":{"numeratorValue":10,"numeratorUnit":"mg","denominatorValue":1,"denominatorUnit":"g"}}','g','patient');
  perform pg_temp.assert_true(factor->>'error'='unit_conversion_ambiguous','mass-per-mass input ambiguity blocked');

  -- Repeating decimal representation does not cross a rounding boundary on switch.
  p.encounter_id:='81000000-0000-4000-8000-000000000001';
  p.dispensing_authority_snapshot:=jsonb_set(a,'{productStrength,numeratorValue}','3');
  p.applied_snapshot:=jsonb_build_object('planOrderAuthority',p.dispensing_authority_snapshot);
  p.detail_inputs:=p.detail_inputs||'{"dose":1,"doseUnit":"mg","doseBasis":"patient","frequency":"sid","durationDays":3}';
  p.dispense_request_rule_snapshot:='{"schemaVersion":1,"version":1,"source":"theoretical","rule":{"mode":"up","increment":1,"unit":"mL","displayPrecision":0}}';
  p.calculation_outputs:='{}'; baseline:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  p.calculation_outputs:=baseline; p.detail_inputs:=p.detail_inputs||'{"dose":0.3333333333333333,"doseUnit":"mL"}';
  result:=private.clair_compute_plan_order_dispense_projection(p,'2026-11-01T00:00:00Z');
  perform pg_temp.assert_true(result->'theoreticalTotalQuantity'=baseline->'theoreticalTotalQuantity' and result->'actualDispenseQuantity'=baseline->'actualDispenseQuantity' and result->>'inputFingerprint'=baseline->>'inputFingerprint','unit switch preserves exact prior quantity before rounding');
end $$;
