-- Synthetic fixtures; caller must wrap the migration and this proof in BEGIN/ROLLBACK.
insert into auth.users(id) values ('99290000-0000-4000-8000-000000000001'),('99290000-0000-4000-8000-000000000002');
insert into public.users(id,display_name) values ('99290000-0000-4000-8000-000000000001','Synthetic billing only'),('99290000-0000-4000-8000-000000000002','Synthetic reception only');
insert into public.workspaces(id,display_name) values ('billing-queue-local-proof','Synthetic queue proof'),('billing-queue-foreign-proof','Synthetic foreign proof');
insert into public.user_memberships(id,workspace_id,user_id,roles,status) values
('99290000-0000-4000-8000-000000000011','billing-queue-local-proof','99290000-0000-4000-8000-000000000001',array['front_desk'],'active'),
('99290000-0000-4000-8000-000000000012','billing-queue-local-proof','99290000-0000-4000-8000-000000000002',array['front_desk'],'active');
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions) values
('99290000-0000-4000-8000-000000000021','billing-queue-local-proof','billing-only','Billing only','custom','{"allowed":["billing:view"]}'),
('99290000-0000-4000-8000-000000000022','billing-queue-local-proof','reception-only','Reception only','custom','{"allowed":["reception:view"]}');
insert into public.workspace_membership_permission_role_assignments(membership_id,workspace_id,permission_role_id,owner_source) values
('99290000-0000-4000-8000-000000000011','billing-queue-local-proof','99290000-0000-4000-8000-000000000021','explicit'),
('99290000-0000-4000-8000-000000000012','billing-queue-local-proof','99290000-0000-4000-8000-000000000022','explicit')
on conflict (membership_id) do update set permission_role_id=excluded.permission_role_id,owner_source='explicit';
insert into public.guardians(id,workspace_id,name) values ('99290000-0000-4000-8000-000000000031','billing-queue-local-proof','Synthetic guardian');
insert into public.patients(id,workspace_id,patient_no,name,species) values ('99290000-0000-4000-8000-000000000032','billing-queue-local-proof','SYN-Q','Synthetic patient','dog'),('99290000-0000-4000-8000-000000000035','billing-queue-foreign-proof','SYN-F','Foreign patient','dog');
insert into public.encounters(id,workspace_id,patient_id,guardian_id,encounter_no,reception_type) values
('99290000-0000-4000-8000-000000000033','billing-queue-local-proof','99290000-0000-4000-8000-000000000032','99290000-0000-4000-8000-000000000031','SYN-E','walk_in'),
('99290000-0000-4000-8000-000000000034','billing-queue-foreign-proof','99290000-0000-4000-8000-000000000035',null,'SYN-FOREIGN','walk_in');
insert into public.invoices(id,workspace_id,encounter_id,guardian_id,invoice_no,status,payment_state,billing_requested_at,paid_at,total_amount) values
('99290000-0000-4000-8000-000000000041','billing-queue-local-proof','99290000-0000-4000-8000-000000000033','99290000-0000-4000-8000-000000000031','Q-OUTSTANDING','draft','none','2026-09-06T01:00Z',null,100),
('99290000-0000-4000-8000-000000000042','billing-queue-local-proof','99290000-0000-4000-8000-000000000033',null,'Q-PAID-YESTERDAY','paid','paid','2026-09-06T01:00Z','2026-09-06T02:00Z',100),
('99290000-0000-4000-8000-000000000043','billing-queue-local-proof','99290000-0000-4000-8000-000000000033',null,'Q-PAID-TODAY','paid','paid','2026-09-07T01:00Z','2026-09-07T02:00Z',100),
('99290000-0000-4000-8000-000000000044','billing-queue-local-proof','99290000-0000-4000-8000-000000000033',null,'Q-FUTURE','draft','none','2026-09-08T01:00Z',null,100),
('99290000-0000-4000-8000-000000000045','billing-queue-foreign-proof','99290000-0000-4000-8000-000000000034',null,'Q-FOREIGN-JOIN','draft','none','2026-09-07T01:00Z',null,100);
insert into public.invoice_lines(workspace_id,invoice_id,description,quantity,unit_price) values
('billing-queue-local-proof','99290000-0000-4000-8000-000000000041','Synthetic local line',1,100),
('billing-queue-foreign-proof','99290000-0000-4000-8000-000000000045','Foreign line must not appear',1,100);
create temporary table billing_queue_before as select count(*) as invoices, sum(total_amount) as amount from public.invoices;
set local role authenticated;
select set_config('request.jwt.claim.sub','99290000-0000-4000-8000-000000000001',true);
do $$declare rows jsonb; begin
  if private.clair_current_user_has_workspace_permission('billing-queue-local-proof','reception:view') then raise exception 'fixture incorrectly has reception permission'; end if;
  rows := public.clair_list_billing_queue('billing-queue-local-proof','2026-09-07');
  if jsonb_array_length(rows) <> 2 then raise exception 'date/carryover/foreign join isolation failed: %',rows; end if;
  if rows::text like '%Q-FUTURE%' or rows::text like '%Q-PAID-YESTERDAY%' or rows::text like '%Foreign line%' then raise exception 'scope leak'; end if;
  if not exists(select 1 from jsonb_array_elements(rows) r where r->'invoice'->>'invoiceNo'='Q-OUTSTANDING' and (r->>'lineCount')::int=1 and r->'patient'->>'name'='Synthetic patient') then raise exception 'card projection failed'; end if;
  if jsonb_array_length(public.clair_list_billing_queue('billing-queue-local-proof','2026-09-07',0,1)) <> 1 or jsonb_array_length(public.clair_list_billing_queue('billing-queue-local-proof','2026-09-07',1,1)) <> 1 then raise exception 'pagination failed'; end if;
  begin perform public.clair_list_billing_queue('billing-queue-foreign-proof','2026-09-07'); raise exception 'foreign workspace allowed'; exception when insufficient_privilege then null; end;
  begin perform public.clair_list_billing_queue('billing-queue-local-proof',null); raise exception 'null date allowed'; exception when invalid_parameter_value then null; end;
  if has_function_privilege('anon','public.clair_list_billing_queue(text,date,integer,integer)','execute') then raise exception 'anonymous execute grant'; end if;
