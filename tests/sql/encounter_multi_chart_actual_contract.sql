\set ON_ERROR_STOP on
-- Run only in an isolated, migrated database with synthetic supabase/seed.sql fixtures.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
insert into public.patients(id, workspace_id, patient_no, name, species, sex)
values ('96371000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam',
  'MULTI-CHART-ACTUAL-037', 'Synthetic multi chart patient', 'dog', 'unknown');
insert into public.encounters(id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status, started_at)
values ('96371000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam',
  '96371000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
  'MULTI-CHART-ACTUAL-037', 'walk_in', 'in_consultation', now());
update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update","billing:view","billing:issue","order:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';

insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,category_group,
 category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,price_krw,
 default_destination_module,default_task_required,billing_reflection_enabled,origin_type,
 clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_field_schema,billing_eligible)
values('multi-chart-plan','workspace-clair-cheongdam','multi-chart-plan','synthetic-multi-chart',
 'consultation','진료','Synthetic consultation plan','Synthetic consultation plan','Synthetic consultation plan','active',10000,
 'chart_only',false,true,'workspace_custom','consultation',null,'immediate_complete',2,
 private.clair_order_detail_field_schema('consultation',2),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare w text:='workspace-clair-cheongdam'; actor text:='49110000-0000-4000-8000-000000000003';
 e uuid:='96371000-0000-4000-8000-000000000002'; c1 uuid; c2 uuid;
 legacy uuid:='96371000-0000-4000-8000-000000000011'; own uuid:='96371000-0000-4000-8000-000000000012';
 row_input jsonb; saved jsonb; confirmed jsonb; context jsonb; actual jsonb; result jsonb; replay jsonb;
 task_id uuid; command uuid:=gen_random_uuid(); stamp timestamptz:=now()-interval '1 minute'; denied boolean;
begin
 row_input:=jsonb_build_object('rowType','individual','orderId',legacy,'workspaceCatalogItemId','multi-chart-plan','quantity',1,
 'detailSchemaVersion',2,'detailInputs',jsonb_build_object('responsibleClinicianId',actor,'occurrenceCount',1,'timing','now','instructionSummary','Synthetic planned consultation'),'priority','normal');
 saved:=public.clair_save_chart_order_draft(w,actor,e,jsonb_build_object('expectedEtag',public.clair_get_chart_order_draft(w,e)->'etag','rows',jsonb_build_array(row_input)));
 c1:=(public.clair_create_encounter_chart(w,actor,e,gen_random_uuid())->>'id')::uuid;
 c2:=(public.clair_create_encounter_chart(w,actor,e,gen_random_uuid())->>'id')::uuid;
 -- Existing legacy roots stay editable after chart creation and keep null origin.
 row_input:=jsonb_set(row_input,'{quantity}','2'::jsonb);
 saved:=public.clair_save_chart_order_draft(w,actor,e,jsonb_build_object('expectedEtag',saved->'etag','rows',jsonb_build_array(row_input)));
 if (select r->>'originChartId' from jsonb_array_elements(saved->'rows') r where r->>'orderId'=legacy::text) is not null then raise exception 'legacy_origin_guessed'; end if;
 row_input:=jsonb_set(row_input,'{orderId}',to_jsonb(own));
 saved:=public.clair_save_chart_order_draft_for_chart(w,actor,e,c1,jsonb_build_object('expectedEtag',saved->'etag','rows',jsonb_build_array(row_input)));
 confirmed:=public.clair_confirm_chart_order_candidates_with_actual_for_chart(w,actor::uuid,e,c1,array[own],saved->>'etag','multi-plan-confirm','{}');
 if jsonb_array_length(confirmed->'tasks')<>1 or confirmed#>>'{tasks,0,status}'<>'pending' then raise exception 'plan_fabricated_execution'; end if;
 task_id:=(confirmed#>>'{tasks,0,taskId}')::uuid;
 context:=public.clair_get_chart_actual_context(w,task_id);
 if context->>'canRecord'<>'true' then raise exception 'plan_cannot_record_actual'; end if;
 actual:='{"performedActivity":"Synthetic explicit activity","outcome":"Synthetic reviewed outcome"}'::jsonb;
 result:=public.clair_record_chart_actual_result(w,actor::uuid,task_id,context->>'planSha256',command,stamp,actual,true);
 replay:=public.clair_record_chart_actual_result(w,actor::uuid,task_id,context->>'planSha256',command,stamp,actual,true);
 if result is distinct from replay then raise exception 'actual_retry_changed_result'; end if;
 saved:=public.clair_get_chart_order_actions(w,e);
 if (select r->>'originChartId' from jsonb_array_elements(saved->'rows') r where r->>'orderId'=own::text) is distinct from c1::text then raise exception 'actual_moved_origin_to_reviewing_chart: %, expected %', (select jsonb_agg(jsonb_build_object('id',r->'orderId','origin',r->'originChartId','status',r->'status')) from jsonb_array_elements(saved->'rows') r), c1; end if;
 confirmed:=public.clair_confirm_chart_order_candidates_with_actual(w,actor::uuid,e,array[legacy],saved->>'etag','multi-legacy-plan-confirm','{}');
 if jsonb_array_length(confirmed->'tasks')<>1 then raise exception 'legacy_confirmation_after_chart_failed'; end if;
 -- Unscoped lifecycle edits cannot alter a chart plan without actual evidence.
 denied:=false;
 begin
 perform public.clair_save_chart_order_lifecycle(w,actor::uuid,e,legacy,'cancelled','wrong chart cancellation');
 exception when others then if sqlerrm='lifecycle_transition_requires_fulfillment' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'legacy_plan_bypass'; end if;
end $test$;
reset role;
do $counts$
begin
 if (select count(*) from public.order_execution_result_versions where encounter_id='96371000-0000-4000-8000-000000000002')<>1 then raise exception 'duplicate_actual'; end if;
 if (select count(*) from public.order_tasks where encounter_id='96371000-0000-4000-8000-000000000002')<>2 then raise exception 'duplicate_tasks'; end if;
 if (select count(*) from public.order_billing_candidates where encounter_id='96371000-0000-4000-8000-000000000002')<>2 then raise exception 'duplicate_billing'; end if;
end $counts$;
select 'PASS encounter_multi_chart_actual_contract';
rollback;
