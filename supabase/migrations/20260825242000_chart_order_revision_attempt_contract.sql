-- Chart order execution Phase 5: immutable revisions, cancellation, confirmed
-- priority changes, billing-only correction, and linked re-request attempts.
-- This remains additive and keeps the deployed lifecycle RPC available.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.order_revisions
  add column if not exists change_type text,
  add column if not exists expected_revision_no integer,
  add column if not exists idempotency_key text,
  add column if not exists request_sha256 text,
  add column if not exists before_values jsonb,
  add column if not exists after_values jsonb,
  add column if not exists affected_tasks jsonb,
  add column if not exists billing_impact jsonb,
  add column if not exists result jsonb,
  add column if not exists completed_at timestamptz;

update public.order_revisions
set
  change_type = coalesce(change_type, 'legacy'),
  before_values = coalesce(before_values, '{}'::jsonb),
  after_values = coalesce(after_values, '{}'::jsonb),
  affected_tasks = coalesce(affected_tasks, '[]'::jsonb),
  billing_impact = coalesce(billing_impact, '{}'::jsonb)
where change_type is null
   or before_values is null
   or after_values is null
   or affected_tasks is null
   or billing_impact is null;

alter table public.order_revisions
  alter column change_type set default 'legacy',
  alter column change_type set not null,
  alter column before_values set default '{}'::jsonb,
  alter column before_values set not null,
  alter column after_values set default '{}'::jsonb,
  alter column after_values set not null,
  alter column affected_tasks set default '[]'::jsonb,
  alter column affected_tasks set not null,
  alter column billing_impact set default '{}'::jsonb,
  alter column billing_impact set not null;

alter table public.order_revisions
  add constraint order_revisions_change_type_check
    check (change_type in (
      'legacy','amendment','cancellation','priority_change',
      'billing_correction','re_request'
    )) not valid,
  add constraint order_revisions_execution_payload_check
    check (
      jsonb_typeof(before_values) = 'object'
      and jsonb_typeof(after_values) = 'object'
      and jsonb_typeof(affected_tasks) = 'array'
      and jsonb_typeof(billing_impact) = 'object'
      and (result is null or jsonb_typeof(result) = 'object')
    ) not valid,
  add constraint order_revisions_idempotency_shape_check
    check (
      idempotency_key is null
      or (
        length(btrim(idempotency_key)) between 8 and 160
        and request_sha256 ~ '^[0-9a-f]{64}$'
        and expected_revision_no >= 0
      )
    ) not valid,
  add constraint order_revisions_completion_check
    check (
      idempotency_key is null
      or (
        (result is null and completed_at is null)
        or (result is not null and completed_at is not null)
      )
    ) not valid;

alter table public.order_revisions
  validate constraint order_revisions_change_type_check,
  validate constraint order_revisions_execution_payload_check,
  validate constraint order_revisions_idempotency_shape_check,
  validate constraint order_revisions_completion_check;

