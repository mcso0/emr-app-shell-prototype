begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create function pg_temp.patch_order_edit(signature text,old text,replacement text,expected integer default 1)
returns void language plpgsql as $$
declare body text;
begin
 body:=pg_get_functiondef(signature::regprocedure);
 if (length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'order edit patch drift: %',signature; end if;
 execute replace(body,old,replacement);
end $$;

-- Pending amendments use exactly the same authoritative projection and manual
-- quantity validation as replacement requests; they retain their existing task.
do $$
declare body text; projection text; start_at integer; end_at integer;
begin
 body:=pg_get_functiondef('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)'::regprocedure);
 start_at:=strpos(body,'      if v_changes ? ''actualDispenseMode'' then');
 end_at:=strpos(body,'      v_confirmed_snapshot := coalesce(');
 if start_at=0 or end_at<=start_at then raise exception 'order edit projection anchor drift'; end if;
 projection:=E'    v_edit_original_order:=v_order;\n'||substr(body,start_at,end_at-start_at)||E'    v_order:=v_edit_original_order;\n';
 perform pg_temp.patch_order_edit('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  '  v_order public.orders%rowtype;', '  v_order public.orders%rowtype; v_edit_original_order public.orders%rowtype;');
 perform pg_temp.patch_order_edit('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  'where field.key not in (''detailInputs'',''detailSchemaVersion'')',
  'where field.key not in (''detailInputs'',''detailSchemaVersion'',''actualDispenseMode'',''actualDispenseQuantity'')');
 perform pg_temp.patch_order_edit('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  E'    update public.orders orders\n    set\n      detail_inputs = v_detail_inputs,',
  projection||E'    update public.orders orders\n    set\n      calculation_outputs = v_calculation_outputs,\n      detail_inputs = v_detail_inputs,');
 perform pg_temp.patch_order_edit('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  '''amendedAt'', v_now',
  '''amendedAt'', v_now, ''calculationOutputs'',v_calculation_outputs, ''actualDispenseQuantity'',v_calculation_outputs->''actualDispenseQuantity'', ''totalRequiredDispenseQuantity'',v_calculation_outputs->''totalRequiredDispenseQuantity''');
end $$;

-- No fulfillment completion creates/links an invoice. Explicit chart billing
-- remains the only handoff for dispensing/treatment.
select pg_temp.patch_order_edit('public.clair_mutate_fulfillment_instruction(text,uuid,jsonb)',
 $old$   if next_status='completed' and coalesce((wi.source_snapshot->>'billingReflectionEnabled')::boolean,true) then
     if exists(select 1 from public.order_billing_candidates c where c.workspace_id=p_workspace_id and c.encounter_id=wi.encounter_id and c.order_id=wi.order_id and c.status='candidate_created') then
       perform private.clair_link_chart_order_billing_candidates_internal(p_workspace_id,actor,wi.encounter_id,array[wi.order_id]);
     else
       perform public.clair_sync_billing_invoice_candidates_from_fulfillment(p_workspace_id,actor,wi.encounter_id,array[wi.order_id]);
     end if;
   end if;$old$,
 '   -- Billing handoff requires an explicit 수납 요청.');
select pg_temp.patch_order_edit('public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text)',
 $old$if exists (
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
      end if;$old$,
 $new$if t.destination_module not in ('dispensing','treatment') then
        perform public.clair_sync_billing_invoice_candidates_from_fulfillment(p_workspace_id,p_actor_user_id,t.encounter_id,array[t.order_id]);
      end if;$new$);

-- Only the effective tax override is used at explicit billing freeze/link time.
select pg_temp.patch_order_edit('private.clair_link_chart_order_billing_candidates_internal(text,uuid,uuid,uuid[])',
 '    v_tax_type := coalesce(',
 '    v_tax_type := coalesce((select approved_values->>''taxClass'' from private.order_financial_edits where workspace_id=p_workspace_id and order_id=v_candidate.order_id),');
select pg_temp.patch_order_edit('public.clair_request_chart_order_billing(text,uuid,uuid,text,text,boolean)',
 '''taxClass'', candidate.tax_class_snapshot,',
 '''taxClass'', coalesce((select approved_values->>''taxClass'' from private.order_financial_edits where workspace_id=candidate.workspace_id and order_id=candidate.order_id),candidate.tax_class_snapshot),');
select pg_temp.patch_order_edit('public.clair_request_chart_order_billing(text,uuid,uuid,text,text,boolean)',
 'and candidate.tax_class_snapshot = ''taxable''',
 'and coalesce((select approved_values->>''taxClass'' from private.order_financial_edits where workspace_id=candidate.workspace_id and order_id=candidate.order_id),candidate.tax_class_snapshot) = ''taxable''');

-- Preserve assignment on replacements. The original requester remains the
-- order requester; an editor is recorded on the immutable revision itself.
select pg_temp.patch_order_edit('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 E'          requested_by_user_id = p_actor_user_id,\n          assigned_to_user_id = null,\n          assigned_by_user_id = null,\n          assigned_at = null,',
 E'          requested_by_user_id = coalesce(v_order.requested_by_user_id,item.requested_by_user_id),\n          assigned_to_user_id = item.assigned_to_user_id,\n          assigned_by_user_id = item.assigned_by_user_id,\n          assigned_at = item.assigned_at,');
select pg_temp.patch_order_edit('private.clair_notify_instruction_change()',
 'recipients:=array[old.assigned_to_user_id,new.assigned_to_user_id,main];',
 'recipients:=array[old.assigned_to_user_id,new.assigned_to_user_id,main,(select requested_by_user_id from public.orders where workspace_id=new.workspace_id and id=new.order_id)];',2);
select pg_temp.patch_order_edit('private.clair_emit_instruction_notifications(public.order_fulfillment_work_items,text,text,uuid[],text)',
 'where x is not null loop',
 'where x is not null and (event_key<>''order_recheck_requested'' or x is distinct from auth.uid()) loop');

-- Clinical versions participate in the existing actor/version acknowledgement
-- gate. Initial request is not a clinical revision. Assignment identity also
-- contributes to the key, preventing old confirmation reuse after reassignment.
create or replace function private.clair_task_effective_instructions(p_workspace_id text,p_task_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare t public.order_tasks; d jsonb; r private.order_clinical_edit_revisions; versions jsonb; text_value text; wi public.order_fulfillment_work_items;
begin
 select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id;
 if not found then return null; end if;
 d:=private.clair_order_effective_instructions(p_workspace_id,t.order_id,t.clinical_order_type,t.effective_snapshot);
 if d is null then return null; end if;
 select * into r from private.order_clinical_edit_revisions where workspace_id=p_workspace_id and order_id=t.order_id order by revision desc limit 1;
 if not found then return d; end if;
 select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and task_id=p_task_id;
 select string_agg(coalesce(labels.name,e.key)||': '||coalesce(r.before_values#>>array['detailInputs',e.key],'—')||' → '||coalesce(e.value#>>'{}','—'),E'\n' order by e.key)
 into text_value from jsonb_each(r.after_values->'detailInputs') e
 left join (values ('dose','용량'),('doseUnit','단위'),('doseBasis','용량 기준'),('durationDays','일수'),('frequency','횟수'),('route','경로'),('instruction','지시'),('memo','메모'),('administrationTiming','복용 시점'),('medicationInstruction','투여/복약'),('storageMethod','보관'),('totalQuantity','총 수량'),('totalQuantityUnit','총 수량 단위'),('method','처치 방법'),('site','처치 부위'),('administeredAmount','투여량'),('administeredUnit','투여 단위'),('schedule','일정')) labels(key,name) on labels.key=e.key
 where r.before_values#>array['detailInputs',e.key] is distinct from e.value;
 text_value:=coalesce(text_value,'요청 조제량 또는 조제량 입력 방식 변경')||E'\n사유: '||r.reason;
 versions:=d->'versions'||jsonb_build_object('clinical:'||t.order_id,r.revision);
 d:=jsonb_set(d,'{versions}',versions);
 d:=jsonb_set(d,'{entries}',d->'entries'||jsonb_build_array(jsonb_build_object('scope',t.clinical_order_type,'revision',r.revision,
  'kind','clinical_edit','orderId',t.order_id,'instruction',text_value,'deleted',false,
  'actorName',(select display_name from public.users where id=r.actor_id),'createdAt',r.created_at)));
 return jsonb_set(d,'{versionKey}',to_jsonb(encode(extensions.digest(jsonb_build_array(versions,t.id,wi.assigned_to_user_id,wi.assigned_at)::text,'sha256'),'hex')));
end $$;
revoke all on function private.clair_task_effective_instructions(text,uuid) from public,anon,authenticated,service_role;
-- The atomic edit RPC owns this bounded scope; caller-controlled GUCs cannot bypass it.
select pg_temp.patch_order_edit('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 $old$      raise exception 'billing_reversal_required'; end if;
    if v_action='re_request'$old$,
 $new$      if not exists(select 1 from private.confirmed_order_edit_scope s where s.transaction_id=txid_current() and s.workspace_id=p_workspace_id and s.order_id=p_order_id)
        or exists(select 1 from public.order_billing_candidates c where c.workspace_id=p_workspace_id and c.order_id=v_order.parent_chart_order_line_id and c.status='billing_review_required')
      then raise exception 'billing_reversal_required'; end if;
    end if;
    if v_action='re_request'$new$);
select pg_temp.patch_order_edit('private.clair_notify_instruction_change()',
 $old$   new.source_snapshot->'instruction' is distinct from old.source_snapshot->'instruction' then$old$,
 $new$   new.source_snapshot->'instruction' is distinct from old.source_snapshot->'instruction' or
   new.source_snapshot#>'{calculationOutputs,actualDispenseQuantity}' is distinct from old.source_snapshot#>'{calculationOutputs,actualDispenseQuantity}' or
   new.source_snapshot#>'{calculationOutputs,actualDispenseSource}' is distinct from old.source_snapshot#>'{calculationOutputs,actualDispenseSource}' then$new$);
select pg_temp.patch_order_edit('public.clair_request_chart_order_billing(text,uuid,uuid,text,text,boolean)',
 E'  perform 1\n  from public.orders orders',
 E'  perform pg_advisory_xact_lock(hashtextextended(''clinical_billing:''||p_workspace_id||'':''||p_encounter_id,0));\n  perform 1\n  from public.orders orders');

-- The pre-existing mutation endpoint also feeds performer acknowledgement.
select pg_temp.patch_order_edit('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 '  return v_result;',
 $new$  if v_order.clinical_order_type in ('dispensing','treatment') and v_action in ('amend','re_request')
    and (v_before->'detailInputs' is distinct from v_after->'detailInputs'
      or v_before#>'{calculationOutputs,actualDispenseQuantity}' is distinct from v_after#>'{calculationOutputs,actualDispenseQuantity}'
      or v_before#>'{calculationOutputs,actualDispenseSource}' is distinct from v_after#>'{calculationOutputs,actualDispenseSource}')
    and not exists(select 1 from private.confirmed_order_edit_scope s where s.transaction_id=txid_current() and s.workspace_id=p_workspace_id and s.order_id=p_order_id)
  then
    insert into private.order_clinical_edit_revisions(workspace_id,order_id,revision,command_id,before_values,after_values,reason,actor_id)
    select p_workspace_id,p_order_id,coalesce(max(r.revision),0)+1,v_revision.id,v_before,v_after,v_reason,p_actor_user_id
    from private.order_clinical_edit_revisions r where r.workspace_id=p_workspace_id and r.order_id=p_order_id;
  end if;
  return v_result;$new$);

-- Project effective approved values into the existing chart read contract.
-- Keep immutable unit_price_snapshot/applied_snapshot fields unchanged.
alter function public.clair_get_chart_order_draft(text,uuid) rename to clair_get_chart_order_draft_before_confirmed_edit;
revoke all on function public.clair_get_chart_order_draft_before_confirmed_edit(text,uuid) from public,anon,authenticated,service_role;
create function public.clair_get_chart_order_draft(p_workspace_id text,p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; rows jsonb;
begin
 d:=public.clair_get_chart_order_draft_before_confirmed_edit(p_workspace_id,p_encounter_id);
 if not private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:view') then return d; end if;
 select coalesce(jsonb_agg(case when f.order_id is null then row.value else
  row.value||jsonb_build_object('preBillingOverride',coalesce(row.value->'preBillingOverride','{}'::jsonb)||private.clair_order_effective_financial(p_workspace_id,f.order_id)) end order by row.ordinality),'[]'::jsonb)
 into rows from jsonb_array_elements(d->'rows') with ordinality row(value,ordinality)
 left join private.order_financial_edits f on f.workspace_id=p_workspace_id and f.order_id=(row.value->>'orderId')::uuid;
 return jsonb_set(d,'{rows}',rows);
end $$;
revoke all on function public.clair_get_chart_order_draft(text,uuid) from public,anon,service_role;
grant execute on function public.clair_get_chart_order_draft(text,uuid) to authenticated;

-- Confirmed rows are loaded through order-actions, separately from drafts.
alter function public.clair_get_chart_order_actions(text,uuid) rename to clair_get_chart_order_actions_before_confirmed_edit;
revoke all on function public.clair_get_chart_order_actions_before_confirmed_edit(text,uuid) from public,anon,authenticated,service_role;
create function public.clair_get_chart_order_actions(p_workspace_id text,p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; rows jsonb;
begin
 d:=public.clair_get_chart_order_actions_before_confirmed_edit(p_workspace_id,p_encounter_id);
 if not private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:view') then return d; end if;
 select coalesce(jsonb_agg(case when f.order_id is null then row.value else
  row.value||jsonb_build_object('preBillingOverride',coalesce(row.value->'preBillingOverride','{}'::jsonb)||private.clair_order_effective_financial(p_workspace_id,f.order_id)) end order by row.ordinality),'[]'::jsonb)
 into rows from jsonb_array_elements(d->'rows') with ordinality row(value,ordinality)
 left join lateral (select c.order_id from public.order_billing_candidates c
   where c.workspace_id=p_workspace_id and c.order_id=(row.value->>'orderId')::uuid and c.status<>'cancelled'
   order by c.billing_cycle desc limit 1) f on true;
 return jsonb_set(d,'{rows}',rows);
end $$;
revoke all on function public.clair_get_chart_order_actions(text,uuid) from public,anon,service_role;
grant execute on function public.clair_get_chart_order_actions(text,uuid) to authenticated;

-- Shared chart instructions may reuse acknowledgement history, but a clinical
-- revision from another order must never appear as this order's previous values.
do $clinical_previous_scope$
declare definition text; anchor text := 'and (scope=t.clinical_order_type or version_key=d->>''versionKey'')';
begin
 definition:=pg_get_functiondef('public.clair_get_task_instruction_review(text,uuid)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
  raise exception 'clinical previous instruction scope patch drift';
 end if;
 execute replace(definition,anchor,anchor||$scope$
   and not exists(select 1 from jsonb_array_elements(document->'entries') entry
     where entry->>'kind'='clinical_edit' and entry->>'orderId' is distinct from t.order_id::text)$scope$);
end $clinical_previous_scope$;
commit;
