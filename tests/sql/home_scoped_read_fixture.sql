-- Dedicated schema-only local DB. Synthetic data only; never use hosted SQL.
do $$begin if current_database() <> 'item5_synthetic' then raise exception 'requires item5_synthetic local database'; end if; end$$;
insert into auth.users(id) select ('99500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6) n;
insert into public.users(id,display_name) select id,'Synthetic home role '||row_number() over(order by id) from auth.users;
insert into public.workspaces(id,display_name) values ('home-local-proof','Synthetic home proof'),('home-foreign-proof','Synthetic foreign proof');
insert into public.user_memberships(id,workspace_id,user_id,roles,status)
select md5('membership-'||n)::uuid,'home-local-proof',('99500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,array['front_desk'],'active' from generate_series(1,6) n;
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions)
select md5('role-'||n)::uuid,'home-local-proof','home-role-'||n,'Synthetic home role '||n,
  case when n in (1,4) then 'admin' else 'custom' end,jsonb_build_object('allowed',
  case n when 1 then '["reception:view","chart:view","lab:view","imaging:view","dispensing:view","billing:view"]'::jsonb
    when 2 then '["reception:view"]'::jsonb
    when 3 then '["reception:view","chart:view"]'::jsonb
    when 4 then '["reception:view","lab:view","imaging:view","dispensing:view"]'::jsonb
    when 5 then '["reception:view","billing:view"]'::jsonb
    else '["billing:view"]'::jsonb end) from generate_series(1,6) n;
insert into public.workspace_membership_permission_role_assignments(membership_id,workspace_id,permission_role_id,owner_source)
select md5('membership-'||n)::uuid,'home-local-proof',md5('role-'||n)::uuid,'explicit' from generate_series(1,6) n
on conflict(membership_id) do update set permission_role_id=excluded.permission_role_id, owner_source='explicit';

-- 6000 historical, 1200 selected-day, 100 future roots with every mapped state.
-- Sparse historical unfinished work deliberately remains eligible without a cutoff.
create temporary table home_fixture as select n,
  md5('patient-'||n)::uuid patient_id, md5('guardian-'||n)::uuid guardian_id,
  md5('appointment-'||n)::uuid appointment_id, md5('encounter-'||n)::uuid encounter_id,
  md5('invoice-'||n)::uuid invoice_id, md5('order-'||n)::uuid order_id,
  case when n <= 6000 then '2025-01-01Z'::timestamptz + (n%365)*interval '1 day'
    when n <= 7200 then '2026-10-02T15:00Z'::timestamptz + (n%600)*interval '1 second'
    else '2026-10-03T15:00Z'::timestamptz + (n%100)*interval '1 second' end operating_at,
  case when n <= 6000 and n%997 <> 0 then 4+n%2 else n%6 end state
from generate_series(1,7300) n;
insert into public.guardians(id,workspace_id,name) select guardian_id,'home-local-proof','Synthetic guardian '||n from home_fixture;
insert into public.patients(id,workspace_id,patient_no,name,species) select patient_id,'home-local-proof','SYN-'||n,'Synthetic patient '||n,'dog' from home_fixture;
insert into public.appointments(id,workspace_id,patient_id,guardian_id,status,scheduled_start_at,created_at,updated_at,created_by_user_id,visit_purpose)
select appointment_id,'home-local-proof',patient_id,guardian_id,(array['requested','confirmed','changed','confirmed','checked_in','no_show'])[state+1],
  operating_at,'2024-01-01Z',operating_at,'99500000-0000-4000-8000-000000000001','Synthetic visit '||n from home_fixture;
insert into public.encounters(id,workspace_id,patient_id,guardian_id,encounter_no,reception_type,appointment_id,status,checked_in_at,checked_in_by_user_id,primary_veterinarian_id,cancellation_reason)
select encounter_id,'home-local-proof',patient_id,case when n%11=0 then null else guardian_id end,'SYN-E-'||n,
  case when n%3=0 then 'appointment' else 'walk_in' end,case when n%3=0 then appointment_id end,
  (array['waiting','in_consultation','ordered','ready_for_billing','completed','cancelled'])[state+1],operating_at,
  '99500000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000003',case when state=5 then 'Synthetic cancellation' end from home_fixture;
insert into public.appointment_staff_assignments(workspace_id,appointment_id,assignee_user_id)
select 'home-local-proof',appointment_id,'99500000-0000-4000-8000-000000000001' from home_fixture where n%3=0;
insert into public.encounter_staff_assignments(workspace_id,encounter_id,assignee_user_id)
select 'home-local-proof',encounter_id,'99500000-0000-4000-8000-000000000002' from home_fixture where n%3=1;
insert into public.waiting_queue_entries(id,workspace_id,encounter_id,queue_type,status,entered_at,priority)
select md5(q||'-queue-'||n)::uuid,'home-local-proof',encounter_id,q,
  (array['waiting','called','in_progress','done','done','cancelled'])[state+1],operating_at,
  case when n%37=0 then 'urgent' else 'normal' end
from home_fixture cross join unnest(array['reception','consultation']) q where n%7<>0;
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,billing_candidate_id)
select order_id,'home-local-proof',encounter_id,'lab','Synthetic order '||n,case when n%3=0 then md5('candidate-'||n)::uuid end from home_fixture;
insert into public.invoices(id,workspace_id,encounter_id,guardian_id,invoice_no,status,payment_state,billing_requested_at,created_at,issued_at,paid_at,total_amount,unpaid_reason,voided_reason)
select invoice_id,'home-local-proof',encounter_id,guardian_id,'SYN-I-'||n,
  (array['draft','issued','draft','refund_requested','paid','voided'])[state+1],
  (array['none','unpaid','failed','none','paid','refunded'])[state+1],
  case when n%3=1 then operating_at end,'2024-01-01Z',operating_at,case when state=4 then operating_at end,300,'Synthetic reason','Synthetic void reason'
