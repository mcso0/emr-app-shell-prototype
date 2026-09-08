\set ON_ERROR_STOP on

begin;

insert into public.workspaces (id, display_name)
values ('workspace-phase5-other', 'Phase5 격리 워크스페이스');

insert into public.patients (
  id, workspace_id, patient_no, name, species
) values (
  '95000000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'PHASE5-REVISION-001',
  'Phase5 합성 환자',
  'dog'
);

insert into public.encounters (
  id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status
) values (
  '95000000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '95000000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'PHASE5-REVISION-ENC-001',
  'walk_in',
  'in_consultation'
);

insert into public.order_catalog_items (
  id, workspace_id, standard_order_id, source_preset_version,
  category_group, category_label, standard_order_name,
  in_hospital_order_name, billing_name, availability_status, price_krw,
  default_destination_module, default_task_required,
  billing_reflection_enabled, origin_type
) values
  (
    'phase5-lab', 'workspace-clair-cheongdam', 'phase5-lab', 'phase5-v1',
    'lab', '임상', 'Phase5 Lab', 'Phase5 Lab', 'Phase5 Lab', 'active', 15000,
    'lab', true, true, 'workspace_custom'
  ),
  (
    'phase5-consult', 'workspace-clair-cheongdam', 'phase5-consult', 'phase5-v1',
    'consultation', '진료', 'Phase5 Consult', 'Phase5 Consult', 'Phase5 Consult',
    'active', 10000, 'chart_only', false, true, 'workspace_custom'
  ),
  (
    'phase5-imaging', 'workspace-clair-cheongdam', 'phase5-imaging', 'phase5-v1',
    'imaging', '영상', 'Phase5 Imaging', 'Phase5 Imaging', 'Phase5 Imaging',
    'active', 20000, 'imaging', true, true, 'workspace_custom'
  );

insert into public.order_sets (
  id, workspace_id, source_set_version, set_category, set_name, billing_name,
  amount_basis, billing_reflection_enabled, created_by_user_id, updated_by_user_id
) values (
  'phase5-set',
  'workspace-clair-cheongdam',
  'order-set-revision-1',
  '혼합',
  'Phase5 Mixed Set',
  'Phase5 Mixed Set',
  'included_order_sum',
  false,
  '49110000-0000-4000-8000-000000000003',
  '49110000-0000-4000-8000-000000000003'
);

insert into public.order_set_revisions (
  id, workspace_id, order_set_id, revision_no, validation_status,
  validation_errors, set_category, set_name, billing_name, amount_basis,
  set_price_krw, sales_unit, billing_reflection_enabled, tax_type,
  target_species, created_by_user_id
) values (
  '95000000-0000-4000-8000-000000000020',
  'workspace-clair-cheongdam',
  'phase5-set',
  1,
  'valid',
  '[]'::jsonb,
  '혼합',
  'Phase5 Mixed Set',
  'Phase5 Mixed Set',
  'included_order_sum',
  null,
  'per_each',
  false,
  'derived',
  array['dog','cat','other'],
  '49110000-0000-4000-8000-000000000003'
);

update public.order_sets
set current_revision_id = '95000000-0000-4000-8000-000000000020'
where workspace_id = 'workspace-clair-cheongdam' and id = 'phase5-set';

insert into public.order_set_revision_items (
  id, workspace_id, order_set_id, revision_id,
  child_kind, child_order_catalog_item_id, child_order_catalog_revision,
  sort_order, default_selected, billing_reflection_default,
  default_quantity, quantity_source
) values
  (
    '95000000-0000-4000-8000-000000000021',
    'workspace-clair-cheongdam', 'phase5-set',
    '95000000-0000-4000-8000-000000000020',
    'atomic', 'phase5-lab', 1, 10, true, true, 1, 'fixed_one'
  ),
  (
    '95000000-0000-4000-8000-000000000022',
    'workspace-clair-cheongdam', 'phase5-set',
    '95000000-0000-4000-8000-000000000020',
    'atomic', 'phase5-imaging', 1, 20, true, true, 1, 'fixed_one'
  );

update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update","order:update","billing:view","billing:issue","lab:view","lab:complete","imaging:view","imaging:complete"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare
 w text:='workspace-clair-cheongdam'; actor text:='49110000-0000-4000-8000-000000000003';
 e uuid:='95000000-0000-4000-8000-000000000002'; c1 uuid; c2 uuid;
 v_initial jsonb; v_saved jsonb; before_rows jsonb; denied boolean; confirmed jsonb; replay jsonb; revised jsonb; wi jsonb; context jsonb; result jsonb; payload jsonb; command uuid:=gen_random_uuid(); stamp timestamptz:=now();
