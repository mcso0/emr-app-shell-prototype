-- Run only in an isolated empty/synthetic database with all application schema
-- migrations applied. This transaction always rolls back its synthetic rows.
begin;
set local statement_timeout='20s';
insert into auth.users(id) select ('81000000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,4) n;
insert into public.users(id,display_name,status) select ('81000000-0000-4000-8000-00000000000'||n)::uuid,'합성 담당자 '||n,'active' from generate_series(1,4) n;
insert into public.workspaces(id,display_name,status) values('synthetic-order-edit','Synthetic order editing','active'),('synthetic-edit-other','Synthetic foreign workspace','active');
insert into public.user_memberships(workspace_id,user_id,roles,status) select 'synthetic-order-edit',('81000000-0000-4000-8000-00000000000'||n)::uuid,
 case n when 3 then array['technician'] when 2 then array['vet'] else array['hospital_admin'] end,'active' from generate_series(1,4) n;
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions) values
 ('80000000-0000-4000-8000-000000000003','synthetic-order-edit','synthetic_technician','Synthetic technician','standard','{"allowed":["chart:view","dispensing:view","dispensing:complete"]}');
insert into public.workspace_membership_permission_role_assignments(membership_id,workspace_id,permission_role_id)
 select id,workspace_id,'80000000-0000-4000-8000-000000000003' from public.user_memberships where workspace_id='synthetic-order-edit' and user_id='81000000-0000-4000-8000-000000000003' on conflict(membership_id) do update set permission_role_id=excluded.permission_role_id;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
insert into public.guardians(id,workspace_id,name) values('82000000-0000-4000-8000-000000000001','synthetic-order-edit','합성 보호자');
insert into public.patients(id,workspace_id,patient_no,name,species) values('83000000-0000-4000-8000-000000000001','synthetic-order-edit','SYNTHETIC-001','합성 환자','dog');
insert into public.encounters(id,workspace_id,patient_id,guardian_id,encounter_no,reception_type,status) values('84000000-0000-4000-8000-000000000001','synthetic-order-edit','83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','SYNTHETIC-EDIT-001','walk_in','in_consultation');
insert into public.soap_notes(id,workspace_id,encounter_id,status) values('85000000-0000-4000-8000-000000000001','synthetic-order-edit','84000000-0000-4000-8000-000000000001','draft');
insert into public.workspace_order_billing_policies(workspace_id,vat_calculation_policy) values('synthetic-order-edit','vat_included');
insert into public.orders(id,workspace_id,encounter_id,origin_chart_id,order_type,clinical_order_type,execution_mode,destination_module,display_name,status,order_confirmation_status,detail_schema_version,detail_inputs,applied_snapshot,unit_price_snapshot,quantity,billing_reflection_enabled,requested_by_user_id)
select ('86000000-0000-4000-8000-00000000000'||n)::uuid,'synthetic-order-edit','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001',
 'dispensing','dispensing','routed','dispensing','합성 약품 '||n,'confirmed','confirmed',1,
 '{"doseBasis":"patient","dose":1,"doseUnit":"tablet","route":"PO","frequency":"sid","durationDays":2,"totalQuantity":2,"totalQuantityUnit":"tablet","medicationInstruction":"any_time","storageMethod":"room_temp"}'::jsonb,
 '{"displayName":"합성 약품","billingName":"합성 약품","taxType":"non_taxable","planOrderAuthority":{"schemaVersion":1,"calculationMode":"fixed_product","fixedProductQuantity":1,"fixedProductQuantityBasis":"head","dispenseUnit":"tablet","priceBasis":"per_day","billingUnit":"day","taxClass":"non_taxable"}}'::jsonb,
 5000,2,true,'81000000-0000-4000-8000-000000000002'
from generate_series(1,3) n;
insert into public.order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,effective_snapshot,created_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at)
select ('87000000-0000-4000-8000-'||right(o.id::text,12))::uuid,o.workspace_id,o.encounter_id,o.id,'execution','dispensing','dispensing',
 jsonb_build_object('orderDisplayName',o.display_name,'detailInputs',o.detail_inputs,'detailSchemaVersion',1,'calculationOutputs',o.calculation_outputs,'billingReflectionEnabled',true),
 '81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001',now() from public.orders o where workspace_id='synthetic-order-edit';
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,clinical_order_type,destination_module,task_id,task_attempt_no,source_snapshot,requested_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at)
select ('88000000-0000-4000-8000-'||right(t.id::text,12))::uuid,t.workspace_id,t.encounter_id,t.order_id,'dispensing','dispensing','dispensing','dispensing',t.id,1,t.effective_snapshot,
 '81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001',now() from public.order_tasks t where workspace_id='synthetic-order-edit';
