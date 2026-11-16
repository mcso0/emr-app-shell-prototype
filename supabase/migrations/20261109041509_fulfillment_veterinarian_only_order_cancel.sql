begin;

-- Both chart mutation RPCs delegate to this writer. Check the entire
-- cancellation scope before returning a receipt or writing a revision.
do $migration$
declare
  definition text := pg_get_functiondef(
    'public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)'::regprocedure
  );
  anchor constant text := '  v_request_sha256 := encode(';
  guard constant text := $guard$
  if v_action = 'cancel'
    and not private.clair_is_active_veterinarian_member(p_workspace_id, p_actor_user_id)
    and exists (
      select 1
      from public.orders target_order
      where target_order.workspace_id = p_workspace_id
        and (target_order.id = p_order_id or target_order.parent_chart_order_line_id = p_order_id)
        and (target_order.clinical_order_type in ('dispensing', 'treatment')
          or target_order.destination_module in ('dispensing', 'treatment'))
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

$guard$;
begin
  if length(definition) - length(replace(definition, anchor, '')) <> length(anchor) then
    raise exception 'fulfillment_veterinarian_only_order_cancel: unexpected chart mutation definition';
  end if;
  execute replace(definition, anchor, guard || anchor);
end;
$migration$;

commit;
