begin;

-- Add read-only requester context to the existing scoped order projection.
-- Keep the function's ACL, invoker mode and all existing row fields unchanged.
do $$
declare
  definition text := pg_get_functiondef('private.clair_b3_runtime_row_json(public.orders)'::regprocedure);
  anchor text := '''instruction'', p_order.instruction,';
begin
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
    raise exception 'chart_requester_projection_anchor_mismatch';
  end if;
  execute replace(definition,anchor,anchor || '
      ''requestedByUserId'', p_order.requested_by_user_id,
      ''requestedByDisplayName'', (select u.display_name from public.users u where u.id=p_order.requested_by_user_id),');
end;
$$;

commit;
