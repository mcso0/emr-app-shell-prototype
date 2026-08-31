\set ON_ERROR_STOP on

begin;
-- PR020_MIGRATION
-- PR022_MIGRATION_REAPPLY
-- PR022_MIGRATION_REAPPLY

do $catalog_contract$
declare
  v_function_definition text;
  v_policy record;
  v_signature text;
  v_trigger_name text;
begin
  foreach v_signature in array array[
    'private.clair_chart_billing_realtime_topic(text,uuid)',
    'private.clair_chart_billing_realtime_workspace_from_topic(text)',
    'private.clair_chart_billing_realtime_encounter_from_topic(text)',
    'private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text)',
    'private.clair_chart_billing_target_from_financial_row(text,jsonb)',
    'private.clair_broadcast_chart_billing_financial_change()'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'realtime_function_missing:%', v_signature;
    end if;
  end loop;

  if not has_function_privilege(
    'authenticated',
    'private.clair_chart_billing_realtime_workspace_from_topic(text)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'private.clair_chart_billing_realtime_encounter_from_topic(text)',
    'execute'
  ) then
    raise exception 'realtime_topic_parser_execute_missing';
  end if;

  foreach v_signature in array array[
    'private.clair_chart_billing_realtime_topic(text,uuid)',
    'private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text)',
    'private.clair_chart_billing_target_from_financial_row(text,jsonb)',
    'private.clair_broadcast_chart_billing_financial_change()'
  ]
  loop
    if has_function_privilege('authenticated', v_signature, 'execute')
      or has_function_privilege('anon', v_signature, 'execute')
      or has_function_privilege('service_role', v_signature, 'execute')
    then
      raise exception 'internal_realtime_execute_leaked:%', v_signature;
    end if;
  end loop;

  select
    policy.polcmd,
    pg_get_expr(policy.polqual, policy.polrelid) policy_using,
    policy.polroles
  into v_policy
  from pg_policy policy
  where policy.polname = 'clair_chart_billing_summary_realtime_receive'
    and policy.polrelid = 'realtime.messages'::regclass;

  if v_policy.polcmd is distinct from 'r'
    or v_policy.policy_using not like '%clair_is_active_workspace_member%'
    or v_policy.policy_using not like '%clair_current_user_has_workspace_permission%'
    or v_policy.policy_using not like '%chart:view%'
    or not ('authenticated'::regrole::oid = any(v_policy.polroles))
  then
    raise exception 'realtime_receive_policy_boundary_invalid';
  end if;

  if exists (
    select 1
    from pg_policy policy
    where policy.polrelid = 'realtime.messages'::regclass
      and policy.polname like 'clair_chart_billing_summary%'
      and policy.polcmd <> 'r'
  ) then
    raise exception 'realtime_client_send_policy_created';
  end if;

  foreach v_trigger_name in array array[
    'clair_invoices_billing_summary_realtime',
    'clair_invoice_lines_billing_summary_realtime',
    'clair_payments_billing_summary_realtime',
    'clair_invoice_adjustments_billing_summary_realtime'
  ]
  loop
    if not exists (
      select 1 from pg_trigger trigger_row
      where trigger_row.tgname = v_trigger_name
        and not trigger_row.tgisinternal
    ) then
      raise exception 'financial_realtime_trigger_missing:%', v_trigger_name;
    end if;
  end loop;

  v_function_definition := pg_get_functiondef(
    'private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text)'::regprocedure
  );
  if v_function_definition not like '%billing_summary_changed%'
    or v_function_definition not like '%workspaceId%'
    or v_function_definition not like '%encounterId%'
    or v_function_definition not like '%transactionId%'
    or v_function_definition not like '%occurredAt%'
    or v_function_definition not like '%version%'
    or v_function_definition like '%patient%'
    or v_function_definition like '%guardian%'
    or v_function_definition like '%payment%'
    or v_function_definition like '%orderName%'
  then
    raise exception 'realtime_payload_contract_invalid';
  end if;

  foreach v_signature in array array[
    'public.clair_save_chart_order_draft(text,text,uuid,jsonb)',
    'public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)',
    'public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)'
  ]
  loop
    v_function_definition := pg_get_functiondef(v_signature::regprocedure);
    if v_function_definition not like '%clair_broadcast_chart_billing_summary_changed%'
      or v_function_definition not like '%clair_get_chart_order_billing_summary_internal%'
      or v_function_definition not like '%chart:view%'
      or regexp_count(
        v_function_definition,
        'clair_broadcast_chart_billing_summary_changed'
      ) <> 1
    then
      raise exception 'mutation_realtime_wrapper_contract_invalid:%', v_signature;
    end if;
    if not has_function_privilege('authenticated', v_signature, 'execute')
      or has_function_privilege('anon', v_signature, 'execute')
      or has_function_privilege('service_role', v_signature, 'execute')
    then
      raise exception 'mutation_wrapper_acl_invalid:%', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)',
    'public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)',
    'public.clair_mutate_chart_order_execution_billing_summary_base(text,uuid,uuid,text,text,integer,jsonb,text)'
  ]
  loop
    if has_function_privilege('authenticated', v_signature, 'execute')
      or has_function_privilege('anon', v_signature, 'execute')
      or has_function_privilege('service_role', v_signature, 'execute')
    then
      raise exception 'mutation_base_acl_leaked:%', v_signature;
    end if;
  end loop;

  if private.clair_chart_billing_realtime_workspace_from_topic(
    'workspace:workspace-clair-cheongdam:encounter:449d09b4-945a-4f1f-97a9-418f6d845e50:billing-summary'
  ) is distinct from 'workspace-clair-cheongdam'
    or private.clair_chart_billing_realtime_encounter_from_topic(
      'workspace:workspace-clair-cheongdam:encounter:449d09b4-945a-4f1f-97a9-418f6d845e50:billing-summary'
    ) is distinct from '449d09b4-945a-4f1f-97a9-418f6d845e50'::uuid
    or private.clair_chart_billing_realtime_workspace_from_topic(
      'workspace:workspace-clair-cheongdam:queue'
    ) is not null
  then
    raise exception 'realtime_topic_parser_invalid';
  end if;

  raise notice 'chart_order_billing_summary_realtime_apply_reapply_acl_ok';