insert into public.order_confirmation_commands(id,workspace_id,encounter_id,actor_user_id,idempotency_key,request_sha256,expected_draft_etag,selected_root_order_ids) values('89000000-0000-4000-8000-000000000001','synthetic-order-edit','84000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','synthetic-confirmation',repeat('a',64),'"'||repeat('b',64)||'"',array['86000000-0000-4000-8000-000000000001'::uuid]);
insert into public.order_billing_candidates(id,workspace_id,encounter_id,order_id,task_id,billing_name_snapshot,quantity,unit_price,amount,source_snapshot,created_by_user_id,confirmation_command_id,price_basis_snapshot,billing_unit_snapshot,tax_class_snapshot)
select 'synthetic-candidate-'||o.id,o.workspace_id,o.encounter_id,o.id,t.id,o.display_name,2,5000,10000,
 t.effective_snapshot||jsonb_build_object('preBillingOverride',jsonb_build_object('adjustmentSource','amount','adjustmentAmountKrw',-1000,'adjustmentPercent',-10,'adjustmentReason','합성 할인')),
 '81000000-0000-4000-8000-000000000001','89000000-0000-4000-8000-000000000001','per_day','day','non_taxable'
from public.orders o join public.order_tasks t on t.workspace_id=o.workspace_id and t.order_id=o.id where o.workspace_id='synthetic-order-edit';
update public.order_billing_candidates set amount=9000 where workspace_id='synthetic-order-edit';

create function pg_temp.edit(order_id uuid, financial jsonb default null, clinical jsonb default null, reason text default '') returns jsonb language plpgsql as $$
declare d jsonb; cmd jsonb;
begin
 d:=public.clair_get_confirmed_order_edit('synthetic-order-edit','85000000-0000-4000-8000-000000000001',order_id);
 cmd:=jsonb_strip_nulls(jsonb_build_object('orderId',order_id,'chartId','85000000-0000-4000-8000-000000000001','commandId',gen_random_uuid(),'expectedVersion',d->>'version','financial',financial,'clinical',clinical,'reason',reason));
 return public.clair_edit_confirmed_order('synthetic-order-edit','85000000-0000-4000-8000-000000000001',order_id,cmd);
end $$;

