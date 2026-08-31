-- CLINICAL-BILLING-PR-022: publish a private, encounter-scoped invalidation
-- signal when the authoritative Plan/Order billing summary may have changed.

create or replace function private.clair_chart_billing_realtime_topic(
  p_workspace_id text,
  p_encounter_id uuid
)
returns text
language sql
stable
set search_path = pg_catalog, pg_temp
as $function$
  select 'workspace:' || p_workspace_id || ':encounter:' || p_encounter_id::text || ':billing-summary'
$function$;

create or replace function private.clair_chart_billing_realtime_workspace_from_topic(
  p_topic text
)
returns text
language sql
stable
set search_path = pg_catalog, pg_temp
as $function$
  select case
    when p_topic ~ '^workspace:[^:]+:encounter:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:billing-summary$'
      then split_part(p_topic, ':', 2)
    else null
  end
$function$;

create or replace function private.clair_chart_billing_realtime_encounter_from_topic(
  p_topic text
)
returns uuid
language sql
stable
set search_path = pg_catalog, pg_temp
as $function$
  select case
    when p_topic ~ '^workspace:[^:]+:encounter:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:billing-summary$'
      then split_part(p_topic, ':', 4)::uuid
    else null
  end
$function$;

revoke all on function private.clair_chart_billing_realtime_topic(text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.clair_chart_billing_realtime_workspace_from_topic(text)
  from public, anon, authenticated, service_role;
revoke all on function private.clair_chart_billing_realtime_encounter_from_topic(text)
  from public, anon, authenticated, service_role;
grant execute on function private.clair_chart_billing_realtime_workspace_from_topic(text)
  to authenticated;
grant execute on function private.clair_chart_billing_realtime_encounter_from_topic(text)
  to authenticated;

drop policy if exists clair_chart_billing_summary_realtime_receive on realtime.messages;
create policy clair_chart_billing_summary_realtime_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.clair_chart_billing_realtime_workspace_from_topic(
    (select realtime.topic())
  ) is not null
  and private.clair_chart_billing_realtime_encounter_from_topic(
    (select realtime.topic())
  ) is not null
  and private.clair_is_active_workspace_member(
    private.clair_chart_billing_realtime_workspace_from_topic(
      (select realtime.topic())
    )
  )
  and private.clair_current_user_has_workspace_permission(
    private.clair_chart_billing_realtime_workspace_from_topic(
      (select realtime.topic())
    ),
    'chart:view'
  )
);

