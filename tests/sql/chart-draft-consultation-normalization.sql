-- Local synthetic integration rehearsal; requires the application schema/master
-- classification migrations. Always roll back. No real clinical rows are used.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='20s';
insert into auth.users(id) values ('aa000000-0000-4000-8000-000000000001'),('aa000000-0000-4000-8000-000000000002');
insert into public.users(id,display_name,status) values ('aa000000-0000-4000-8000-000000000001','Synthetic draft actor','active'),('aa000000-0000-4000-8000-000000000002','Synthetic draft veterinarian','active');
insert into public.workspaces(id,display_name,status) values('synthetic-draft-normalization','Synthetic draft normalization','active');
insert into public.user_memberships(workspace_id,user_id,roles,status) select 'synthetic-draft-normalization',id,array['hospital_admin'],'active' from public.users where id in ('aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002');
insert into public.patients(id,workspace_id,patient_no,name,species) values('aa000000-0000-4000-8000-000000000003','synthetic-draft-normalization','SYN-DRAFT','Synthetic draft patient','dog');
insert into public.encounters(id,workspace_id,patient_id,encounter_no,reception_type,status,primary_veterinarian_id) values('aa000000-0000-4000-8000-000000000004','synthetic-draft-normalization','aa000000-0000-4000-8000-000000000003','SYN-DRAFT','walk_in','in_consultation','aa000000-0000-4000-8000-000000000002');
insert into public.soap_notes(id,workspace_id,encounter_id,status) values('aa000000-0000-4000-8000-000000000005','synthetic-draft-normalization','aa000000-0000-4000-8000-000000000004','draft');
insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,category_group,category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,price_krw,default_destination_module,default_task_required,billing_reflection_enabled,classification_path_id,clinical_order_type,is_external_lab,destination_module,execution_mode,detail_schema_version,detail_field_schema,billing_eligible)
select 'synthetic-draft-consult','synthetic-draft-normalization','synthetic-draft-consult','synthetic-v1','consultation','진료','Synthetic consultation','Synthetic consultation','Synthetic consultation','active',0,'chart_only',false,false,p.id,'consultation',false,null,'immediate_complete',1,private.clair_order_detail_field_schema_v1('consultation'),false
from master.classification_paths p join master.clinical_actions a on a.master_record_id=p.clinical_action_id where a.item_type='consultation' and p.retired_in_release_id is null limit 1;
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare current jsonb; saved jsonb; row_input jsonb;
begin
  row_input := '{"rowType":"individual","orderId":"aa000000-0000-4000-8000-000000000006","workspaceCatalogItemId":"synthetic-draft-consult","quantity":1}';
  current := public.clair_get_chart_order_draft('synthetic-draft-normalization','aa000000-0000-4000-8000-000000000004');
  saved := public.clair_save_chart_order_draft_for_chart('synthetic-draft-normalization','aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000004','aa000000-0000-4000-8000-000000000005',jsonb_build_object('expectedEtag',current->>'etag','rows',jsonb_build_array(row_input)));
  if saved#>>'{rows,0,detailInputs,responsibleClinicianId}' is distinct from 'aa000000-0000-4000-8000-000000000002' or saved#>>'{rows,0,detailSchemaVersion}' is distinct from '1' then
    raise exception 'optional_consultation_detail_normalization_failed';
  end if;
  row_input := row_input || '{"detailSchemaVersion":1,"detailInputs":{"responsibleClinicianId":"aa000000-0000-4000-8000-000000000001"}}'::jsonb;
  saved := public.clair_save_chart_order_draft_for_chart('synthetic-draft-normalization','aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000004','aa000000-0000-4000-8000-000000000005',jsonb_build_object('expectedEtag',saved->>'etag','rows',jsonb_build_array(row_input)));
  if saved#>>'{rows,0,detailInputs,responsibleClinicianId}' is distinct from 'aa000000-0000-4000-8000-000000000002' then raise exception 'spoofed_consultation_clinician_accepted'; end if;
end $$;
reset role;
update public.encounters set primary_veterinarian_id=null where workspace_id='synthetic-draft-normalization';
set local role authenticated;
do $$
declare current jsonb; saved jsonb;
begin
  current := public.clair_get_chart_order_draft('synthetic-draft-normalization','aa000000-0000-4000-8000-000000000004');
  saved := public.clair_save_chart_order_draft_for_chart('synthetic-draft-normalization','aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000004','aa000000-0000-4000-8000-000000000005',jsonb_build_object('expectedEtag',current->>'etag','rows','[{"rowType":"individual","orderId":"aa000000-0000-4000-8000-000000000006","workspaceCatalogItemId":"synthetic-draft-consult","quantity":1}]'::jsonb));
  if saved#>'{rows,0,detailInputs}' ? 'responsibleClinicianId' then raise exception 'missing_veterinarian_filled_with_actor'; end if;
end $$;
select 'PASS consultation optional details, spoofing, and missing veterinarian';
rollback;
