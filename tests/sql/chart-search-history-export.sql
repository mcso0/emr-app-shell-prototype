-- Run inside an isolated local database. All synthetic data is rolled back.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id) values ('aac27000-0000-4000-8000-000000000003');
insert into public.users(id,display_name,initial,email,status) values('aac27000-0000-4000-8000-000000000003','QA synthetic','QA','qa@example.test','active');
insert into public.workspaces(id,display_name,status) values('synthetic-chart-search-history-v2','Rollback QA','active');
insert into public.user_memberships(id,workspace_id,user_id,roles,status) values('aac27100-0000-4000-8000-000000000003','synthetic-chart-search-history-v2','aac27000-0000-4000-8000-000000000003',array['vet'],'active');
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions) values('aac27200-0000-4000-8000-000000000003','synthetic-chart-search-history-v2','qa','QA','standard','{"allowed":["chart:view","chart:update","order:view","order:update","service_catalog:view"]}');
insert into public.workspace_membership_permission_role_assignments(workspace_id,membership_id,permission_role_id) values('synthetic-chart-search-history-v2','aac27100-0000-4000-8000-000000000003','aac27200-0000-4000-8000-000000000003') on conflict(membership_id) do update set permission_role_id=excluded.permission_role_id;
insert into public.patients(id,workspace_id,patient_no,name,species,sex) values('aac27300-0000-4000-8000-000000000001','synthetic-chart-search-history-v2','qa','qa patient','dog','unknown');
insert into public.encounters(id,workspace_id,patient_id,primary_veterinarian_id,encounter_no,reception_type,status) select ('aac27300-0000-4000-8000-00000000000'||i)::uuid,'synthetic-chart-search-history-v2','aac27300-0000-4000-8000-000000000001','aac27000-0000-4000-8000-000000000003','qa'||i,'walk_in',case when i=4 then 'waiting' else 'in_consultation' end from generate_series(2,4) i;
insert into public.patients(id,workspace_id,patient_no,name,species,sex)
values ('aac27300-0000-4000-8000-000000000099','synthetic-chart-search-history-v2','qa-other','second synthetic patient','cat','unknown');
update public.encounters set patient_id='aac27300-0000-4000-8000-000000000099'
where workspace_id='synthetic-chart-search-history-v2' and id in ('aac27300-0000-4000-8000-000000000003','aac27300-0000-4000-8000-000000000004');
insert into auth.users(id) values ('aac27000-0000-4000-8000-000000000009');
insert into public.users(id,display_name,status) values ('aac27000-0000-4000-8000-000000000009','Synthetic colleague','active');
insert into public.user_memberships(workspace_id,user_id,roles,status) values('synthetic-chart-search-history-v2','aac27000-0000-4000-8000-000000000009',array['vet'],'active');
insert into public.soap_notes(id,workspace_id,encounter_id,author_user_id,status,subjective,plan) values('aac27300-0000-4000-8000-000000000005','synthetic-chart-search-history-v2','aac27300-0000-4000-8000-000000000002','aac27000-0000-4000-8000-000000000003','draft','source plain','source plan'),('aac27300-0000-4000-8000-000000000006','synthetic-chart-search-history-v2','aac27300-0000-4000-8000-000000000003','aac27000-0000-4000-8000-000000000009','draft','destination plain','destination plan');

set local role authenticated;
select set_config('request.jwt.claim.sub','aac27000-0000-4000-8000-000000000003',true);
do $$
declare
  w text:='synthetic-chart-search-history-v2';
  c uuid:='aac27300-0000-4000-8000-000000000005';
  p uuid:='aac27300-0000-4000-8000-000000000001';
  items jsonb;
begin
  items:=public.clair_search_patient_charts(w,p)->'items';
  assert jsonb_array_length(items)=1 and items#>>'{0,id}'=c::text;
  assert items#>>'{0,patientId}'=p::text and items#>>'{0,visitType}'='walk_in';
  assert items#>>'{0,createdAt}' is not null and items#>'{0,taskStatuses}'='[]'::jsonb;
  items:=public.clair_export_chart_summaries(w,array[c],'csv');
  assert jsonb_array_length(items)=1 and items#>>'{0,patient}'='qa patient';
  assert not (items->0 ?| array['guardian','paragraphs','media','orders']);
  perform public.clair_export_chart_summaries(w,array[c],'pdf');
  begin
    perform public.clair_export_chart_summaries(w,array[c,gen_random_uuid()],'csv');
    raise exception 'partial export accepted';
  exception when raise_exception then if sqlerrm<>'source_unavailable' then raise; end if; end;
  begin
    perform public.clair_export_chart_summaries('unrelated-workspace',array[c],'csv');
    raise exception 'wrong workspace accepted';
  exception when insufficient_privilege then null; end;
  assert not has_table_privilege(current_user,'private.clair_chart_export_receipts','INSERT');
end $$;
reset role;
do $$begin
  assert (select count(*) from private.clair_chart_export_receipts where workspace_id='synthetic-chart-search-history-v2')=2;
  assert (select count(distinct format) from private.clair_chart_export_receipts
    where workspace_id='synthetic-chart-search-history-v2' and actor_id='aac27000-0000-4000-8000-000000000003'
    and chart_ids=array['aac27300-0000-4000-8000-000000000005'::uuid] and issued_at>=transaction_timestamp())=2;
end$$;
rollback;
