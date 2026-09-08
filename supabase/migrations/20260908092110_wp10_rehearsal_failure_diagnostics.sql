-- Preserve a failed rehearsal's diagnostic after its subtransaction rolls back.
-- No clinical/catalog writes can survive this wrapper; it has no commit mode.
create table private.wp10_ready_orders_rehearsal_failures (
  id uuid primary key default extensions.gen_random_uuid(),
  packet_sha256 text not null check(packet_sha256 ~ '^[a-f0-9]{64}$'),
  error_sqlstate text not null,error_message text not null,error_context text not null,
  elapsed_seconds numeric not null,recorded_at timestamptz not null default clock_timestamp()
);
alter table private.wp10_ready_orders_rehearsal_failures enable row level security;
revoke all on private.wp10_ready_orders_rehearsal_failures from public,anon,authenticated,service_role;

create function private.clair_rehearse_wp10_ready_orders(p_packet jsonb,p_packet_sha text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,private as $f$
declare outcome jsonb; error_code text; error_message text; error_context text; started timestamptz:=clock_timestamp();
begin
  select r.outcome into outcome from private.wp10_ready_orders_rehearsal r where r.packet_sha256=p_packet_sha;
  if found then
    if private.clinical_master_sha256(p_packet) is distinct from p_packet_sha then raise exception 'wp10_packet_contract_invalid'; end if;
    return outcome;
  end if;
  begin
    outcome:=private.clair_apply_wp10_ready_orders(p_packet,p_packet_sha,false);
  exception when sqlstate '57014' then
    get stacked diagnostics error_code=returned_sqlstate,error_message=message_text,error_context=pg_exception_context;
  when others then
    get stacked diagnostics error_code=returned_sqlstate,error_message=message_text,error_context=pg_exception_context;
  end;
  if error_code is not null then
    insert into private.wp10_ready_orders_rehearsal_failures(packet_sha256,error_sqlstate,error_message,error_context,elapsed_seconds)
      values(p_packet_sha,error_code,error_message,left(error_context,4000),extract(epoch from clock_timestamp()-started));
    return jsonb_build_object('rehearsal',false,'applied',false,'packetSha256',p_packet_sha,'errorCode',error_code,'errorMessage',error_message);
  end if;
  insert into private.wp10_ready_orders_rehearsal(packet_sha256,outcome) values(p_packet_sha,outcome);
  return outcome;
end $f$;
revoke all on function private.clair_rehearse_wp10_ready_orders(jsonb,text) from public,anon,authenticated,service_role;