from home_fixture;
insert into public.invoice_lines(id,workspace_id,invoice_id,order_id,description,quantity,unit_price,billing_candidate_id,created_at,updated_at)
select md5('line-'||n||'-'||k)::uuid,'home-local-proof',invoice_id,case when k=1 then order_id end,'Synthetic line '||k,1,100*k,
  case when n%3=1 and k=1 then md5('candidate-'||n)::uuid end,
  operating_at + (k-1)*interval '1 second',operating_at + k*interval '1 minute'
from home_fixture cross join generate_series(1,2) k;
-- All four queue types: frozen names, no frozen names, empty values, dueAt-first,
-- null dueAt fallback, urgent/returned/paused, and large unused snapshot details.
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name)
select md5('fulfillment-order-'||q||'-'||n)::uuid,'home-local-proof',encounter_id,q,'Synthetic fulfillment order '||n
from home_fixture cross join unnest(array['lab','imaging','dispensing','treatment']) q where n%3=0;
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,status,priority,
  requested_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at,source_snapshot,due_at,created_at,updated_at,started_at,started_by_user_id,completed_at,cancelled_at,returned_at)
select md5('fulfillment-'||q||'-'||n)::uuid,'home-local-proof',encounter_id,md5('fulfillment-order-'||q||'-'||n)::uuid,q,q,
  (array['requested','in_progress','paused','returned','completed','cancelled'])[state+1],
  case when n%37=0 then 'urgent' else 'normal' end,'99500000-0000-4000-8000-000000000001',
  case when n%3=0 then '99500000-0000-4000-8000-000000000002'::uuid end,
  case when n%3=0 then '99500000-0000-4000-8000-000000000001'::uuid end,
  case when n%3=0 then operating_at end,
  jsonb_build_object('orderDisplayName','Synthetic '||q||' '||n,'patientName',case when n%3=0 then 'Frozen patient '||n end,
    'guardianName',case when n%3=0 then 'Frozen guardian '||n end,'requestingVetName','Frozen requester',
    'instruction','Synthetic instruction','reception_type',case when n%2=0 then 'appointment' else 'walk_in' end,
    'detail',jsonb_build_object('modality','CT','unusedHistoricalPayload',repeat('synthetic ',300))),
  case when n%2=0 then operating_at end,case when n%2=0 then '2024-01-01Z'::timestamptz else operating_at end,
  operating_at,case when state in (1,2,4) then operating_at end,
  case when state in (1,2,4) then '99500000-0000-4000-8000-000000000001'::uuid end,
  case when state=4 then operating_at end,case when state=5 then operating_at end,case when state=3 then operating_at end
from home_fixture cross join unnest(array['lab','imaging','dispensing','treatment']) q where n%3=0;

-- A terminal queue outside the day suppresses synthesis for a still-waiting
-- current-presence encounter. A selected appointment links to an old encounter.
insert into public.waiting_queue_entries(id,workspace_id,encounter_id,queue_type,status,entered_at)
select md5('suppression-'||n)::uuid,'home-local-proof',encounter_id,'reception','done','2024-01-01Z'
from home_fixture where n=6006; -- waiting, no prior queue? delete is fixture-only below
delete from public.waiting_queue_entries where encounter_id=md5('encounter-6006')::uuid and id<>md5('suppression-6006')::uuid;
update public.encounters set checked_in_at='2024-01-01Z' where id=md5('encounter-6003')::uuid;

-- Explicit midnight, upper bound and dueAt precedence independent of status.
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name)
select md5('boundary-order-'||k)::uuid,'home-local-proof',md5('encounter-6003')::uuid,'lab','Synthetic boundary order '||k
from generate_series(1,5) k;
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,status,requested_by_user_id,source_snapshot,due_at,created_at,updated_at)
select md5('boundary-'||k)::uuid,'home-local-proof',md5('encounter-6003')::uuid,md5('boundary-order-'||k)::uuid,'lab','lab','requested',
  '99500000-0000-4000-8000-000000000001','{"billingName":"Boundary","detail":{"modality":"MR"}}',
  case when k=5 then '2026-10-02T14:59:59.999999Z'::timestamptz end,
  (array['2026-10-02T14:59:59.999999Z'::timestamptz,'2026-10-02T15:00:00Z','2026-10-03T14:59:59.999999Z','2026-10-03T15:00:00Z','2026-10-02T16:00:00Z'])[k],
  '2026-10-02T15:00Z' from generate_series(1,5) k;

insert into public.guardians(id,workspace_id,name) values (md5('foreign-guardian')::uuid,'home-foreign-proof','Foreign sentinel');
insert into public.patients(id,workspace_id,patient_no,name,species) values (md5('foreign-patient')::uuid,'home-foreign-proof','FOREIGN','Foreign sentinel','dog');
insert into public.encounters(id,workspace_id,patient_id,guardian_id,encounter_no,reception_type,checked_in_at)
values (md5('foreign-encounter')::uuid,'home-foreign-proof',md5('foreign-patient')::uuid,md5('foreign-guardian')::uuid,'FOREIGN','walk_in','2026-10-02T15:00Z');
insert into public.appointments(id,workspace_id,patient_id,guardian_id,scheduled_start_at)
values(md5('foreign-appointment')::uuid,'home-foreign-proof',md5('foreign-patient')::uuid,md5('foreign-guardian')::uuid,'2026-10-02T15:00Z');
analyze;
