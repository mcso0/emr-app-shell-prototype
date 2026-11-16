-- Return the first execution time of the items in the authorized instruction.
-- A replacement attempt has its own start time. The prior attempts stay intact.
begin;
set local lock_timeout = '5s';

do $patch$
declare
  definition text := pg_get_functiondef('public.clair_get_fulfillment_instruction(text,uuid)'::regprocedure);
  anchor text := $old$ 'items',items,'changes',changes);$old$;
  replacement text := $new$ 'firstStartedAt',(
   select min(history.started_at)
   from jsonb_array_elements(items) item
   join public.order_tasks history
     on history.workspace_id=p_workspace_id
    and history.order_id=(item->>'orderId')::uuid
    and history.attempt_no<=(item->>'attemptNo')::integer
    and history.encounter_id=wi.encounter_id
    and history.destination_module=wi.queue_type
    and history.task_role='execution'
 ),'items',items,'changes',changes);$new$;
begin
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception 'fulfillment_instruction_start_history_anchor';
  end if;
  execute replace(definition,anchor,replacement);
end $patch$;

commit;
