-- Local-only synthetic proof; never run against a hosted project.
do $$begin if current_database() <> 'item4_synthetic' then raise exception 'requires item4_synthetic local database'; end if; end$$;
-- Synthetic fixtures; caller must wrap the migration and this proof in BEGIN/ROLLBACK.
insert into auth.users(id) values ('99300000-0000-4000-8000-000000000001'),('99300000-0000-4000-8000-000000000002');
insert into public.users(id,display_name) values ('99300000-0000-4000-8000-000000000001','Synthetic fulfillment reader'),('99300000-0000-4000-8000-000000000002','Synthetic reception only');
insert into public.workspaces(id,display_name) values ('fulfillment-queue-local-proof','Synthetic queue proof'),('fulfillment-queue-foreign-proof','Synthetic foreign proof');
insert into public.user_memberships(id,workspace_id,user_id,roles,status) values
('99300000-0000-4000-8000-000000000011','fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000001',array['front_desk'],'active'),
('99300000-0000-4000-8000-000000000012','fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000002',array['front_desk'],'active');
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions) values
('99300000-0000-4000-8000-000000000021','fulfillment-queue-local-proof','fulfillment-reader','Fulfillment reader','admin','{"allowed":["lab:view","dispensing:view"]}'),
('99300000-0000-4000-8000-000000000022','fulfillment-queue-local-proof','reception-only','Reception only','custom','{"allowed":["reception:view"]}');
insert into public.workspace_membership_permission_role_assignments(membership_id,workspace_id,permission_role_id,owner_source) values
('99300000-0000-4000-8000-000000000011','fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000021','explicit'),
('99300000-0000-4000-8000-000000000012','fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000022','explicit')
on conflict (membership_id) do update set permission_role_id=excluded.permission_role_id,owner_source='explicit';
insert into public.guardians(id,workspace_id,name) values ('99300000-0000-4000-8000-000000000031','fulfillment-queue-local-proof','Synthetic guardian');
insert into public.patients(id,workspace_id,patient_no,name,species) values ('99300000-0000-4000-8000-000000000032','fulfillment-queue-local-proof','SYN-Q','Synthetic patient','dog'),('99300000-0000-4000-8000-000000000035','fulfillment-queue-foreign-proof','SYN-F','Foreign patient','dog');
insert into public.encounters(id,workspace_id,patient_id,guardian_id,encounter_no,reception_type) values
('99300000-0000-4000-8000-000000000033','fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000032','99300000-0000-4000-8000-000000000031','SYN-E','walk_in'),
('99300000-0000-4000-8000-000000000034','fulfillment-queue-foreign-proof','99300000-0000-4000-8000-000000000035',null,'SYN-FOREIGN','walk_in');

-- 1200 selected-day rows and 12000 historical rows per queue; no real data.
create temporary table fixture_work as
select md5(q || ':' || n || ':item')::uuid id, md5(q || ':' || n || ':order')::uuid order_id,
 q, n, (array['requested','in_progress','paused','completed','cancelled','returned'])[1+n%6] status,
 case when n <= 1200 then '2026-10-02T15:00:00Z'::timestamptz + (n%86400)*interval '1 second'
 else '2025-01-01T00:00:00Z'::timestamptz + (n%365)*interval '1 day' end operating_at
from unnest(array['lab','dispensing','treatment']) q cross join generate_series(1,13200) n;
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name)
select order_id,'fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000033',q,'Synthetic order '||n from fixture_work;
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,status,
 requested_by_user_id,source_snapshot,due_at,created_at,updated_at,started_at,started_by_user_id,completed_at,cancelled_at,returned_at)
select id,'fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000033',order_id,q,q,status,
 '99300000-0000-4000-8000-000000000001',jsonb_build_object('orderDisplayName','Synthetic order '||n,
 'billingReflectionEnabled',true,'detail',jsonb_build_object('fixturePayload',repeat('synthetic ',300))),
 case when n%2=0 then operating_at else null end,
 case when n%2=0 then '2024-01-01T00:00Z'::timestamptz else operating_at end, operating_at,
 case when status in ('in_progress','paused','completed') then operating_at end,
 case when status in ('in_progress','paused','completed') then '99300000-0000-4000-8000-000000000001'::uuid end,
 case when status='completed' then operating_at end,
 case when status='cancelled' then operating_at end, case when status='returned' then operating_at end
from fixture_work;
-- Midnight/end boundaries, dueAt precedence, future unfinished, prior unfinished, terminal timestamps.
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name)
select md5('boundary-order-'||n)::uuid,'fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000033','lab','Boundary '||n from generate_series(1,5) n;
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,status,requested_by_user_id,source_snapshot,due_at,created_at,updated_at)
select md5('boundary-item-'||n)::uuid,'fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000033',md5('boundary-order-'||n)::uuid,'lab','lab','requested',
'99300000-0000-4000-8000-000000000001','{"orderDisplayName":"Boundary","billingReflectionEnabled":true,"detail":{}}',
case when n=5 then '2026-10-02T14:59:59.999999Z'::timestamptz end,
(array['2026-10-02T14:59:59.999999Z'::timestamptz,'2026-10-02T15:00:00Z','2026-10-03T14:59:59.999999Z','2026-10-03T15:00:00Z','2026-10-02T16:00:00Z'])[n],now()
from generate_series(1,5) n;
create temporary table item4_baseline(q text primary key, rows jsonb);
set role authenticated;
select set_config('request.jwt.claim.sub','99300000-0000-4000-8000-000000000001',false);
reset role;
insert into item4_baseline select q,public.clair_list_fulfillment_work_items('fulfillment-queue-local-proof',q)
from unnest(array['lab','dispensing','treatment']) q;
select q,jsonb_array_length(rows) rows,octet_length(rows::text) json_text_bytes from item4_baseline order by q;
