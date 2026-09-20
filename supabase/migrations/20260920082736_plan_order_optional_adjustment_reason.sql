-- CHART-PR-038: optional free-text adjustment reasons.
-- Filename version matches the approved remote migration history entry.
-- Keep the table/RPC security, versioning, locking, idempotency, and audit
-- contract from 20260903003949; remove only the reason-required constraints.

alter table public.order_prebilling_overrides
  drop constraint if exists order_prebilling_overrides_check;

create or replace function public.clair_save_chart_order_prebilling_override(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_id uuid,
  p_expected_version integer,
  p_idempotency_key text,
  p_override jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_candidate public.order_billing_candidates%rowtype;
  v_order public.orders%rowtype;
  v_previous public.order_prebilling_overrides%rowtype;
  v_existing public.order_prebilling_overrides%rowtype;
  v_version integer;
  v_hash text;
  v_billing_name text;
  v_reflection boolean;
  v_quantity numeric;
  v_source text;
  v_amount bigint;
  v_percent numeric;
  v_reason text;
  v_base_amount bigint;
  v_charge_amount bigint;
  v_actor_membership_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := now();
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_version is null or p_expected_version < 0
    or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160
    or jsonb_typeof(p_override) <> 'object'
  then raise exception 'invalid_prebilling_override'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_override) key
    where key not in (
      'billingName','billingReflectionEnabled','billingQuantity',
      'adjustmentSource','adjustmentAmountKrw','adjustmentPercent','adjustmentReason'
    )
  ) then raise exception 'unknown_prebilling_override_field'; end if;

  v_hash := encode(digest(jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'encounterId', p_encounter_id,
    'orderId', p_order_id,
    'expectedVersion', p_expected_version,
    'override', p_override
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'order_prebilling_override:' || p_workspace_id || ':' || p_order_id::text,
    0
  ));
  select * into v_existing
  from public.order_prebilling_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.request_sha256 is distinct from v_hash then
      raise exception 'idempotency_conflict';
    end if;
    return jsonb_build_object(
      'orderId', v_existing.order_id,
      'versionNo', v_existing.version_no,
      'billingName', v_existing.billing_name,
      'billingReflectionEnabled', v_existing.billing_reflection_enabled,
      'billingQuantity', v_existing.billing_quantity,
      'adjustmentSource', v_existing.adjustment_source,
      'adjustmentAmountKrw', v_existing.adjustment_amount_krw,
      'adjustmentPercent', v_existing.adjustment_percent,
      'adjustmentReason', v_existing.adjustment_reason,
      'baseAmountKrw', round((
        select candidate.unit_price * v_existing.billing_quantity
        from public.order_billing_candidates candidate
        where candidate.workspace_id = p_workspace_id
          and candidate.order_id = p_order_id
      ))::bigint,
      'chargeAmountKrw', (
        select amount from public.order_billing_candidates candidate
        where candidate.workspace_id = p_workspace_id
          and candidate.order_id = p_order_id
      )
    );
  end if;

  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.id = p_order_id
  for update;
  if not found or v_order.status = 'cancelled'
    or v_order.order_confirmation_status <> 'confirmed'
    or v_order.invoice_line_id is not null
  then raise exception 'order_unavailable'; end if;

  select * into v_candidate
  from public.order_billing_candidates candidate
  where candidate.workspace_id = p_workspace_id
    and candidate.encounter_id = p_encounter_id
    and candidate.order_id = p_order_id
  for update;
  if not found or v_candidate.status <> 'candidate_created' then
    raise exception 'billing_candidate_unavailable';
  end if;

  select * into v_previous
  from public.order_prebilling_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.order_id = p_order_id
  order by override_row.version_no desc
  limit 1;
  v_version := case when found then v_previous.version_no else 0 end;
  if v_version is distinct from p_expected_version then
    raise exception 'revision_conflict';
  end if;

  if p_override ? 'billingName'
    and jsonb_typeof(p_override->'billingName') <> 'string'
  then raise exception 'billing_name_invalid'; end if;
  if p_override ? 'billingReflectionEnabled'
    and jsonb_typeof(p_override->'billingReflectionEnabled') <> 'boolean'
  then raise exception 'billing_reflection_invalid'; end if;
  if p_override ? 'billingQuantity'
    and jsonb_typeof(p_override->'billingQuantity') <> 'number'
  then raise exception 'billing_quantity_invalid'; end if;

  v_billing_name := btrim(case when p_override ? 'billingName'
    then p_override->>'billingName'
    when v_version > 0 then v_previous.billing_name
    else v_candidate.billing_name_snapshot end);
  v_reflection := case when p_override ? 'billingReflectionEnabled'
    then (p_override->>'billingReflectionEnabled')::boolean
    when v_version > 0 then v_previous.billing_reflection_enabled
    else v_order.billing_reflection_enabled end;
  v_quantity := case when p_override ? 'billingQuantity'
    then (p_override->>'billingQuantity')::numeric
    when v_version > 0 then v_previous.billing_quantity
    else v_candidate.quantity end;
  v_source := case when p_override ? 'adjustmentSource'
    then nullif(p_override->>'adjustmentSource', '')
    when v_version > 0 then v_previous.adjustment_source
    else null end;
  v_reason := nullif(btrim(case when p_override ? 'adjustmentReason'
    then coalesce(p_override->>'adjustmentReason', '')
    when v_version > 0 then coalesce(v_previous.adjustment_reason, '')
    else '' end), '');

  if v_billing_name = '' or v_quantity <= 0
    or v_source is not null and v_source not in ('amount','percent')
  then raise exception 'invalid_prebilling_override'; end if;
  v_base_amount := round(v_candidate.unit_price * v_quantity)::bigint;
  if v_source = 'amount' then
    if coalesce(jsonb_typeof(p_override->'adjustmentAmountKrw'), 'null') <> 'number'
      and not (v_version > 0 and not (p_override ? 'adjustmentSource'))
    then raise exception 'adjustment_amount_required'; end if;
    v_amount := case when p_override ? 'adjustmentAmountKrw'
      then (p_override->>'adjustmentAmountKrw')::bigint
      else v_previous.adjustment_amount_krw end;
    v_percent := case when v_base_amount = 0 then 0
      else (v_amount::numeric / v_base_amount::numeric) * 100 end;
  elsif v_source = 'percent' then
    if coalesce(jsonb_typeof(p_override->'adjustmentPercent'), 'null') <> 'number'
      and not (v_version > 0 and not (p_override ? 'adjustmentSource'))
    then raise exception 'adjustment_percent_required'; end if;
    v_percent := case when p_override ? 'adjustmentPercent'
      then (p_override->>'adjustmentPercent')::numeric
      else v_previous.adjustment_percent end;
    v_amount := round((v_base_amount::numeric * v_percent) / 100)::bigint;
  else
    v_source := null;
    v_amount := 0;
    v_percent := 0;
  end if;
  v_charge_amount := v_base_amount + v_amount;
  if v_charge_amount < 0 then raise exception 'negative_charge'; end if;

  v_before := jsonb_build_object(
    'billingName', v_candidate.billing_name_snapshot,
    'billingReflectionEnabled', v_order.billing_reflection_enabled,
    'billingQuantity', v_candidate.quantity,
    'adjustmentSource', case when v_version > 0 then v_previous.adjustment_source else null end,
    'adjustmentAmountKrw', case when v_version > 0 then v_previous.adjustment_amount_krw else 0 end,
    'adjustmentPercent', case when v_version > 0 then v_previous.adjustment_percent else 0 end,
    'adjustmentReason', case when v_version > 0 then v_previous.adjustment_reason else null end,
    'baseAmountKrw', round(v_candidate.unit_price * v_candidate.quantity)::bigint,
    'chargeAmountKrw', v_candidate.amount,
    'versionNo', v_version
  );
  v_after := jsonb_build_object(
    'billingName', v_billing_name,
    'billingReflectionEnabled', v_reflection,
    'billingQuantity', v_quantity,
    'adjustmentSource', v_source,
    'adjustmentAmountKrw', v_amount,
    'adjustmentPercent', v_percent,
    'adjustmentReason', v_reason,
    'baseAmountKrw', v_base_amount,
    'chargeAmountKrw', v_charge_amount,
    'versionNo', v_version + 1
  );

  insert into public.order_prebilling_overrides (
    workspace_id, encounter_id, order_id, version_no, idempotency_key,
    request_sha256, billing_name, billing_reflection_enabled,
    billing_quantity, adjustment_source, adjustment_amount_krw,
    adjustment_percent, adjustment_reason, created_by_user_id
  ) values (
    p_workspace_id, p_encounter_id, p_order_id, v_version + 1,
    btrim(p_idempotency_key), v_hash, v_billing_name, v_reflection,
    v_quantity, v_source, v_amount, v_percent, v_reason, p_actor_user_id
  ) returning * into v_previous;

  update public.orders orders
  set billing_reflection_enabled = v_reflection, updated_at = v_now
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

  update public.order_billing_candidates candidate
  set
    billing_name_snapshot = v_billing_name,
    quantity = v_quantity,
    amount = v_charge_amount,
    source_snapshot = candidate.source_snapshot || jsonb_build_object(
      'preBillingOverride', jsonb_build_object(
        'versionNo', v_version + 1,
        'billingName', v_billing_name,
        'billingReflectionEnabled', v_reflection,
        'billingQuantity', v_quantity,
        'adjustmentSource', v_source,
        'adjustmentAmountKrw', v_amount,
        'adjustmentPercent', v_percent,
        'adjustmentReason', v_reason
      )
    ),
    updated_at = v_now
  where candidate.workspace_id = p_workspace_id and candidate.order_id = p_order_id;

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id, p_order_id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action','prebilling_override_saved','versionNo',v_version + 1,
      'previousVersionNo',v_version,'idempotencyKey',btrim(p_idempotency_key)
    ),
    v_now
  );

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    reason, before_snapshot, after_snapshot, metadata,
    occurred_at, created_at
  ) values (
    'order-prebilling-override-' || v_previous.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'order.draft_changed', 'order', p_order_id::text,
    p_encounter_id, v_previous.id::text, v_reason,
    v_before, v_after,
    jsonb_build_object(
      'source', 'order-prebilling-override-v1',
      'versionNo', v_version + 1,
      'idempotencyKey', btrim(p_idempotency_key)
    ),
    v_now, v_now
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'versionNo', v_version + 1,
    'billingName', v_billing_name,
    'billingReflectionEnabled', v_reflection,
    'billingQuantity', v_quantity,
    'adjustmentSource', v_source,
    'adjustmentAmountKrw', v_amount,
    'adjustmentPercent', v_percent,
    'adjustmentReason', v_reason,
    'baseAmountKrw', v_base_amount,
    'chargeAmountKrw', v_charge_amount
  );
end;
$function$;

revoke all on function public.clair_save_chart_order_prebilling_override(
  text,uuid,uuid,uuid,integer,text,jsonb
) from public, anon, service_role;
grant execute on function public.clair_save_chart_order_prebilling_override(
  text,uuid,uuid,uuid,integer,text,jsonb
) to authenticated;