create or replace function private.clair_broadcast_chart_billing_summary_changed(
  p_workspace_id text,
  p_encounter_id uuid,
  p_etag text default null,
  p_transaction_id text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private, realtime, pg_temp
as $function$
begin
  if nullif(btrim(p_workspace_id), '') is null or p_encounter_id is null then
    return;
  end if;

  perform realtime.send(
    jsonb_strip_nulls(jsonb_build_object(
      'workspaceId', p_workspace_id,
      'encounterId', p_encounter_id,
      'etag', nullif(btrim(p_etag), ''),
      'transactionId', coalesce(
        nullif(btrim(p_transaction_id), ''),
        txid_current()::text
      ),
      'occurredAt', clock_timestamp(),
      'version', 1
    )),
    'billing_summary_changed',
    private.clair_chart_billing_realtime_topic(
      p_workspace_id,
      p_encounter_id
    ),
    true
  );
exception
  when others then
    raise warning 'chart_billing_summary_realtime_send_failed';
end;
$function$;

revoke all on function private.clair_broadcast_chart_billing_summary_changed(
  text,uuid,text,text
) from public, anon, authenticated, service_role;

create or replace function private.clair_chart_billing_target_from_financial_row(
  p_table_name text,
  p_row jsonb
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  v_workspace_id text := nullif(btrim(p_row ->> 'workspace_id'), '');
  v_invoice_id uuid := private.clair_b3_safe_uuid(p_row ->> 'invoice_id');
  v_invoice_line_id uuid;
  v_encounter_id uuid;
begin
  if v_workspace_id is null or p_row is null then
    return null;
  end if;

  if p_table_name = 'invoices' then
    v_encounter_id := private.clair_b3_safe_uuid(p_row ->> 'encounter_id');
  elsif p_table_name = 'invoice_adjustments' and v_invoice_id is null then
    v_invoice_line_id := private.clair_b3_safe_uuid(p_row ->> 'invoice_line_id');
    if v_invoice_line_id is not null then
      select il.invoice_id
      into v_invoice_id
      from public.invoice_lines il
      where il.workspace_id = v_workspace_id
        and il.id = v_invoice_line_id;
    end if;
  end if;

  if p_table_name <> 'invoices' and v_invoice_id is not null then
    select invoices.encounter_id
    into v_encounter_id
    from public.invoices invoices
    where invoices.workspace_id = v_workspace_id
      and invoices.id = v_invoice_id;
  end if;

  if v_encounter_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'workspaceId', v_workspace_id,
    'encounterId', v_encounter_id
  );
end;
$function$;

revoke all on function private.clair_chart_billing_target_from_financial_row(
  text,jsonb
) from public, anon, authenticated, service_role;

create or replace function private.clair_broadcast_chart_billing_financial_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  v_old_target jsonb;
  v_new_target jsonb;
  v_transaction_id text := txid_current()::text;
begin
  if TG_OP <> 'INSERT' then
    v_old_target := private.clair_chart_billing_target_from_financial_row(
      TG_TABLE_NAME,
      to_jsonb(old)
    );
  end if;

  if TG_OP <> 'DELETE' then
    v_new_target := private.clair_chart_billing_target_from_financial_row(
      TG_TABLE_NAME,
      to_jsonb(new)
    );
  end if;

  if TG_OP = 'DELETE' or (
    TG_OP = 'UPDATE'
    and v_old_target is not null
    and v_old_target is distinct from v_new_target
  ) then
    perform private.clair_broadcast_chart_billing_summary_changed(
      v_old_target ->> 'workspaceId',
      private.clair_b3_safe_uuid(v_old_target ->> 'encounterId'),
      null,
      v_transaction_id
    );
  end if;

  if TG_OP <> 'DELETE' and v_new_target is not null then
    perform private.clair_broadcast_chart_billing_summary_changed(
      v_new_target ->> 'workspaceId',
      private.clair_b3_safe_uuid(v_new_target ->> 'encounterId'),
      null,
      v_transaction_id
    );
  end if;

  return null;
end;
$function$;

revoke all on function private.clair_broadcast_chart_billing_financial_change()
  from public, anon, authenticated, service_role;

drop trigger if exists clair_invoices_billing_summary_realtime on public.invoices;
create trigger clair_invoices_billing_summary_realtime
after insert or update or delete on public.invoices
for each row
execute function private.clair_broadcast_chart_billing_financial_change();

drop trigger if exists clair_invoice_lines_billing_summary_realtime on public.invoice_lines;
create trigger clair_invoice_lines_billing_summary_realtime
after insert or update or delete on public.invoice_lines
for each row
execute function private.clair_broadcast_chart_billing_financial_change();

drop trigger if exists clair_payments_billing_summary_realtime on public.payments;
create trigger clair_payments_billing_summary_realtime
after insert or update or delete on public.payments
for each row
execute function private.clair_broadcast_chart_billing_financial_change();

drop trigger if exists clair_invoice_adjustments_billing_summary_realtime
  on public.invoice_adjustments;
create trigger clair_invoice_adjustments_billing_summary_realtime
after insert or update or delete on public.invoice_adjustments
for each row
execute function private.clair_broadcast_chart_billing_financial_change();

create or replace function public.clair_save_chart_order_draft(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, master, extensions, pg_temp
as $function$
declare
  v_actor uuid := private.clair_b3_safe_uuid(p_actor_user_id);
  v_result jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null or v_actor is null or v_actor is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view')
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  v_result := public.clair_save_chart_order_draft_billing_summary_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_orders
  );
  v_summary := private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id,
    p_encounter_id
  );

  perform private.clair_broadcast_chart_billing_summary_changed(
    p_workspace_id,
    p_encounter_id,
    v_summary ->> 'etag',
    txid_current()::text
  );

  return v_result || jsonb_build_object('billingSummary', v_summary);
end;
$function$;

create or replace function public.clair_confirm_chart_order_candidates(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_selected_root_order_ids uuid[],
  p_expected_draft_etag text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_result jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:update'
    )
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:view'
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  v_result := public.clair_confirm_chart_order_candidates_billing_summary_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_selected_root_order_ids,
    p_expected_draft_etag,
    p_idempotency_key
  );
  v_summary := private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id,
    p_encounter_id
  );

  perform private.clair_broadcast_chart_billing_summary_changed(
    p_workspace_id,
    p_encounter_id,
    v_summary ->> 'etag',
    txid_current()::text
  );

  return v_result || jsonb_build_object('billingSummary', v_summary);
end;
$function$;

create or replace function public.clair_mutate_chart_order_execution(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_action text,
  p_reason text,
  p_expected_revision_no integer,
  p_changes jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_encounter_id uuid;
  v_result jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      case when btrim(coalesce(p_action, '')) = 'billing_correct'
        then 'billing:issue' else 'order:update' end
    )
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:view'
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select orders.encounter_id
  into v_encounter_id
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id;

  if v_encounter_id is null then
    raise exception 'order_unavailable';
  end if;

  v_result := public.clair_mutate_chart_order_execution_billing_summary_base(
    p_workspace_id,
    p_actor_user_id,
    p_order_id,
    p_action,
    p_reason,
    p_expected_revision_no,
    p_changes,
    p_idempotency_key
  );
  v_summary := private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id,
    v_encounter_id
  );

  perform private.clair_broadcast_chart_billing_summary_changed(
    p_workspace_id,
    v_encounter_id,
    v_summary ->> 'etag',
    txid_current()::text
  );

  return v_result || jsonb_build_object('billingSummary', v_summary);
end;
$function$;

revoke all on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  to authenticated;

revoke all on function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)
  from public, anon, service_role;
grant execute on function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)
  to authenticated;

revoke all on function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)
  from public, anon, service_role;
grant execute on function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)
  to authenticated;

comment on function private.clair_broadcast_chart_billing_summary_changed(
  text,uuid,text,text
) is
  'Sends a private, payload-minimal encounter billing summary invalidation event.';
comment on policy clair_chart_billing_summary_realtime_receive on realtime.messages is
  'Allows active workspace members with chart:view to receive private billing summary invalidations.';
