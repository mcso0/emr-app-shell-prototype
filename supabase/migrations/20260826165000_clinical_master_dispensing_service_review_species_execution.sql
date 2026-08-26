-- Service-operations review is not a clinical species authorization. Preserve
-- the patient species in lineage, but do not require a clinical override form
-- that the service-review UI intentionally does not expose.

set lock_timeout = '5s';
set statement_timeout = '120s';

do $block$
declare
  v_function regprocedure := to_regprocedure(
    'private.clair_set_dispensing_order_lineage()'
  );
  v_definition text;
  v_override_needle text := $needle$  if not v_master_species_approved
    and (tg_op = 'INSERT' or old.order_confirmation_status in ('draft', 'pending')) then$needle$;
  v_override_replacement text := $replacement$  if not v_master_species_approved
    and not v_service_review_allowed
    and (tg_op = 'INSERT' or old.order_confirmation_status in ('draft', 'pending')) then$replacement$;
  v_basis_needle text := $needle$    'speciesUseBasis', case
      when v_master_species_approved then 'master_reviewed'
      else 'workspace_extra_label_override'
    end,$needle$;
  v_basis_replacement text := $replacement$    'speciesUseBasis', case
      when v_master_species_approved then 'master_reviewed'
      when v_service_review_allowed then 'service_operations_review'
      else 'workspace_extra_label_override'
    end,$replacement$;
  v_attestation_needle text := $needle$    'extraLabelSpeciesAttestation', case
      when v_master_species_approved then null$needle$;
  v_attestation_replacement text := $replacement$    'extraLabelSpeciesAttestation', case
      when v_master_species_approved or v_service_review_allowed then null$replacement$;
  v_count integer;
begin
  if v_function is null then
    raise exception 'clair_set_dispensing_order_lineage_missing';
  end if;

  select pg_get_functiondef(v_function) into v_definition;

  if position(
    $$when v_service_review_allowed then 'service_operations_review'$$
    in v_definition
  ) > 0 then
    return;
  end if;

  v_count := (
    length(v_definition) - length(replace(v_definition, v_override_needle, ''))
  ) / length(v_override_needle);
  if v_count <> 1 then
    raise exception 'clair_set_dispensing_order_lineage_override_gate_unexpected';
  end if;
  v_definition := replace(
    v_definition,
    v_override_needle,
    v_override_replacement
  );

  v_count := (
    length(v_definition) - length(replace(v_definition, v_basis_needle, ''))
  ) / length(v_basis_needle);
  if v_count <> 1 then
    raise exception 'clair_set_dispensing_order_lineage_species_basis_unexpected';
  end if;
  v_definition := replace(
    v_definition,
    v_basis_needle,
    v_basis_replacement
  );

  v_count := (
    length(v_definition) - length(replace(v_definition, v_attestation_needle, ''))
  ) / length(v_attestation_needle);
  if v_count <> 1 then
    raise exception 'clair_set_dispensing_order_lineage_attestation_unexpected';
  end if;

  execute replace(
    v_definition,
    v_attestation_needle,
    v_attestation_replacement
  );
end;
$block$;

revoke all on function private.clair_set_dispensing_order_lineage()
  from public, anon, authenticated, service_role;