end;
$catalog_contract$;

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species
) values (
  '92000000-0000-4000-8000-000000000220',
  'workspace-clair-cheongdam',
  'PR022-REALTIME-001',
  'PR022 synthetic patient',
  'dog'
);

insert into public.encounters (
  id,
  workspace_id,
  patient_id,
  primary_veterinarian_id,
  encounter_no,
  reception_type,
  status
) values (
  '92000000-0000-4000-8000-000000000221',
  'workspace-clair-cheongdam',
  '92000000-0000-4000-8000-000000000220',
  '49110000-0000-4000-8000-000000000003',
  'PR022-REALTIME-ENC-001',
  'walk_in',
  'in_consultation'
);

insert into public.invoices (
  id,
  workspace_id,
  encounter_id,
  invoice_no,
  status,
  payment_state,
  subtotal_amount,
  discount_amount,
  tax_amount,
  total_amount
) values (
  '92000000-0000-4000-8000-000000000222',
  'workspace-clair-cheongdam',
  '92000000-0000-4000-8000-000000000221',
  'PR022-REALTIME-INV-001',
  'draft',
  'none',
  1000,
  0,
  0,
  1000
);

insert into public.invoice_lines (
  id,
  workspace_id,
  invoice_id,
  description,
  quantity,
  unit_price,
  discount_amount
) values (
  '92000000-0000-4000-8000-000000000223',
  'workspace-clair-cheongdam',
  '92000000-0000-4000-8000-000000000222',
  'PR022 synthetic line',
  1,
  1000,
  0
);

insert into public.payments (
  id,
  workspace_id,
  invoice_id,
  payment_method,
  amount,
  status
) values (
  '92000000-0000-4000-8000-000000000224',
  'workspace-clair-cheongdam',
  '92000000-0000-4000-8000-000000000222',
  'card',
  500,
  'approved'
);

insert into public.invoice_adjustments (
  id,
  workspace_id,
  invoice_line_id,
  adjustment_type,
  amount,
  reason,
  created_by_user_id
) values (
  '92000000-0000-4000-8000-000000000225',
  'workspace-clair-cheongdam',
  '92000000-0000-4000-8000-000000000223',
  'surcharge',
  100,
  'PR022 synthetic line-linked adjustment',
  '49110000-0000-4000-8000-000000000003'
);

do $financial_trigger_contract$
begin
  if (
    select count(*)
    from realtime.messages message
    where message.topic = private.clair_chart_billing_realtime_topic(
        'workspace-clair-cheongdam',
        '92000000-0000-4000-8000-000000000221'
      )
      and message.extension = 'broadcast'
      and message.event = 'billing_summary_changed'
      and message.private
  ) < 4 then
    raise exception 'financial_realtime_events_missing';
  end if;
  raise notice 'chart_order_billing_summary_realtime_financial_triggers_ok';
end;
$financial_trigger_contract$;

select private.clair_broadcast_chart_billing_summary_changed(
  'workspace-clair-cheongdam',
  '449d09b4-945a-4f1f-97a9-418f6d845e50',
  '"1111111111111111111111111111111111111111111111111111111111111111"',
  'pr022-contract-allowed'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'realtime.topic',
  'workspace:workspace-clair-cheongdam:encounter:449d09b4-945a-4f1f-97a9-418f6d845e50:billing-summary',
  true
);

do $allowed_policy_contract$
begin
  if not exists (
    select 1
    from realtime.messages message
    where message.extension = 'broadcast'
      and message.event = 'billing_summary_changed'
      and message.payload ->> 'transactionId' = 'pr022-contract-allowed'
  ) then
    raise exception 'authorized_realtime_message_hidden';
  end if;
  raise notice 'chart_order_billing_summary_realtime_authorized_receive_ok';
end;
$allowed_policy_contract$;

reset role;