end$$;
select set_config('request.jwt.claim.sub','99290000-0000-4000-8000-000000000002',true);
do $$begin begin perform public.clair_list_billing_queue('billing-queue-local-proof','2026-09-07'); raise exception 'reception only allowed'; exception when insufficient_privilege then null; end; end$$;
select set_config('request.jwt.claim.sub','',true);
do $$begin begin perform public.clair_list_billing_queue('billing-queue-local-proof','2026-09-07'); raise exception 'missing actor allowed'; exception when insufficient_privilege then null; end; end$$;
reset role;
update public.patients set status='soft_deleted',deleted_at=null where id='99290000-0000-4000-8000-000000000032';
update public.guardians set status='soft_deleted',deleted_at=null where id='99290000-0000-4000-8000-000000000031';
set local role authenticated;
select set_config('request.jwt.claim.sub','99290000-0000-4000-8000-000000000001',true);
do $$declare rows jsonb; begin
 rows := public.clair_list_billing_queue('billing-queue-local-proof','2026-09-07');
 if rows::text like '%Synthetic patient%' or rows::text like '%Synthetic guardian%' then raise exception 'deleted subject name leaked'; end if;
 if jsonb_array_length(rows) <> 2 then raise exception 'deleted subject erased financial work'; end if;
end$$;
reset role;
select set_config('clair.membership_status_rpc','on',true);
update public.user_memberships set status='inactive' where id='99290000-0000-4000-8000-000000000011';
set local role authenticated;
do $$begin begin perform public.clair_list_billing_queue('billing-queue-local-proof','2026-09-07'); raise exception 'inactive membership allowed'; exception when insufficient_privilege then null; end; end$$;
reset role;
do $$begin
 if (select invoices from billing_queue_before) <> (select count(*) from public.invoices) or (select amount from billing_queue_before) <> (select sum(total_amount) from public.invoices) then raise exception 'reader mutated invoices'; end if;
 raise notice 'PASS billing-only, reception denial, actor, workspace, date, carryover, pagination, deleted subjects, inactive membership, no financial writes';
end$$;