create unique index if not exists order_revisions_idempotency_key
  on public.order_revisions(workspace_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists order_revisions_execution_revision_key
  on public.order_revisions(workspace_id, order_id, revision_no)
  where idempotency_key is not null;

-- First attempts without a destination complete at confirmation. A repeated
-- attempt always starts pending, including destinationless chart-owned work.
alter table public.order_tasks drop constraint if exists order_tasks_check1;
alter table public.order_tasks
  add constraint order_tasks_destinationless_attempt_check check (
    task_role = 'aggregate'
    or destination_module is not null
    or (attempt_no = 1 and status = 'complete')
    or (attempt_no > 1 and re_requested_from_task_id is not null)
  ) not valid;
alter table public.order_tasks
  validate constraint order_tasks_destinationless_attempt_check;

alter table public.order_execution_outbox
  drop constraint if exists order_execution_outbox_event_type_check;
alter table public.order_execution_outbox
  add column if not exists order_revision_id uuid,
  alter column confirmation_command_id drop not null;
alter table public.order_execution_outbox
  add constraint order_execution_outbox_event_type_check
    check (event_type in ('order.confirmed','order.execution_changed')) not valid;
alter table public.order_execution_outbox
  validate constraint order_execution_outbox_event_type_check;
alter table public.order_execution_outbox
  add constraint order_execution_outbox_revision_fkey
    foreign key (workspace_id, order_revision_id)
    references public.order_revisions(workspace_id, id)
    on delete restrict not valid,
  add constraint order_execution_outbox_origin_check
    check (
      (event_type = 'order.confirmed'
        and confirmation_command_id is not null
        and order_revision_id is null)
      or
      (event_type = 'order.execution_changed'
        and confirmation_command_id is null
        and order_revision_id is not null)
    ) not valid;
alter table public.order_execution_outbox
  validate constraint order_execution_outbox_revision_fkey,
  validate constraint order_execution_outbox_origin_check;

create or replace function private.clair_reject_confirmed_snapshot_overwrite()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if old.confirmed_snapshot <> '{}'::jsonb
    and new.confirmed_snapshot is distinct from old.confirmed_snapshot
    and not (
      old.revision_no = 0
      and new.revision_no = 1
      and old.order_confirmation_status in ('confirmed','billed')
      and new.order_confirmation_status = old.order_confirmation_status
    )
  then
    raise exception 'confirmed_snapshot_immutable' using errcode = '55000';
  end if;
  return new;
end;
$function$;

revoke all on function private.clair_reject_confirmed_snapshot_overwrite()
  from public, anon, authenticated, service_role;

drop trigger if exists orders_confirmed_snapshot_immutable_trg on public.orders;
create trigger orders_confirmed_snapshot_immutable_trg
before update of confirmed_snapshot on public.orders
for each row execute function private.clair_reject_confirmed_snapshot_overwrite();

drop policy if exists order_revisions_workspace_chart_select
  on public.order_revisions;
create policy order_revisions_workspace_chart_select
on public.order_revisions
for select
to authenticated
using (
  private.clair_is_active_workspace_member(workspace_id)
  and private.clair_current_user_has_workspace_permission(
    workspace_id,
    'chart:view'
  )
);

drop policy if exists order_revision_fields_workspace_chart_select
  on public.order_revision_fields;
create policy order_revision_fields_workspace_chart_select
on public.order_revision_fields
for select
to authenticated
using (
  private.clair_is_active_workspace_member(workspace_id)
  and private.clair_current_user_has_workspace_permission(
    workspace_id,
    'chart:view'
  )
  and exists (
    select 1 from public.order_revisions revision
    where revision.workspace_id = order_revision_fields.workspace_id
      and revision.id = order_revision_fields.order_revision_id
  )
);

revoke all on public.order_revisions, public.order_revision_fields
  from public, anon, authenticated;
grant select on public.order_revisions, public.order_revision_fields
  to authenticated;

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
  v_now timestamptz := now();
  v_action text := btrim(coalesce(p_action, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_changes jsonb := coalesce(p_changes, '{}'::jsonb);
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request_sha256 text;
  v_existing public.order_revisions%rowtype;
  v_revision public.order_revisions%rowtype;
  v_order public.orders%rowtype;
  v_task public.order_tasks%rowtype;
  v_old_task public.order_tasks%rowtype;
  v_new_task public.order_tasks%rowtype;
  v_old_aggregate public.order_tasks%rowtype;
  v_new_aggregate public.order_tasks%rowtype;
  v_child_order public.orders%rowtype;
  v_candidate public.order_billing_candidates%rowtype;
  v_old_candidate public.order_billing_candidates%rowtype;
  v_actor_membership_id uuid;
  v_next_revision integer;
  v_next_attempt integer;
  v_detail_inputs jsonb;
  v_detail_schema_version integer;
  v_priority text;
  v_billing_name text;
  v_billing_quantity numeric;
  v_billing_unit_price numeric;
  v_affected_tasks jsonb := '[]'::jsonb;
  v_billing_impact jsonb := '{}'::jsonb;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_changed_count integer := 0;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if v_action not in (
    'amend','cancel','priority_change','billing_correct','re_request'
  )
    or jsonb_typeof(v_changes) <> 'object'
    or length(v_reason) not between 3 and 500
    or p_expected_revision_no is null
    or p_expected_revision_no < 0
    or length(v_idempotency_key) not between 8 and 160
  then
    raise exception 'invalid_execution_mutation_input';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      case when v_action = 'billing_correct'
        then 'billing:issue' else 'order:update' end
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  v_request_sha256 := encode(
    extensions.digest(
      jsonb_build_object(
        'workspaceId', p_workspace_id,
        'actorUserId', p_actor_user_id,
        'orderId', p_order_id,
        'action', v_action,
        'reason', v_reason,
        'expectedRevisionNo', p_expected_revision_no,
        'changes', v_changes
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'chart_order_execution_mutation:' || p_workspace_id || ':' ||
      v_idempotency_key,
      0
    )
  );

  select * into v_existing
  from public.order_revisions revision
  where revision.workspace_id = p_workspace_id
    and revision.idempotency_key = v_idempotency_key
  for update;
  if found then
    if v_existing.request_sha256 is distinct from v_request_sha256
      or v_existing.order_id is distinct from p_order_id
      or v_existing.expected_revision_no is distinct from p_expected_revision_no
    then
      raise exception 'idempotency_conflict';
    end if;
    if v_existing.result is not null then return v_existing.result; end if;
    raise exception 'execution_mutation_in_progress';
  end if;

  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id
  for update;
  if not found
    or v_order.order_confirmation_status not in ('confirmed','billed')
    or v_order.status = 'cancelled'
  then
    raise exception 'order_unavailable';
  end if;
  if v_order.row_type = 'set_child' then
    raise exception 'set_child_independent_mutation_forbidden';
  end if;
  if v_order.revision_no is distinct from p_expected_revision_no then
    raise exception 'revision_conflict';
  end if;

  if v_action in ('amend','priority_change','billing_correct')
    and v_order.row_type <> 'individual'
  then
    raise exception 'aggregate_direct_mutation_forbidden';
  end if;

  v_next_revision := v_order.revision_no + 1;
  v_before := jsonb_build_object(
    'orderStatus', v_order.status,
    'confirmationStatus', v_order.order_confirmation_status,
    'revisionNo', v_order.revision_no,
    'detailInputs', v_order.detail_inputs,
    'detailSchemaVersion', v_order.detail_schema_version,
    'priority', case when v_order.priority = 'urgent' then 'urgent' else 'normal' end,
    'confirmedSnapshot', v_order.confirmed_snapshot
  );

  insert into public.order_revisions(
    workspace_id, order_id, revision_no, reason, created_by_user_id,
    change_type, expected_revision_no, idempotency_key, request_sha256,
    before_values, after_values, affected_tasks, billing_impact,
    result, completed_at, created_at
  ) values (
    p_workspace_id, p_order_id, v_next_revision, v_reason, p_actor_user_id,
    case v_action
      when 'amend' then 'amendment'
      when 'cancel' then 'cancellation'
      when 'priority_change' then 'priority_change'
      when 'billing_correct' then 'billing_correction'
      else 're_request'
    end,
    p_expected_revision_no, v_idempotency_key, v_request_sha256,
    v_before, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb,
    null, null, v_now
  ) returning * into v_revision;

  if v_action = 'amend' then
    if exists (
      select 1 from jsonb_object_keys(v_changes) field(key)
      where field.key not in ('detailInputs','detailSchemaVersion')
    ) then
      raise exception 'invalid_amendment_fields';
    end if;
    select * into v_task
    from public.order_tasks task
    where task.workspace_id = p_workspace_id
      and task.order_id = p_order_id
      and task.task_role = 'execution'
    order by task.attempt_no desc
    limit 1
    for update;
    if not found then raise exception 'task_unavailable'; end if;
    if v_task.status <> 'pending' then raise exception 'amendment_requires_pending'; end if;

    v_detail_inputs := coalesce(v_changes -> 'detailInputs', v_order.detail_inputs);
    v_detail_schema_version := coalesce(
      (v_changes ->> 'detailSchemaVersion')::integer,
      v_order.detail_schema_version
    );
    if not private.clair_order_detail_inputs_are_valid(
      v_order.clinical_order_type,
      v_detail_schema_version,
      v_detail_inputs,
      true
    ) then
      raise exception 'confirmation_detail_inputs_incomplete';
    end if;

    update public.orders orders
    set
      detail_inputs = v_detail_inputs,
      detail_schema_version = v_detail_schema_version,
      revision_no = v_next_revision,
      updated_at = v_now
    where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

    update public.order_tasks task
    set
      effective_snapshot = task.effective_snapshot || jsonb_build_object(
        'detailInputs', v_detail_inputs,
        'detailSchemaVersion', v_detail_schema_version,
        'revisionNo', v_next_revision,
        'amendedAt', v_now
      ),
      updated_at = v_now
    where task.workspace_id = p_workspace_id and task.id = v_task.id
    returning * into v_new_task;

    update public.order_fulfillment_work_items item
    set source_snapshot = v_new_task.effective_snapshot, updated_at = v_now
    where item.workspace_id = p_workspace_id and item.task_id = v_task.id;

    insert into public.order_task_events(
      workspace_id, task_id, task_attempt_no, order_id, event_type,
      actor_user_id, reason, before_values, after_values, created_at
    ) values (
      p_workspace_id, v_task.id, v_task.attempt_no, p_order_id, 'amended',
      p_actor_user_id, v_reason,
      jsonb_build_object('effectiveSnapshot', v_task.effective_snapshot),
      jsonb_build_object(
        'effectiveSnapshot', v_new_task.effective_snapshot,
        'orderRevisionId', v_revision.id
      ),
      v_now
    );
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values
      (p_workspace_id, v_revision.id, 'detailInputs',
       v_order.detail_inputs, v_detail_inputs),
      (p_workspace_id, v_revision.id, 'detailSchemaVersion',
       to_jsonb(v_order.detail_schema_version), to_jsonb(v_detail_schema_version));
    v_affected_tasks := jsonb_build_array(jsonb_build_object(
      'taskId', v_task.id,
      'attemptNo', v_task.attempt_no,
      'effect', 'effective_snapshot_amended'
    ));

  elsif v_action = 'priority_change' then
    if exists (
      select 1 from jsonb_object_keys(v_changes) field(key)
      where field.key <> 'priority'
    ) then
      raise exception 'invalid_priority_fields';
    end if;
    v_priority := v_changes ->> 'priority';
    if v_priority not in ('normal','urgent')
      or v_priority = (
        case when v_order.priority = 'urgent' then 'urgent' else 'normal' end
      )
    then
      raise exception 'invalid_priority_change';
    end if;
    select * into v_task
    from public.order_tasks task
    where task.workspace_id = p_workspace_id
      and task.order_id = p_order_id
      and task.task_role = 'execution'
    order by task.attempt_no desc
    limit 1
    for update;
    if not found then raise exception 'task_unavailable'; end if;

    update public.orders orders
    set priority = v_priority, revision_no = v_next_revision, updated_at = v_now
    where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

    if v_task.status not in ('complete','cancelled') then
      update public.order_tasks task
      set
        priority = v_priority,
        effective_snapshot = task.effective_snapshot || jsonb_build_object(
          'priority', v_priority,
          'revisionNo', v_next_revision,
          'priorityChangedAt', v_now
        ),
        updated_at = v_now
      where task.workspace_id = p_workspace_id and task.id = v_task.id
      returning * into v_new_task;
      update public.order_fulfillment_work_items item
      set
        priority = v_priority,
        source_snapshot = v_new_task.effective_snapshot,
        updated_at = v_now
      where item.workspace_id = p_workspace_id and item.task_id = v_task.id;
    else
      v_new_task := v_task;
    end if;

    insert into public.order_task_events(
      workspace_id, task_id, task_attempt_no, order_id, event_type,
      actor_user_id, reason, before_values, after_values, created_at
    ) values (
      p_workspace_id, v_task.id, v_task.attempt_no, p_order_id,
      'priority_changed', p_actor_user_id, v_reason,
      jsonb_build_object('orderPriority', v_order.priority, 'taskPriority', v_task.priority),
      jsonb_build_object(
        'orderPriority', v_priority,
        'taskPriority', v_new_task.priority,
        'terminalTaskPreserved', v_task.status in ('complete','cancelled'),
        'orderRevisionId', v_revision.id
      ),
      v_now
    );
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values (
      p_workspace_id, v_revision.id, 'priority',
      to_jsonb(v_order.priority), to_jsonb(v_priority)
    );
    v_affected_tasks := jsonb_build_array(jsonb_build_object(
      'taskId', v_task.id,
      'attemptNo', v_task.attempt_no,
      'effect', case when v_task.status in ('complete','cancelled')
        then 'terminal_attempt_preserved' else 'priority_changed' end
    ));

  elsif v_action = 'billing_correct' then
    if exists (
      select 1 from jsonb_object_keys(v_changes) field(key)
      where field.key not in ('billingName','quantity','unitPrice')
    ) then
      raise exception 'invalid_billing_correction_fields';
    end if;
    select * into v_candidate
    from public.order_billing_candidates candidate
    where candidate.workspace_id = p_workspace_id
      and candidate.order_id = p_order_id
    for update;
    if not found then raise exception 'billing_candidate_unavailable'; end if;
    if v_candidate.status <> 'candidate_created' then
      raise exception 'billing_candidate_locked';
    end if;
    v_old_candidate := v_candidate;
    v_billing_name := coalesce(
      nullif(btrim(v_changes ->> 'billingName'), ''),
      v_candidate.billing_name_snapshot
    );
    v_billing_quantity := coalesce(
      (v_changes ->> 'quantity')::numeric,
      v_candidate.quantity
    );
    v_billing_unit_price := coalesce(
      (v_changes ->> 'unitPrice')::numeric,
      v_candidate.unit_price
    );
    if length(v_billing_name) = 0
      or v_billing_quantity <= 0
      or v_billing_unit_price < 0
      or v_billing_quantity * v_billing_unit_price <= 0
    then
      raise exception 'invalid_billing_correction';
    end if;

    update public.order_billing_candidates candidate
    set
      billing_name_snapshot = v_billing_name,
      quantity = v_billing_quantity,
      unit_price = v_billing_unit_price,
      amount = v_billing_quantity * v_billing_unit_price,
      source_snapshot = candidate.source_snapshot || jsonb_build_object(
        'billingCorrectionRevisionId', v_revision.id,
        'billingCorrectionAt', v_now
      ),
      updated_at = v_now
    where candidate.workspace_id = p_workspace_id
      and candidate.id = v_candidate.id
    returning * into v_candidate;

    update public.orders orders
    set revision_no = v_next_revision, updated_at = v_now
    where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

    select * into v_task
    from public.order_tasks task
    where task.workspace_id = p_workspace_id and task.order_id = p_order_id
    order by task.attempt_no desc
    limit 1;
    if found then
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, reason, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_task.id, v_task.attempt_no, p_order_id, 'amended',
        p_actor_user_id, v_reason,
        jsonb_build_object(
          'billingName', v_old_candidate.billing_name_snapshot,
          'quantity', v_old_candidate.quantity,
          'unitPrice', v_old_candidate.unit_price,
          'amount', v_old_candidate.amount
        ),
        jsonb_build_object(
          'billingCandidateId', v_candidate.id,
          'billingName', v_candidate.billing_name_snapshot,
          'quantity', v_candidate.quantity,
          'unitPrice', v_candidate.unit_price,
          'amount', v_candidate.amount,
          'billingOnly', true,
          'orderRevisionId', v_revision.id
        ),
        v_now
      );
      v_affected_tasks := jsonb_build_array(jsonb_build_object(
        'taskId', v_task.id,
        'attemptNo', v_task.attempt_no,
        'effect', 'execution_attempt_not_reopened'
      ));
    end if;
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values (
      p_workspace_id, v_revision.id, 'billingCandidate',
      jsonb_build_object(
        'billingName', v_old_candidate.billing_name_snapshot,
        'quantity', v_old_candidate.quantity,
        'unitPrice', v_old_candidate.unit_price,
        'amount', v_old_candidate.amount
      ),
      jsonb_build_object(
        'billingName', v_billing_name,
        'quantity', v_billing_quantity,
        'unitPrice', v_billing_unit_price,
        'amount', v_billing_quantity * v_billing_unit_price
      )
    );
    v_billing_impact := jsonb_build_object(
      'billingCandidateId', v_candidate.id,
      'status', v_candidate.status,
      'amount', v_candidate.amount,
      'executionReopened', false
    );

  elsif v_action = 'cancel' then
    if v_changes <> '{}'::jsonb then raise exception 'invalid_cancellation_fields'; end if;
    for v_task in
      select task.*
      from public.order_tasks task
      join (
        select current_task.order_id, max(current_task.attempt_no) attempt_no
        from public.order_tasks current_task
        join public.orders target_order
          on target_order.workspace_id = current_task.workspace_id
         and target_order.id = current_task.order_id
        where current_task.workspace_id = p_workspace_id
          and (
            target_order.id = p_order_id
            or target_order.parent_chart_order_line_id = p_order_id
          )
        group by current_task.order_id
      ) latest
        on latest.order_id = task.order_id
       and latest.attempt_no = task.attempt_no
      where task.workspace_id = p_workspace_id
      order by
        case when task.task_role = 'execution' then 0 else 1 end,
        task.order_id
      for update of task
    loop
      v_old_task := v_task;
      if v_task.status not in ('complete','cancelled') then
        update public.order_tasks current_task
        set status = 'cancelled', cancelled_at = v_now, updated_at = v_now
        where current_task.workspace_id = p_workspace_id
          and current_task.id = v_task.id
        returning * into v_task;
        update public.order_fulfillment_work_items item
        set
          status = 'cancelled',
          cancelled_at = v_now,
          reason = v_reason,
          updated_at = v_now
        where item.workspace_id = p_workspace_id
          and item.task_id = v_old_task.id
          and item.status not in ('completed','cancelled');
      end if;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, reason, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_old_task.id, v_old_task.attempt_no,
        v_old_task.order_id, 'cancelled', p_actor_user_id, v_reason,
        jsonb_build_object('status', v_old_task.status),
        jsonb_build_object(
          'status', v_task.status,
          'terminalAttemptPreserved', v_old_task.status in ('complete','cancelled'),
          'orderRevisionId', v_revision.id
        ),
        v_now
      );
      v_affected_tasks := v_affected_tasks || jsonb_build_array(jsonb_build_object(
        'taskId', v_old_task.id,
        'attemptNo', v_old_task.attempt_no,
        'beforeStatus', v_old_task.status,
        'afterStatus', v_task.status
      ));
    end loop;

    update public.order_billing_candidates candidate
    set status = 'cancelled', updated_at = v_now
    from public.orders target_order
    where candidate.workspace_id = p_workspace_id
      and target_order.workspace_id = candidate.workspace_id
      and target_order.id = candidate.order_id
      and (
        target_order.id = p_order_id
        or target_order.parent_chart_order_line_id = p_order_id
      )
      and candidate.status = 'candidate_created';
    get diagnostics v_changed_count = row_count;
    v_billing_impact := jsonb_build_object(
      'cancelledCandidateCount', v_changed_count,
      'invoiceLinkedCandidatesPreserved', (
        select count(*) from public.order_billing_candidates candidate
        join public.orders target_order
          on target_order.workspace_id = candidate.workspace_id
         and target_order.id = candidate.order_id
        where candidate.workspace_id = p_workspace_id
          and (
            target_order.id = p_order_id
            or target_order.parent_chart_order_line_id = p_order_id
          )
          and candidate.status = 'invoice_linked'
      )
    );

    update public.orders target_order
    set
      status = 'cancelled',
      order_confirmation_status = 'cancelled',
      cancellation_reason = v_reason,
      revision_no = case when target_order.id = p_order_id
        then v_next_revision else target_order.revision_no end,
      updated_at = v_now
    where target_order.workspace_id = p_workspace_id
      and (
        target_order.id = p_order_id
        or target_order.parent_chart_order_line_id = p_order_id
      );
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values (
      p_workspace_id, v_revision.id, 'orderConfirmationStatus',
      to_jsonb(v_order.order_confirmation_status), to_jsonb('cancelled'::text)
    );

  else
    if v_order.row_type = 'set' and v_changes <> '{}'::jsonb then
      raise exception 'invalid_set_re_request_fields';
    end if;
    if v_order.row_type = 'individual' and exists (
      select 1 from jsonb_object_keys(v_changes) field(key)
      where field.key not in ('detailInputs','detailSchemaVersion','priority')
    ) then
      raise exception 'invalid_re_request_fields';
    end if;

    if v_order.row_type = 'set' then
      select * into v_old_aggregate
      from public.order_tasks task
      where task.workspace_id = p_workspace_id
        and task.order_id = p_order_id
        and task.task_role = 'aggregate'
      order by task.attempt_no desc
      limit 1
      for update;
      if not found
        or v_old_aggregate.status not in (
          'in_progress','paused','partial_complete','complete'
        )
      then
        raise exception 're_request_transition_invalid';
      end if;
      v_next_attempt := v_old_aggregate.attempt_no + 1;

      for v_task in
        select task.*
        from public.order_tasks task
        join public.orders target_order
          on target_order.workspace_id = task.workspace_id
         and target_order.id = task.order_id
        where task.workspace_id = p_workspace_id
          and task.attempt_no = v_old_aggregate.attempt_no
          and (
            target_order.id = p_order_id
            or target_order.parent_chart_order_line_id = p_order_id
          )
        order by
          case when task.task_role = 'execution' then 0 else 1 end,
          task.order_id
        for update of task
      loop
        v_old_task := v_task;
        if v_task.status not in ('complete','cancelled') then
          update public.order_tasks current_task
          set status = 'cancelled', cancelled_at = v_now, updated_at = v_now
          where current_task.workspace_id = p_workspace_id
            and current_task.id = v_task.id
          returning * into v_task;
        end if;
        insert into public.order_task_events(
          workspace_id, task_id, task_attempt_no, order_id, event_type,
          actor_user_id, reason, before_values, after_values, created_at
        ) values (
          p_workspace_id, v_old_task.id, v_old_task.attempt_no,
          v_old_task.order_id, 're_requested', p_actor_user_id, v_reason,
          jsonb_build_object('status', v_old_task.status),
          jsonb_build_object(
            'status', v_task.status,
            'nextAttemptNo', v_next_attempt,
            'orderRevisionId', v_revision.id
          ),
          v_now
        );
      end loop;

      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, re_requested_from_task_id, effective_snapshot,
        created_by_user_id, created_at, updated_at
      ) values (
        p_workspace_id, v_order.encounter_id, p_order_id, 'aggregate',
        v_order.clinical_order_type, null, 'pending',
        case when v_order.priority = 'urgent' then 'urgent' else 'normal' end,
        v_next_attempt, v_old_aggregate.id,
        v_old_aggregate.effective_snapshot || jsonb_build_object(
          'revisionNo', v_next_revision,
          'reRequestedAt', v_now
        ),
        p_actor_user_id, v_now, v_now
      ) returning * into v_new_aggregate;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_new_aggregate.id, v_new_aggregate.attempt_no,
        p_order_id, 'created', p_actor_user_id, '{}'::jsonb,
        jsonb_build_object(
          'status', 'pending',
          'reRequestedFromTaskId', v_old_aggregate.id,
          'orderRevisionId', v_revision.id
        ),
        v_now
      );
      v_affected_tasks := jsonb_build_array(jsonb_build_object(
        'taskId', v_new_aggregate.id,
        'attemptNo', v_next_attempt,
        'effect', 'aggregate_attempt_created'
      ));

      for v_child_order in
        select child.* from public.orders child
        where child.workspace_id = p_workspace_id
          and child.parent_chart_order_line_id = p_order_id
          and child.row_type = 'set_child'
        order by child.id
        for update
      loop
        select * into v_old_task
        from public.order_tasks task
        where task.workspace_id = p_workspace_id
          and task.order_id = v_child_order.id
          and task.attempt_no = v_old_aggregate.attempt_no
        for update;
        if not found or v_old_task.status not in ('complete','cancelled') then
          raise exception 're_request_link_invalid';
        end if;
        insert into public.order_tasks(
          workspace_id, encounter_id, order_id, parent_task_id, task_role,
          clinical_order_type, destination_module, status, priority,
          attempt_no, re_requested_from_task_id, effective_snapshot,
          created_by_user_id, created_at, updated_at
        ) values (
          p_workspace_id, v_child_order.encounter_id, v_child_order.id,
          v_new_aggregate.id, 'execution', v_child_order.clinical_order_type,
          v_child_order.destination_module, 'pending', v_old_task.priority,
          v_next_attempt, v_old_task.id,
          v_old_task.effective_snapshot || jsonb_build_object(
            'revisionNo', v_next_revision,
            'reRequestedAt', v_now
          ),
          p_actor_user_id, v_now, v_now
        ) returning * into v_new_task;
        insert into public.order_task_events(
          workspace_id, task_id, task_attempt_no, order_id, event_type,
          actor_user_id, before_values, after_values, created_at
        ) values (
          p_workspace_id, v_new_task.id, v_new_task.attempt_no,
          v_child_order.id, 'created', p_actor_user_id, '{}'::jsonb,
          jsonb_build_object(
            'status', 'pending',
            'reRequestedFromTaskId', v_old_task.id,
            'orderRevisionId', v_revision.id
          ),
          v_now
        );
        if v_new_task.destination_module is not null then
          update public.order_fulfillment_work_items item
          set
            task_id = v_new_task.id,
            task_attempt_no = v_new_task.attempt_no,
            status = 'requested',
            priority = v_new_task.priority,
            requested_by_user_id = p_actor_user_id,
            assigned_to_user_id = null,
            completed_at = null,
            cancelled_at = null,
            returned_at = null,
            reason = v_reason,
            source_snapshot = v_new_task.effective_snapshot,
            updated_at = v_now
          where item.workspace_id = p_workspace_id
            and item.order_id = v_child_order.id;
        end if;
        v_affected_tasks := v_affected_tasks || jsonb_build_array(jsonb_build_object(
          'taskId', v_new_task.id,
          'attemptNo', v_next_attempt,
          'orderId', v_child_order.id,
          'effect', 'execution_attempt_created'
        ));
      end loop;

      update public.orders target_order
      set
        status = 'confirmed',
        task_status = 'pending',
        revision_no = case when target_order.id = p_order_id
          then v_next_revision else target_order.revision_no end,
        updated_at = v_now
      where target_order.workspace_id = p_workspace_id
        and (
          target_order.id = p_order_id
          or target_order.parent_chart_order_line_id = p_order_id
        );
    else
      select * into v_old_task
      from public.order_tasks task
      where task.workspace_id = p_workspace_id
        and task.order_id = p_order_id
        and task.task_role = 'execution'
      order by task.attempt_no desc
      limit 1
      for update;
      if not found
        or v_old_task.status not in ('in_progress','paused','complete')
      then
        raise exception 're_request_transition_invalid';
      end if;
      v_next_attempt := v_old_task.attempt_no + 1;
      v_detail_inputs := coalesce(v_changes -> 'detailInputs', v_order.detail_inputs);
      v_detail_schema_version := coalesce(
        (v_changes ->> 'detailSchemaVersion')::integer,
        v_order.detail_schema_version
      );
      v_priority := coalesce(
        v_changes ->> 'priority',
        case when v_order.priority = 'urgent' then 'urgent' else 'normal' end
      );
      if v_priority not in ('normal','urgent')
        or not private.clair_order_detail_inputs_are_valid(
          v_order.clinical_order_type,
          v_detail_schema_version,
          v_detail_inputs,
          true
        )
      then
        raise exception 'invalid_re_request_fields';
      end if;
      if v_old_task.status not in ('complete','cancelled') then
        update public.order_tasks task
        set status = 'cancelled', cancelled_at = v_now, updated_at = v_now
        where task.workspace_id = p_workspace_id and task.id = v_old_task.id;
      end if;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, reason, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_old_task.id, v_old_task.attempt_no, p_order_id,
        're_requested', p_actor_user_id, v_reason,
        jsonb_build_object('status', v_old_task.status),
        jsonb_build_object(
          'status', case when v_old_task.status = 'complete'
            then 'complete' else 'cancelled' end,
          'nextAttemptNo', v_next_attempt,
          'orderRevisionId', v_revision.id
        ),
        v_now
      );

      update public.orders orders
      set
        status = 'confirmed',
        task_status = 'pending',
        detail_inputs = v_detail_inputs,
        detail_schema_version = v_detail_schema_version,
        priority = v_priority,
        revision_no = v_next_revision,
        updated_at = v_now
      where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, re_requested_from_task_id, effective_snapshot,
        created_by_user_id, created_at, updated_at
      ) values (
        p_workspace_id, v_order.encounter_id, p_order_id, 'execution',
        v_order.clinical_order_type, v_order.destination_module, 'pending',
        v_priority, v_next_attempt, v_old_task.id,
        v_old_task.effective_snapshot || jsonb_build_object(
          'detailInputs', v_detail_inputs,
          'detailSchemaVersion', v_detail_schema_version,
          'priority', v_priority,
          'revisionNo', v_next_revision,
          'reRequestedAt', v_now
        ),
        p_actor_user_id, v_now, v_now
      ) returning * into v_new_task;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_new_task.id, v_new_task.attempt_no, p_order_id,
        'created', p_actor_user_id, '{}'::jsonb,
        jsonb_build_object(
          'status', 'pending',
          'reRequestedFromTaskId', v_old_task.id,
          'orderRevisionId', v_revision.id
        ),
        v_now
      );
      if v_new_task.destination_module is not null then
        update public.order_fulfillment_work_items item
        set
          task_id = v_new_task.id,
          task_attempt_no = v_new_task.attempt_no,
          status = 'requested',
          priority = v_new_task.priority,
          requested_by_user_id = p_actor_user_id,
          assigned_to_user_id = null,
          completed_at = null,
          cancelled_at = null,
          returned_at = null,
          reason = v_reason,
          source_snapshot = v_new_task.effective_snapshot,
          updated_at = v_now
        where item.workspace_id = p_workspace_id and item.order_id = p_order_id;
      end if;
      v_affected_tasks := jsonb_build_array(
        jsonb_build_object(
          'taskId', v_old_task.id,
          'attemptNo', v_old_task.attempt_no,
          'effect', 'original_attempt_preserved'
        ),
        jsonb_build_object(
          'taskId', v_new_task.id,
          'attemptNo', v_new_task.attempt_no,
          'effect', 'linked_attempt_created'
        )
      );
    end if;
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values (
      p_workspace_id, v_revision.id, 'taskAttempt',
      jsonb_build_object('attemptNo', coalesce(v_old_aggregate.attempt_no, v_old_task.attempt_no)),
      jsonb_build_object('attemptNo', v_next_attempt, 'status', 'pending')
    );
  end if;

  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id;
  v_after := jsonb_build_object(
    'orderStatus', v_order.status,
    'confirmationStatus', v_order.order_confirmation_status,
    'revisionNo', v_order.revision_no,
    'detailInputs', v_order.detail_inputs,
    'detailSchemaVersion', v_order.detail_schema_version,
    'priority', case when v_order.priority = 'urgent' then 'urgent' else 'normal' end,
    'confirmedSnapshot', v_order.confirmed_snapshot
  );

  insert into public.order_events(
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id,
    p_order_id,
    case when v_action = 'cancel' then 'cancelled' else 'edited' end,
    p_actor_user_id,
    jsonb_build_object(
      'action', v_action,
      'orderRevisionId', v_revision.id,
      'reason', v_reason,
      'before', v_before,
      'after', v_after,
      'affectedTasks', v_affected_tasks,
      'billingImpact', v_billing_impact
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

  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  ) values (
    'order-execution-revision-' || v_revision.id::text,
    p_workspace_id,
    p_actor_user_id,
    v_actor_membership_id,
    'order.status_changed',
    'order',
    p_order_id::text,
    v_order.encounter_id,
    v_revision.id::text,
    v_before,
    v_after,
    jsonb_build_object(
      'source', 'chart-order-revision-attempt-v1',
      'action', v_action,
      'reason', v_reason,
      'idempotencyKey', v_idempotency_key,
      'affectedTasks', v_affected_tasks,
      'billingImpact', v_billing_impact
    ),
    v_now,
    v_now
  );

  insert into public.order_execution_outbox(
    workspace_id, confirmation_command_id, order_revision_id,
    event_key, event_type,
    aggregate_type, aggregate_id, payload, created_at, updated_at
  ) values (
    p_workspace_id,
    null,
    v_revision.id,
    'order.execution_changed:' || v_revision.id::text,
    'order.execution_changed',
    'order',
    p_order_id,
    jsonb_build_object(
      'workspaceId', p_workspace_id,
      'encounterId', v_order.encounter_id,
      'orderId', p_order_id,
      'orderRevisionId', v_revision.id,
      'action', v_action,
      'affectedTasks', v_affected_tasks,
      'billingImpact', v_billing_impact
    ),
    v_now,
    v_now
  );

  v_result := jsonb_build_object(
    'orderRevisionId', v_revision.id,
    'revisionNo', v_order.revision_no,
    'action', v_action,
    'orderId', p_order_id,
    'confirmedSnapshotPreserved',
      v_order.confirmed_snapshot is not distinct from (v_before -> 'confirmedSnapshot'),
    'order', v_after,
    'affectedTasks', v_affected_tasks,
    'billingImpact', v_billing_impact
  );
  update public.order_revisions revision
  set
    after_values = v_after,
    affected_tasks = v_affected_tasks,
    billing_impact = v_billing_impact,
    result = v_result,
    completed_at = v_now
  where revision.workspace_id = p_workspace_id
    and revision.id = v_revision.id;
  return v_result;
end;
$function$;

revoke all on function public.clair_mutate_chart_order_execution(
  text, uuid, uuid, text, text, integer, jsonb, text
) from public, anon;
grant execute on function public.clair_mutate_chart_order_execution(
  text, uuid, uuid, text, text, integer, jsonb, text
) to authenticated;

comment on function public.clair_mutate_chart_order_execution(
  text, uuid, uuid, text, text, integer, jsonb, text
) is
  'Actor-bound, idempotent amendment/cancellation/priority/billing-correction/re-request transaction that preserves confirmed snapshots and completed results.';
