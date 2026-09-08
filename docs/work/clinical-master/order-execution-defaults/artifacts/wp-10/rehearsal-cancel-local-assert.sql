-- Actual statement cancellation: writes inside the wrapper must roll back,
-- while the operator-only diagnostic survives until the harness outer rollback.
create temp table wp10_cancel_probe(n integer);
insert into wp10_cancel_probe values(1);
create temp table wp10_saved_operator(definition text);
insert into wp10_saved_operator select pg_get_functiondef('private.clair_apply_wp10_ready_orders(jsonb,text,boolean)'::regprocedure);
create or replace function private.clair_apply_wp10_ready_orders(p_packet jsonb,p_packet_sha text,p_commit boolean default false) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
begin
  update pg_temp.wp10_cancel_probe set n=2;
  perform pg_sleep(1);
  return '{}'::jsonb;
end $f$;
set local statement_timeout='50ms';
select private.clair_rehearse_wp10_ready_orders('{}',repeat('1',64))->>'errorCode' as expected_57014;
set local statement_timeout='600s';
do $check$
begin
  execute (select definition from wp10_saved_operator);
  if (select n from wp10_cancel_probe)<>1
    or (select count(*) from private.wp10_ready_orders_rehearsal_failures where packet_sha256=repeat('1',64) and error_sqlstate='57014')<>1
    or exists(select 1 from private.wp10_ready_orders_rehearsal where packet_sha256=repeat('1',64)) then
    raise exception 'test cancelled rehearsal boundary failed'; end if;
  raise notice 'WP10 actual statement cancellation: 57014 captured, probe write rolled back, no success receipt';
end $check$;
