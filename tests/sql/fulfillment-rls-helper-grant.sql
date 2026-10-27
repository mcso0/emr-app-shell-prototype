\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values
 ('92000000-0000-4000-8000-000000000001','grant-admin@example.invalid'),
 ('92000000-0000-4000-8000-000000000002','grant-foreign@example.invalid'),
 ('92000000-0000-4000-8000-000000000003','grant-inactive@example.invalid'),
 ('92000000-0000-4000-8000-000000000004','grant-staff@example.invalid');
insert into public.users(id,display_name,status) values
 ('92000000-0000-4000-8000-000000000001','Synthetic Admin','active'),
 ('92000000-0000-4000-8000-000000000002','Synthetic Foreign','active'),
 ('92000000-0000-4000-8000-000000000003','Synthetic Inactive','active'),
 ('92000000-0000-4000-8000-000000000004','Synthetic Staff','active');
insert into public.workspaces(id,display_name) values ('grant-alpha','Synthetic Alpha'),('grant-beta','Synthetic Beta');
insert into public.user_memberships(workspace_id,user_id,roles,status) values
 ('grant-alpha','92000000-0000-4000-8000-000000000001',array['hospital_admin'],'active'),
 ('grant-beta','92000000-0000-4000-8000-000000000002',array['hospital_admin'],'active'),
 ('grant-alpha','92000000-0000-4000-8000-000000000003',array['vet'],'inactive'),
 ('grant-alpha','92000000-0000-4000-8000-000000000004',array['vet'],'active');

create temp table before_policies as select * from pg_policies where schemaname='public';
create temp table before_table_acl as select oid,relacl from pg_class where relnamespace='public'::regnamespace;
-- APPLY CANDIDATE
-- APPLY CANDIDATE
insert into public.patients(id,workspace_id,patient_no,name,species) values
 ('93000000-0000-4000-8000-000000000001','grant-alpha','SYN-A','Synthetic A','dog'),
 ('93000000-0000-4000-8000-000000000002','grant-beta','SYN-B','Synthetic B','dog');
insert into public.encounters(id,workspace_id,patient_id,encounter_no,reception_type) values
 ('93000000-0000-4000-8000-000000000011','grant-alpha','93000000-0000-4000-8000-000000000001','SYN-E-A','walk_in'),
 ('93000000-0000-4000-8000-000000000012','grant-beta','93000000-0000-4000-8000-000000000002','SYN-E-B','walk_in');
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,clinical_order_type,execution_mode,destination_module) values
 ('93000000-0000-4000-8000-000000000021','grant-alpha','93000000-0000-4000-8000-000000000011','lab','Synthetic grant check','clinical_lab','routed','lab'),
 ('93000000-0000-4000-8000-000000000022','grant-beta','93000000-0000-4000-8000-000000000012','lab','Synthetic grant check','clinical_lab','routed','lab');
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,destination_module) values
 ('93000000-0000-4000-8000-000000000031','grant-alpha','93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000021','lab','lab','lab'),
 ('93000000-0000-4000-8000-000000000032','grant-beta','93000000-0000-4000-8000-000000000012','93000000-0000-4000-8000-000000000022','lab','lab','lab');
-- Explicitly remove this synthetic staff role's queue permission, preserving membership.
update public.workspace_permission_roles r set permissions='{"allowed":[]}'::jsonb
from public.workspace_membership_permission_role_assignments a join public.user_memberships m on m.id=a.membership_id
where r.id=a.permission_role_id and m.user_id='92000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.order_fulfillment_work_items where id in ('93000000-0000-4000-8000-000000000031','93000000-0000-4000-8000-000000000032')) <> 1 then raise exception 'own read / foreign isolation failed'; end if;
 if not exists(select 1 from public.order_fulfillment_work_items where id='93000000-0000-4000-8000-000000000031') then raise exception 'own item missing'; end if;
 begin update public.order_fulfillment_work_items set priority='high'; raise exception 'direct write allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.order_fulfillment_work_items where workspace_id='grant-alpha') then raise exception 'foreign read'; end if;
end $$;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.order_fulfillment_work_items where workspace_id='grant-alpha') then raise exception 'inactive read'; end if;
end $$;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
do $$ begin
 if exists(select 1 from public.order_fulfillment_work_items where workspace_id='grant-alpha') then raise exception 'missing capability read'; end if;
end $$;
reset role;
do $$ begin
 if exists((select * from before_policies except select * from pg_policies where schemaname='public') union all (select * from pg_policies where schemaname='public' except select * from before_policies)) then raise exception 'policy changed'; end if;
 if exists(select 1 from before_table_acl b join pg_class c on c.oid=b.oid where b.relacl is distinct from c.relacl) then raise exception 'table grants changed'; end if;
 if has_function_privilege('anon','private.clair_queue_permission_for_destination(text,text)','execute') or has_function_privilege('service_role','private.clair_queue_permission_for_destination(text,text)','execute') then raise exception 'unrequested role grant'; end if;
end $$;
rollback;
select 'PASS helper grant twice, authorized row, foreign workspace, inactive member, missing capability, direct write denial, unchanged RLS and table ACL, anon/service denied';
