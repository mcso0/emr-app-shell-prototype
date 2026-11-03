begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- Reuse the existing atomic request writer and authority-freezing contract.
-- Keep the legacy whole-encounter RPC for existing callers; the UI route uses
-- the explicit selected-order RPC below. Assert every source anchor before cloning.
create function pg_temp.selected_billing_replace(source text,old text,replacement text,expected integer default 1)
returns text language plpgsql as $$
begin
 if (length(source)-length(replace(source,old,'')))/length(old)<>expected then
  raise exception 'selected billing source drift: %',old;
 end if;
 return replace(source,old,replacement);
end $$;

do $selected_writer$
declare definition text;
begin
 definition:=pg_get_functiondef('public.clair_request_chart_order_billing_authority_base(text,uuid,uuid,text,text,boolean)'::regprocedure);
 definition:=pg_temp.selected_billing_replace(definition,
  'FUNCTION public.clair_request_chart_order_billing_authority_base(',
  'FUNCTION private.clair_request_selected_chart_order_billing_internal(');
 definition:=pg_temp.selected_billing_replace(definition,'p_acknowledge_unfinished boolean DEFAULT false)',
  'p_order_ids uuid[], p_acknowledge_unfinished boolean DEFAULT false)');
 definition:=pg_temp.selected_billing_replace(definition,
  '  v_request_sha256 := encode(digest(jsonb_build_object(',
  $replacement$  if p_order_ids is null or cardinality(p_order_ids) not between 1 and 500
    or array_position(p_order_ids,null) is not null
    or cardinality(p_order_ids)<>(select count(distinct id) from unnest(p_order_ids) id)
  then raise exception 'invalid_billing_selection'; end if;
  select array_agg(id order by id) into v_order_ids from unnest(p_order_ids) id;
  v_request_sha256 := encode(digest(jsonb_build_object($replacement$);
 definition:=pg_temp.selected_billing_replace(definition,
  '''acknowledgeUnfinished'', coalesce(p_acknowledge_unfinished, false)',
  '''orderIds'', to_jsonb(v_order_ids), ''acknowledgeUnfinished'', coalesce(p_acknowledge_unfinished, false)');
 definition:=pg_temp.selected_billing_replace(definition,
  '  if jsonb_array_length(v_before->''unfinishedOrders'') > 0',
  $replacement$  if exists(select 1 from unnest(v_order_ids) id
    where not (v_before->'requestableOrderIds') @> to_jsonb(array[id::text]))
  then raise exception 'billing_selection_unavailable'; end if;
  if exists(select 1 from jsonb_array_elements(v_before->'unfinishedOrders') item
    where (item->>'orderId')::uuid=any(v_order_ids))$replacement$);
 definition:=pg_temp.selected_billing_replace(definition,
  $old$  select coalesce(array_agg(value::text::uuid order by value::text), '{}'::uuid[])
  into v_order_ids
  from jsonb_array_elements_text(v_before->'requestableOrderIds') value;$old$,
  '  -- v_order_ids is the validated explicit selection, never the whole encounter.');
 execute definition;
end $selected_writer$;
revoke all on function private.clair_request_selected_chart_order_billing_internal(text,uuid,uuid,text,text,uuid[],boolean) from public,anon,authenticated,service_role;

do $selected_authority$
declare definition text; anchor text; occurrences integer;
begin
 definition:=pg_get_functiondef('public.clair_request_chart_order_billing(text,uuid,uuid,text,text,boolean)'::regprocedure);
 definition:=pg_temp.selected_billing_replace(definition,
  'FUNCTION public.clair_request_chart_order_billing(',
  'FUNCTION public.clair_request_selected_chart_order_billing(');
 definition:=pg_temp.selected_billing_replace(definition,'p_acknowledge_unfinished boolean DEFAULT false)',
  'p_order_ids uuid[], p_acknowledge_unfinished boolean DEFAULT false)');
 -- Unselected invalid/returned candidates neither freeze nor block this request.
 anchor:='and candidate.encounter_id = p_encounter_id';
 occurrences:=(length(definition)-length(replace(definition,anchor,'')))/length(anchor);
 if occurrences<>5 then raise exception 'selected authority candidate scope drift: %',occurrences; end if;
 definition:=replace(definition,anchor,anchor||' and candidate.order_id = any(p_order_ids)');
 definition:=pg_temp.selected_billing_replace(definition,
  'public.clair_request_chart_order_billing_authority_base(',
  'private.clair_request_selected_chart_order_billing_internal(');
 definition:=pg_temp.selected_billing_replace(definition,
  E'    p_idempotency_key,\n    p_acknowledge_unfinished',
  E'    p_idempotency_key,\n    p_order_ids,\n    p_acknowledge_unfinished');
 execute definition;
end $selected_authority$;
revoke all on function public.clair_request_selected_chart_order_billing(text,uuid,uuid,text,text,uuid[],boolean) from public,anon,service_role;
grant execute on function public.clair_request_selected_chart_order_billing(text,uuid,uuid,text,text,uuid[],boolean) to authenticated;
commit;
