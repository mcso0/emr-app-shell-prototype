-- Fulfillment execution first records the actual-result/lifecycle authority and
-- then links billing. Prefer the frozen billing candidate when it exists so a
-- dispensing override (for example, three tablets from one order row) cannot
-- fall back to the legacy order quantity while creating the draft invoice.
-- Orders without an eligible unlinked candidate remain on the existing
-- compatibility path; this migration does not rewrite any linked invoice or
-- confirmed audit.
do $patch_execution_billing_handoff$
declare
  v_signature regprocedure :=
    'public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text)'::regprocedure;
  v_definition text;
  v_anchor text :=
    'perform public.clair_sync_billing_invoice_candidates_from_fulfillment(p_workspace_id,p_actor_user_id,t.encounter_id,array[t.order_id]);';
  v_replacement text := $replacement$if exists (
        select 1
        from public.order_billing_candidates candidate
        where candidate.workspace_id = p_workspace_id
          and candidate.encounter_id = t.encounter_id
          and candidate.order_id = t.order_id
          and candidate.status = 'candidate_created'
      ) then
        perform private.clair_link_chart_order_billing_candidates_internal(
          p_workspace_id, p_actor_user_id, t.encounter_id, array[t.order_id]
        );
      else
        perform public.clair_sync_billing_invoice_candidates_from_fulfillment(
          p_workspace_id, p_actor_user_id, t.encounter_id, array[t.order_id]
        );
      end if;$replacement$;
begin
  if to_regprocedure(
    'private.clair_link_chart_order_billing_candidates_internal(text,uuid,uuid,uuid[])'
  ) is null then
    raise exception 'dispensing_execution_billing_linker_missing';
  end if;

  select pg_get_functiondef(v_signature) into v_definition;
  if (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor) <> 1 then
    raise exception 'dispensing_execution_billing_handoff_anchor_drift';
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end;
$patch_execution_billing_handoff$;