create function pg_temp.assert_true(v boolean,msg text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'ASSERT: %',msg; end if; end $$;
do $$
declare d jsonb; r jsonb; cmd jsonb; task_before jsonb; notifications bigint; commands bigint; old_tax text; inputs jsonb; inv uuid; line_before jsonb; change jsonb; partial_cmd jsonb; current_task uuid;
begin
 select to_jsonb(t) into task_before from public.order_tasks t where id='87000000-0000-4000-8000-000000000001';
 select count(*) into notifications from public.notification_events where workspace_id='synthetic-order-edit';
 d:=pg_temp.edit('86000000-0000-4000-8000-000000000001','{"unitPriceKrw":6000,"taxClass":"taxable"}');
 perform pg_temp.assert_true((d#>>'{financial,unitPriceKrw}')::numeric=6000,'financial price readback');
 perform pg_temp.assert_true((select (row->'preBillingOverride'->>'unitPriceKrw')::numeric=6000 from jsonb_array_elements(public.clair_get_chart_order_actions('synthetic-order-edit','84000000-0000-4000-8000-000000000001')->'rows') row where row->>'orderId'='86000000-0000-4000-8000-000000000001'),'confirmed chart reload keeps edited price');
 perform pg_temp.assert_true(d#>>'{financial,adjustmentSource}'='amount','fixed amount discount retained');
 perform pg_temp.assert_true((select amount=11000 and tax_class_snapshot='non_taxable' from public.order_billing_candidates where order_id='86000000-0000-4000-8000-000000000001'),'new amount and immutable tax authority');
 perform pg_temp.assert_true((select to_jsonb(t)=task_before from public.order_tasks t where id='87000000-0000-4000-8000-000000000001'),'financial-only preserves task');
 perform pg_temp.assert_true((select count(*)=notifications from public.notification_events where workspace_id='synthetic-order-edit'),'financial-only emits no clinical notification');
 select count(*) into commands from private.confirmed_order_edit_commands;
 perform pg_temp.edit('86000000-0000-4000-8000-000000000001','{"unitPriceKrw":6000}');
 perform pg_temp.assert_true((select count(*)=commands from private.confirmed_order_edit_commands),'unchanged input creates no history');
 cmd:=jsonb_build_object('orderId',d->>'orderId','chartId',d->>'chartId','commandId',gen_random_uuid(),'expectedVersion',d->>'version','financial',jsonb_build_object('unitPriceKrw',7000),'reason','');
 r:=public.clair_edit_confirmed_order('synthetic-order-edit','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001',cmd);
 perform public.clair_edit_confirmed_order('synthetic-order-edit','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001',cmd);
 perform pg_temp.assert_true((select count(*)=commands+1 from private.confirmed_order_edit_commands),'same request replay produces one audit');
 begin
  perform public.clair_edit_confirmed_order('synthetic-order-edit','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001',jsonb_set(cmd,'{commandId}',to_jsonb(gen_random_uuid())));
  raise exception 'stale version was accepted';
 exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 inputs:=jsonb_set(d->'detailInputs','{durationDays}','4');
 d:=pg_temp.edit('86000000-0000-4000-8000-000000000001',null,jsonb_build_object('detailInputs',inputs,'detailSchemaVersion',1,'actualDispenseMode','automatic'),'합성 처방 수정');
 perform pg_temp.assert_true(d#>>'{detailInputs,durationDays}'='4','clinical pending amendment');
 perform pg_temp.assert_true((select amount=27000 from public.order_billing_candidates where order_id='86000000-0000-4000-8000-000000000001'),'fixed 1000 discount survives quantity x2');
 perform pg_temp.assert_true((select count(*)=1 from public.order_tasks where order_id='86000000-0000-4000-8000-000000000001'),'pending amendment preserves one task');
 perform pg_temp.assert_true((select previous_value->>'durationDays'='2' and current_value->>'durationDays'='4' from public.order_revision_fields where workspace_id='synthetic-order-edit' and field_name='detailInputs' limit 1),'existing before/after history retained');
 perform pg_temp.assert_true((select count(*)=notifications+2 from public.notification_events where workspace_id='synthetic-order-edit'),'performer and original requester receive change once');
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
 r:=public.clair_get_task_instruction_review('synthetic-order-edit','87000000-0000-4000-8000-000000000001');
 perform pg_temp.assert_true((r->>'requiresAcknowledgement')::boolean,'clinical edit requires performer acknowledgement');
 begin
  perform private.clair_require_task_instruction_ack('synthetic-order-edit','87000000-0000-4000-8000-000000000001',auth.uid());
  raise exception 'missing acknowledgement was accepted';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 perform public.clair_acknowledge_task_instructions('synthetic-order-edit','87000000-0000-4000-8000-000000000001',r#>>'{current,versionKey}');
 perform private.clair_require_task_instruction_ack('synthetic-order-edit','87000000-0000-4000-8000-000000000001',auth.uid());
 begin
  perform pg_temp.edit('86000000-0000-4000-8000-000000000001','{"unitPriceKrw":8000}');
  raise exception 'technician financial edit was accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 begin
  perform public.clair_get_confirmed_order_edit('synthetic-edit-other','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001');
  raise exception 'cross-workspace access was accepted';
 exception when insufficient_privilege then null; end;

 -- Partial records survive replacement; performer confirms the remaining scope.
 update public.order_tasks set status='in_progress',started_at=now(),started_by_user_id='81000000-0000-4000-8000-000000000003' where id='87000000-0000-4000-8000-000000000002';
 update public.order_fulfillment_work_items set status='in_progress',started_at=now(),started_by_user_id='81000000-0000-4000-8000-000000000003' where id='88000000-0000-4000-8000-000000000002';
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
 r:=public.clair_get_partial_order_work('synthetic-order-edit','87000000-0000-4000-8000-000000000002');
 partial_cmd:=jsonb_build_object('commandId',gen_random_uuid(),'expectedRevision',r->'revision','note','합성 부분 수행 1회. 남은 작업 담당자 확인 필요.');
 perform public.clair_record_partial_order_work('synthetic-order-edit','87000000-0000-4000-8000-000000000002',partial_cmd);
 perform public.clair_record_partial_order_work('synthetic-order-edit','87000000-0000-4000-8000-000000000002',partial_cmd);
 perform pg_temp.assert_true((select count(*)=1 from private.order_partial_work_notes),'partial retry writes once');
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_confirmed_order_edit('synthetic-order-edit','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002');
 d:=pg_temp.edit('86000000-0000-4000-8000-000000000002',null,jsonb_build_object('detailInputs',jsonb_set(d->'detailInputs','{durationDays}','3'),'detailSchemaVersion',1,'actualDispenseMode','automatic'),'합성 부분 수행 후 수정');
 select task_id into current_task from public.order_fulfillment_work_items where id='88000000-0000-4000-8000-000000000002';
 perform pg_temp.assert_true(current_task<>'87000000-0000-4000-8000-000000000002','in-progress edit creates next attempt');
 perform pg_temp.assert_true((select assigned_to_user_id='81000000-0000-4000-8000-000000000003' and requested_by_user_id='81000000-0000-4000-8000-000000000002' from public.order_fulfillment_work_items where id='88000000-0000-4000-8000-000000000002'),'replacement keeps performer and requester');
 perform pg_temp.assert_true((select assigned_to_user_id='81000000-0000-4000-8000-000000000003' and assigned_at is not null from public.order_tasks where id=current_task),'replacement task keeps performer for instruction action authorization');
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
 r:=public.clair_get_task_instruction_review('synthetic-order-edit',current_task);
 perform pg_temp.assert_true(jsonb_array_length(r#>'{current,partialWork}')=1,'partial work visible on replacement review');
 perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(r#>'{previous,entries}') e where e->>'kind'='clinical_edit' and e->>'orderId'<>'86000000-0000-4000-8000-000000000002'),'previous clinical changes never come from another order on the same chart');
 perform pg_temp.assert_true((r->>'requiresAcknowledgement')::boolean,'replacement requires remaining scope confirmation');
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 -- Legacy mutation path cannot bypass the shared clinical confirmation version.
 d:=public.clair_get_confirmed_order_edit('synthetic-order-edit','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000003');
 perform public.clair_mutate_chart_order_execution_for_chart('synthetic-order-edit',auth.uid(),'85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000003','amend','합성 기존 수정 경로',0,jsonb_build_object('detailInputs',jsonb_set(d->'detailInputs','{durationDays}','4'),'detailSchemaVersion',1),'synthetic-legacy-edit');
 perform pg_temp.assert_true((select count(*)=1 from private.order_clinical_edit_revisions where order_id='86000000-0000-4000-8000-000000000003'),'legacy edits participate in acknowledgement');
 -- Complete a synthetic request using the actual instruction mutation owner.
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
 r:=public.clair_get_task_instruction_review('synthetic-order-edit','87000000-0000-4000-8000-000000000003');
 perform public.clair_acknowledge_task_instructions('synthetic-order-edit','87000000-0000-4000-8000-000000000003',r#>>'{current,versionKey}');
 d:=public.clair_get_fulfillment_instruction('synthetic-order-edit','88000000-0000-4000-8000-000000000003');
 d:=public.clair_mutate_fulfillment_instruction('synthetic-order-edit','88000000-0000-4000-8000-000000000003',jsonb_build_object('action','start','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 r:=public.clair_get_order_execution_context('synthetic-order-edit','88000000-0000-4000-8000-000000000003');
 perform public.clair_record_order_execution_result('synthetic-order-edit',auth.uid(),'88000000-0000-4000-8000-000000000003',(r->>'workItemRevision')::bigint,r->>'planSha256',0,gen_random_uuid(),now(),'{"preparedQuantity":4,"preparedUnit":"tablet"}',null,null);
 perform pg_temp.assert_true((select status='complete' from public.order_tasks where id='87000000-0000-4000-8000-000000000003'),'synthetic work completed');
 perform pg_temp.assert_true(not exists(select 1 from public.invoices where workspace_id='synthetic-order-edit'),'completion does not create invoice');
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 -- Explicit billing request creates invoice; financial proposal cannot alter it.
 perform pg_temp.assert_true(not exists(select 1 from public.invoices where workspace_id='synthetic-order-edit'),'no automatic invoice before explicit request');
 r:=private.clair_get_chart_order_billing_summary_internal('synthetic-order-edit','84000000-0000-4000-8000-000000000001');
 perform public.clair_request_chart_order_billing('synthetic-order-edit',auth.uid(),'84000000-0000-4000-8000-000000000001',r->>'etag','synthetic-explicit-billing',true);
 select id into inv from public.invoices where workspace_id='synthetic-order-edit';
 perform pg_temp.assert_true(inv is not null,'explicit billing creates invoice');
 update public.invoices set assigned_to_user_id=auth.uid() where id=inv;
 select to_jsonb(l) into line_before from public.invoice_lines l join public.order_billing_candidates c on c.invoice_line_id=l.id where c.order_id='86000000-0000-4000-8000-000000000001';
 d:=pg_temp.edit('86000000-0000-4000-8000-000000000001','{"unitPriceKrw":8000,"billingName":"합성 청구명 수정"}');
 perform pg_temp.assert_true(d#>>'{pendingFinancial,unitPriceKrw}'='8000','requested financial edit becomes proposal');
 perform pg_temp.assert_true((select to_jsonb(l)=line_before from public.invoice_lines l where l.id=(line_before->>'id')::uuid),'proposal preserves billed money');
 begin
  update public.invoices set payment_state='paid',status='paid' where id=inv;
  raise exception 'pending billing payment was accepted';
 exception when raise_exception then if sqlerrm<>'billing_review_required' then raise; end if; end;
 update public.invoices set assigned_to_user_id=null where id=inv;
 perform pg_temp.assert_true(public.clair_get_order_billing_changes('synthetic-order-edit',inv)#>>'{0,canApprove}'='false','unassigned billing remains visible and read only');
 update public.invoices set assigned_to_user_id=auth.uid() where id=inv;
 change:=public.clair_get_order_billing_changes('synthetic-order-edit',inv)->0;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true);
 begin
  perform public.clair_approve_order_billing_change('synthetic-order-edit',inv,(change->>'orderId')::uuid,(change->>'proposalId')::uuid,(change->>'version')::integer);
  raise exception 'non-owner billing approval accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 perform public.clair_approve_order_billing_change('synthetic-order-edit',inv,(change->>'orderId')::uuid,(change->>'proposalId')::uuid,(change->>'version')::integer);
 perform public.clair_approve_order_billing_change('synthetic-order-edit',inv,(change->>'orderId')::uuid,(change->>'proposalId')::uuid,(change->>'version')::integer);
 perform pg_temp.assert_true((select line_total=31000 and description='합성 청구명 수정' from public.invoice_lines where id=(line_before->>'id')::uuid),'owner approval applies amount and display name');
 perform pg_temp.assert_true(jsonb_array_length(public.clair_get_order_billing_changes('synthetic-order-edit',inv))=0,'approval clears pending proposal');
 -- Existing invoice quantity edits remain the source of truth for later proposals.
 update public.invoice_lines set quantity=6 where id=(line_before->>'id')::uuid;
 d:=public.clair_get_confirmed_order_edit('synthetic-order-edit','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001');
 perform pg_temp.assert_true(d#>>'{financial,billingQuantity}'='6.000','editor reads current invoice quantity');
 d:=pg_temp.edit('86000000-0000-4000-8000-000000000001','{"unitPriceKrw":8500}');
 change:=public.clair_get_order_billing_changes('synthetic-order-edit',inv)->0;
 perform public.clair_approve_order_billing_change('synthetic-order-edit',inv,(change->>'orderId')::uuid,(change->>'proposalId')::uuid,(change->>'version')::integer);
 perform pg_temp.assert_true((select quantity=6 from public.invoice_lines where id=(line_before->>'id')::uuid),'price-only approval preserves invoice quantity');
 update public.invoices set status='paid',payment_state='paid',paid_at=now() where id=inv;
 begin
  perform pg_temp.edit('86000000-0000-4000-8000-000000000001','{"unitPriceKrw":9000}');
  raise exception 'paid financial mutation was accepted';
 exception when raise_exception then if sqlerrm<>'payment_locked' then raise; end if; end;
 -- Paid clinical changes can be held without blocking non-money assignment edits.
 d:=public.clair_get_confirmed_order_edit('synthetic-order-edit','85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002');
 d:=pg_temp.edit('86000000-0000-4000-8000-000000000002',null,jsonb_build_object('detailInputs',jsonb_set(d->'detailInputs','{durationDays}','5'),'detailSchemaVersion',1,'actualDispenseMode','automatic'),'합성 결제 후 업무 수정');
 update public.invoices set assigned_to_user_id='81000000-0000-4000-8000-000000000004' where id=inv;
 perform pg_temp.assert_true(d->'pendingFinancial'<>'null'::jsonb,'paid clinical amount held for correction');
 perform pg_temp.assert_true(not has_table_privilege('authenticated','private.order_financial_edits','UPDATE'),'financial table cannot be directly written');
 perform pg_temp.assert_true(not has_function_privilege('anon','public.clair_edit_confirmed_order(text,uuid,uuid,jsonb)','EXECUTE'),'anonymous cannot execute edit');
end $$;
rollback;