insert into public.workspace_permission_roles (
  id,
  workspace_id,
  role_key,
  label,
  role_type,
  permissions,
  is_system,
  is_assignable,
  sort_order,
  created_by_user_id
) values (
  '92000000-0000-4000-8000-000000000022',
  'workspace-clair-cheongdam',
  'pr022_without_chart_view',
  'PR022 without chart view',
  'custom',
  '{"allowed":["chart:update"]}'::jsonb,
  false,
  true,
  922,
  '49110000-0000-4000-8000-000000000001'
);

insert into public.workspace_membership_permission_role_assignments (
  membership_id,
  workspace_id,
  permission_role_id,
  assigned_by_user_id
)
select
  membership.id,
  membership.workspace_id,
  '92000000-0000-4000-8000-000000000022',
  '49110000-0000-4000-8000-000000000001'
from public.user_memberships membership
where membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003'
on conflict (membership_id) do update
set permission_role_id = excluded.permission_role_id,
    assigned_by_user_id = excluded.assigned_by_user_id,
    updated_at = now();

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'realtime.topic',
  'workspace:workspace-clair-cheongdam:encounter:449d09b4-945a-4f1f-97a9-418f6d845e50:billing-summary',
  true
);

do $denied_policy_contract$
begin
  if exists (
    select 1
    from realtime.messages message
    where message.extension = 'broadcast'
      and message.event = 'billing_summary_changed'
      and message.payload ->> 'transactionId' = 'pr022-contract-allowed'
  ) then
    raise exception 'missing_chart_view_received_realtime_message';
  end if;
  raise notice 'chart_order_billing_summary_realtime_permission_denial_ok';
end;
$denied_policy_contract$;

reset role;

select private.clair_broadcast_chart_billing_summary_changed(
  'workspace-phase5-other',
  '92000000-0000-4000-8000-000000000226',
  null,
  'pr022-contract-cross-workspace'
);
select private.clair_broadcast_chart_billing_summary_changed(
  'workspace-clair-cheongdam',
  '92000000-0000-4000-8000-000000000227',
  null,
  'pr022-contract-inactive-member'
);

select set_config('clair.membership_status_rpc', 'on', true);
update public.user_memberships
set status = 'inactive', updated_at = now()
where workspace_id = 'workspace-clair-cheongdam'
  and user_id = '49110000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'realtime.topic',
  'workspace:workspace-phase5-other:encounter:92000000-0000-4000-8000-000000000226:billing-summary',
  true
);

do $cross_workspace_policy_contract$
begin
  if exists (
    select 1
    from realtime.messages message
    where message.extension = 'broadcast'
      and message.event = 'billing_summary_changed'
      and message.payload ->> 'transactionId' = 'pr022-contract-cross-workspace'
  ) then
    raise exception 'cross_workspace_received_realtime_message';
  end if;
  raise notice 'chart_order_billing_summary_realtime_cross_workspace_denial_ok';
end;
$cross_workspace_policy_contract$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'realtime.topic',
  'workspace:workspace-clair-cheongdam:encounter:92000000-0000-4000-8000-000000000227:billing-summary',
  true
);

do $inactive_member_policy_contract$
begin
  if exists (
    select 1
    from realtime.messages message
    where message.extension = 'broadcast'
      and message.event = 'billing_summary_changed'
      and message.payload ->> 'transactionId' = 'pr022-contract-inactive-member'
  ) then
    raise exception 'inactive_member_received_realtime_message';
  end if;
  raise notice 'chart_order_billing_summary_realtime_inactive_member_denial_ok';
end;
$inactive_member_policy_contract$;

rollback;

do $rollback_contract$
declare
  v_trigger_name text;
begin
  if to_regprocedure(
    'private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text)'
  ) is not null
    or to_regprocedure(
      'private.clair_chart_billing_target_from_financial_row(text,jsonb)'
    ) is not null
    or exists (
      select 1 from pg_policy policy
      where policy.polname = 'clair_chart_billing_summary_realtime_receive'
        and policy.polrelid = 'realtime.messages'::regclass
    )
  then
    raise exception 'realtime_rollback_residual_object';
  end if;

  foreach v_trigger_name in array array[
    'clair_invoices_billing_summary_realtime',
    'clair_invoice_lines_billing_summary_realtime',
    'clair_payments_billing_summary_realtime',
    'clair_invoice_adjustments_billing_summary_realtime'
  ]
  loop
    if exists (
      select 1 from pg_trigger trigger_row
      where trigger_row.tgname = v_trigger_name
        and not trigger_row.tgisinternal
    ) then
      raise exception 'realtime_rollback_residual_trigger:%', v_trigger_name;
    end if;
  end loop;

  if to_regprocedure(
    'public.clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)'
  ) is not null
    or to_regprocedure(
      'public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)'
    ) is not null
    or to_regprocedure(
      'public.clair_mutate_chart_order_execution_billing_summary_base(text,uuid,uuid,text,text,integer,jsonb,text)'
    ) is not null
  then
    raise exception 'realtime_rollback_residual_base_function';
  end if;

  raise notice 'chart_order_billing_summary_realtime_rollback_zero_residual_ok';
end;
$rollback_contract$;
