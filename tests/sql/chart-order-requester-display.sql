create schema private;
create table public.users(id uuid primary key, display_name text);
create table public.orders(id uuid primary key, requested_by_user_id uuid, instruction text, kind text);
create function private.clair_b3_runtime_row_json(p_order public.orders) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
select jsonb_build_object('id',p_order.id, 'kind',p_order.kind,
      'instruction', p_order.instruction,
      'preserved',true);
$$;
revoke all on function private.clair_b3_runtime_row_json(public.orders) from public;
create temporary table original_contract as select proacl,prosecdef,provolatile,proconfig from pg_proc where oid='private.clair_b3_runtime_row_json(public.orders)'::regprocedure;
insert into public.users values ('10000000-0000-4000-8000-000000000001','합성 요청자');
insert into public.orders select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, '10000000-0000-4000-8000-000000000001', '보존 지시', kind from (values(1,'individual'),(2,'set'),(3,'set_child')) t(n,kind);
insert into public.orders values ('20000000-0000-4000-8000-000000000004',null,'보존 지시','individual'),('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000099','보존 지시','individual');
create temporary table original_rows as select * from public.orders;
-- MIGRATION
DO $$
declare r public.orders; j jsonb;
begin
for r in select * from public.orders loop
 j:=private.clair_b3_runtime_row_json(r);
 if not j ? 'requestedByUserId' then raise exception 'missing_requester'; end if;
 if j->>'requestedByUserId' is distinct from r.requested_by_user_id::text then raise exception 'requester_id_mismatch'; end if;
 if j->>'requestedByDisplayName' is distinct from (select display_name from public.users where id=r.requested_by_user_id) then raise exception 'requester_name_mismatch'; end if;
 if j->>'instruction' <> r.instruction or j->>'kind' <> r.kind or j->>'preserved' <> 'true' then raise exception 'lost_existing_fields'; end if;
end loop;
if exists(select * from public.orders except select * from original_rows) or exists(select * from original_rows except select * from public.orders) then raise exception 'orders_changed'; end if;
if exists(select proacl,prosecdef,provolatile,proconfig from pg_proc where oid='private.clair_b3_runtime_row_json(public.orders)'::regprocedure except select * from original_contract) then raise exception 'function_contract_changed'; end if;
end $$;
