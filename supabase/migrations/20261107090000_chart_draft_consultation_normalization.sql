-- The API no longer fetches the full catalog to normalize consultation rows.
-- Preserve its valid optional-detail behavior at the existing server authority:
-- an individual consultation without detailInputs still gets the encounter vet.
-- Other orders retain omitted-detail semantics. Calculation and confirmation
-- functions, permissions, CAS, and grants are unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $patch$
declare
  target regprocedure := 'public.clair_save_chart_order_draft_encounter_base(text,text,uuid,jsonb)'::regprocedure;
  definition text;
  old_guard text := E'      and v_row ? ''detailInputs''\n      and exists (';
  old_assignment text := E'    then\n      v_row := pg_catalog.jsonb_set(\n        v_row,\n        ''{detailInputs}'',';
  new_assignment text := E'    then\n      -- consultation_optional_details_v1: match the former API default.\n      if not (v_row ? ''detailSchemaVersion'') then\n        v_row := pg_catalog.jsonb_set(v_row, ''{detailSchemaVersion}'', ''1''::jsonb, true);\n      end if;\n      v_row := pg_catalog.jsonb_set(\n        v_row,\n        ''{detailInputs}'',';
begin
  definition := pg_get_functiondef(target);
  if strpos(definition, 'consultation_optional_details_v1') > 0 then return; end if;
  if strpos(definition, old_guard) = 0 or strpos(definition, old_assignment) = 0 then
    raise exception 'consultation_draft_normalization_patch_target_mismatch';
  end if;
  definition := replace(definition, old_guard, E'      and exists (');
  definition := replace(definition, old_assignment, new_assignment);
  execute definition;
end $patch$;
commit;