begin
 c1:=(public.clair_create_encounter_chart(w,actor,e,gen_random_uuid())->>'id')::uuid;
 c2:=(public.clair_create_encounter_chart(w,actor,e,gen_random_uuid())->>'id')::uuid;
  v_initial := public.clair_get_chart_order_draft(
    'workspace-clair-cheongdam',
    '95000000-0000-4000-8000-000000000002'
  );
  v_saved := public.clair_save_chart_order_draft_for_chart(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000002', c1,
    jsonb_build_object(
      'expectedEtag', v_initial -> 'etag',
      'rows', jsonb_build_array(
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '95000000-0000-4000-8000-000000000101',
          'workspaceCatalogItemId', 'phase5-lab',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'specimenType', 'serum',
            'testPanel', 'CBC',
            'collectionCondition', 'fasted'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        ),
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '95000000-0000-4000-8000-000000000102',
          'workspaceCatalogItemId', 'phase5-consult',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'responsibleClinicianId', '49110000-0000-4000-8000-000000000003',
            'occurrenceCount', 1,
            'timing', 'now',
            'instructionSummary', 'Initial consultation'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        ),
        jsonb_build_object(
          'rowType', 'set',
          'orderId', '95000000-0000-4000-8000-000000000103',
          'sourceSetId', 'phase5-set',
          'sourceSetRevisionId', '95000000-0000-4000-8000-000000000020',
          'sourceSetRevisionNo', 1,
          'selectionIntent', jsonb_build_object(
            'items', jsonb_build_array(
              jsonb_build_object(
                'revisionItemId', '95000000-0000-4000-8000-000000000021',
                'selected', true,
                'quantity', 1
              ),
              jsonb_build_object(
                'revisionItemId', '95000000-0000-4000-8000-000000000022',
                'selected', true,
                'quantity', 1
              )
            )
          ),
          'detailInputs', '{}'::jsonb,
          'detailSchemaVersion', 1,
          'priority', 'normal',
          'childInputs', jsonb_build_array(
            jsonb_build_object(
              'revisionItemId', '95000000-0000-4000-8000-000000000021',
              'detailInputs', jsonb_build_object(
                'specimenType', 'blood',
                'testPanel', 'CBC',
                'collectionCondition', 'room temperature'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            ),
            jsonb_build_object(
              'revisionItemId', '95000000-0000-4000-8000-000000000022',
              'detailInputs', jsonb_build_object(
                'bodyRegion', 'abdomen',
                'position', 'VD',
                'viewCount', 2,
                'contrastRequired', false,
                'sedationRequired', false
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            )
          )
        ),
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '95000000-0000-4000-8000-000000000104',
          'workspaceCatalogItemId', 'phase5-imaging',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'bodyRegion', 'abdomen',
            'position', 'VD',
            'viewCount', 2,
            'contrastRequired', false,
            'sedationRequired', false
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )
      )
    )
  );
  if not (v_saved ? 'billingSummary')
    or v_saved -> 'billingSummary' is distinct from
      public.clair_get_chart_order_billing_summary(
        'workspace-clair-cheongdam',
        '95000000-0000-4000-8000-000000000002'
      )
  then
    raise exception 'phase5_draft_mutation_summary_mismatch';
  end if;


 if jsonb_array_length(v_saved->'rows') <> 6 then raise exception 'expected_roots_and_children'; end if;
 if exists(select 1 from jsonb_array_elements(v_saved->'rows') r where r->>'originChartId' is distinct from c1::text) then raise exception 'root_or_child_origin_lost'; end if;
 before_rows:=v_saved->'rows';
 denied:=false;
 begin
   perform public.clair_save_chart_order_draft_for_chart(w,actor,e,c2,jsonb_build_object(
     'expectedEtag',v_saved->'etag','rows','[]'::jsonb,'removedOrderIds',jsonb_build_array('95000000-0000-4000-8000-000000000101')));
 exception when others then if sqlerrm='order_chart_mismatch' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'cross_chart_removal_accepted'; end if;
 denied:=false;
 begin
   perform public.clair_confirm_chart_order_candidates_for_chart(w,actor::uuid,e,c2,
     array['95000000-0000-4000-8000-000000000101'::uuid],v_saved->>'etag','multi-wrong-chart');
 exception when others then if sqlerrm='order_chart_mismatch' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'cross_chart_confirm_accepted'; end if;
 denied:=false;
 begin
   perform public.clair_save_chart_order_lifecycle(w,actor::uuid,e,'95000000-0000-4000-8000-000000000101','cancelled','incorrect direct cancel');
 exception when others then if sqlerrm='lifecycle_transition_requires_fulfillment' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'direct_lifecycle_bypass'; end if;
 if public.clair_get_chart_order_draft(w,e)->'rows' is distinct from before_rows then raise exception 'denied_mutation_changed_orders'; end if;

 confirmed:=public.clair_confirm_chart_order_candidates_for_chart(w,actor::uuid,e,c1,
   array['95000000-0000-4000-8000-000000000101'::uuid,'95000000-0000-4000-8000-000000000103'::uuid],v_saved->>'etag','multi-confirm-own-chart');
 replay:=public.clair_confirm_chart_order_candidates_for_chart(w,actor::uuid,e,c1,
   array['95000000-0000-4000-8000-000000000101'::uuid,'95000000-0000-4000-8000-000000000103'::uuid],v_saved->>'etag','multi-confirm-own-chart');
 if confirmed->>'commandId' is distinct from replay->>'commandId' or confirmed->'tasks' is distinct from replay->'tasks' or confirmed->'billingCandidates' is distinct from replay->'billingCandidates' then raise exception 'confirmation_retry_not_idempotent: %', (select jsonb_object_agg(key,jsonb_build_array(confirmed->key,replay->key)) from jsonb_object_keys(confirmed) k(key) where confirmed->key is distinct from replay->key); end if;
 if jsonb_array_length(confirmed->'tasks') <> 4 or jsonb_array_length(confirmed->'billingCandidates') <> 3 then raise exception 'set_confirmation_duplicate_or_missing_work'; end if;
 denied:=false;
 begin
   perform public.clair_mutate_chart_order_execution_for_chart(w,actor::uuid,c2,'95000000-0000-4000-8000-000000000101',
     'cancel','Wrong originating chart',1,'{}','multi-cancel-wrong-chart');
 exception when others then if sqlerrm='order_chart_mismatch' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'cross_chart_execution_mutation_accepted'; end if;
 revised:=public.clair_mutate_chart_order_execution_for_chart(w,actor::uuid,c1,'95000000-0000-4000-8000-000000000101',
   'amend','Synthetic updated collection condition',1,
   '{"detailInputs":{"specimenType":"plasma","testPanel":"CBC","collectionCondition":"non-fasted"},"detailSchemaVersion":1}',
   'multi-amend-own-chart');
 if revised->>'revisionNo'<>'2' then raise exception 'own_chart_revision_failed'; end if;
 if exists(select 1 from jsonb_array_elements(public.clair_get_chart_order_draft(w,e)->'rows') r where r->>'originChartId' is distinct from c1::text) then raise exception 'revision_changed_origin'; end if;

 v_saved:=public.clair_get_chart_order_actions(w,e);
 confirmed:=public.clair_confirm_chart_order_candidates_with_actual_for_chart(w,actor::uuid,e,c1,
   array['95000000-0000-4000-8000-000000000104'::uuid],v_saved->>'etag','multi-imaging-confirm','{}');
 wi:=public.clair_list_fulfillment_work_items(w,'imaging',e,'95000000-0000-4000-8000-000000000104',null)->0;
 perform public.clair_transition_fulfillment_work_item(w,actor::uuid,(wi->>'id')::uuid,'start',(wi->>'rowRevision')::bigint,
   gen_random_uuid(),null,null,null);
 wi:=public.clair_list_fulfillment_work_items(w,'imaging',e,'95000000-0000-4000-8000-000000000104',null)->0;
 perform public.clair_save_chart_order_lifecycle(w,actor::uuid,e,'95000000-0000-4000-8000-000000000104','in_progress',null);
 denied:=false;
 begin
   perform public.clair_save_chart_order_lifecycle(w,actor::uuid,e,'95000000-0000-4000-8000-000000000104','cancelled','unrelated chart cancellation');
 exception when others then if sqlerrm='lifecycle_transition_requires_fulfillment' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'lifecycle_arbitrary_cancel_accepted'; end if;
 context:=public.clair_get_order_execution_context(w,(wi->>'id')::uuid);
 payload:='{"acquisitionDisposition":"acquired_new","acquiredViews":["VD","LAT"],"performedProtocol":"Synthetic abdomen imaging","quality":"diagnostic","findings":"Synthetic findings","interpretation":"Synthetic reviewed interpretation"}'::jsonb;
 result:=public.clair_record_order_execution_result(w,actor::uuid,(wi->>'id')::uuid,(wi->>'rowRevision')::bigint,
   context->>'planSha256',0,command,stamp,payload,null,null);
 replay:=public.clair_record_order_execution_result(w,actor::uuid,(wi->>'id')::uuid,(wi->>'rowRevision')::bigint,
   context->>'planSha256',0,command,stamp,payload,null,null);
 if result is distinct from replay or result->>'status'<>'completed' then raise exception 'imaging_result_retry_failed'; end if;
 perform public.clair_save_chart_order_lifecycle(w,actor::uuid,e,'95000000-0000-4000-8000-000000000104','completed',null);
 if (select r->>'originChartId' from jsonb_array_elements(public.clair_get_chart_order_actions(w,e)->'rows') r where r->>'orderId'='95000000-0000-4000-8000-000000000104') is distinct from c1::text then raise exception 'imaging_result_changed_origin'; end if;
 if has_function_privilege('authenticated','public.clair_save_chart_order_lifecycle_internal(text,uuid,uuid,uuid,text,text)','EXECUTE') then raise exception 'private_base_public'; end if;
end $test$;
select 'PASS encounter_multi_chart_order_contract';
rollback;
