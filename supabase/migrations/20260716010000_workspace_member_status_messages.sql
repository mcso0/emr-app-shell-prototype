-- RECEPTION-LIVE-PR-014: workspace-scoped, self-owned staff status messages.
-- Message content is readable only inside the active workspace. Audit evidence
-- records operation and lengths, never the message itself.

create table if not exists public.workspace_member_status_messages (
  workspace_id text not null,
  user_id uuid not null,
  status_message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_member_status_messages_membership_fkey
    foreign key (workspace_id, user_id)
    references public.user_memberships (workspace_id, user_id)
    on delete cascade,
  constraint workspace_member_status_messages_content_check check (
    status_message <> ''
    and status_message = btrim(status_message)
    and status_message = regexp_replace(
      status_message,
      '^[[:space:]]+|[[:space:]]+$',
      '',
      'g'
    )
    and char_length(status_message) <= 60
  )
);

comment on table public.workspace_member_status_messages is
  'Workspace-scoped status message. Active workspace members may read; only the owning active member may mutate.';

drop trigger if exists set_workspace_member_status_messages_updated_at
  on public.workspace_member_status_messages;
create trigger set_workspace_member_status_messages_updated_at
before update on public.workspace_member_status_messages
for each row execute function public.clair_set_updated_at();

alter table public.workspace_member_status_messages enable row level security;

revoke all on table public.workspace_member_status_messages from public, anon;
grant select, insert, update, delete
  on table public.workspace_member_status_messages to authenticated;

drop policy if exists workspace_member_status_messages_select_active_member
  on public.workspace_member_status_messages;
create policy workspace_member_status_messages_select_active_member
on public.workspace_member_status_messages
for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists workspace_member_status_messages_insert_self
  on public.workspace_member_status_messages;
create policy workspace_member_status_messages_insert_self
on public.workspace_member_status_messages
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
);

drop policy if exists workspace_member_status_messages_update_self
  on public.workspace_member_status_messages;
create policy workspace_member_status_messages_update_self
on public.workspace_member_status_messages
for update to authenticated
using (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
);

drop policy if exists workspace_member_status_messages_delete_self
  on public.workspace_member_status_messages;
create policy workspace_member_status_messages_delete_self
on public.workspace_member_status_messages
for delete to authenticated
using (
  user_id = (select auth.uid())
  and private.clair_is_active_workspace_member(workspace_id)
);

alter table public.audit_events
  drop constraint if exists audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check check (event_type in (
    'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
    'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
    'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_archived',
    'workspace.membership_deactivated','workspace.membership_reactivated','workspace.membership_restored',
    'workspace.permission_role_deactivated','workspace.permission_role_reactivated',
    'workspace.permission_role_created','workspace.permission_role_updated',
    'workspace.job_position_deactivated','workspace.job_position_reactivated',
    'workspace.last_admin_change_blocked','user.profile_updated','user.workspace_status_message_updated',
    'reception.patient_guardian_registered','reception.walk_in_created','reception.appointment_created',
    'reception.appointment_checked_in','reception.appointment_restored','reception.encounter_cancelled',
    'reception.encounter_restored','reception.encounter_updated','reception.queue_status_changed',
    'chart.patient_called','chart.consultation_started','chart.consultation_returned_to_waiting',
    'chart.soap_saved','chart.completed','diagnosis.changed','order.draft_changed','order.confirmed',
    'order.billing_candidate_requested','order.status_changed','order_catalog.created',
    'order_catalog.updated','order_catalog.paused','billing.invoice_candidate_generated',
    'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed',
    'billing.refund_requested','hospital.operating_hours_updated'
  ));

create or replace function public.clair_audit_workspace_status_message()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_workspace_id text := coalesce(new.workspace_id, old.workspace_id);
  v_target_user_id uuid := coalesce(new.user_id, old.user_id);
  v_actor_membership_id uuid;
begin
  select membership.id
    into v_actor_membership_id
    from public.user_memberships membership
   where membership.workspace_id = v_workspace_id
     and membership.user_id = auth.uid()
     and membership.status = 'active';

  perform public.clair_append_audit_event(
    'workspace-status-message-' || gen_random_uuid()::text,
    v_workspace_id,
    auth.uid(),
    v_actor_membership_id,
    'user.workspace_status_message_updated',
    'workspace_member_status_message',
    v_workspace_id || ':' || v_target_user_id::text,
    p_before_snapshot => jsonb_build_object(
      'present', tg_op <> 'INSERT',
      'length', case when tg_op = 'INSERT' then 0 else char_length(old.status_message) end
    ),
    p_after_snapshot => jsonb_build_object(
      'present', tg_op <> 'DELETE',
      'length', case when tg_op = 'DELETE' then 0 else char_length(new.status_message) end
    ),
    p_metadata => jsonb_build_object(
      'operation', lower(tg_op),
      'beforeLength', case when tg_op = 'INSERT' then 0 else char_length(old.status_message) end,
      'afterLength', case when tg_op = 'DELETE' then 0 else char_length(new.status_message) end
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.clair_audit_workspace_status_message()
  from public, anon, authenticated;

drop trigger if exists audit_workspace_member_status_messages
  on public.workspace_member_status_messages;
create trigger audit_workspace_member_status_messages
after insert or update or delete on public.workspace_member_status_messages
for each row execute function public.clair_audit_workspace_status_message();

create or replace function public.clair_set_my_workspace_status_message(
  p_workspace_id text,
  p_status_message text,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized text := nullif(regexp_replace(p_status_message, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_existing public.workspace_member_status_messages%rowtype;
  v_saved public.workspace_member_status_messages%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'workspace_membership_missing';
  end if;
  if v_normalized is not null and char_length(v_normalized) > 60 then
    raise exception using errcode = '22023', message = 'invalid_status_message';
  end if;

  select message.*
    into v_existing
    from public.workspace_member_status_messages message
   where message.workspace_id = p_workspace_id
     and message.user_id = v_user_id
   for update;

  if v_existing.workspace_id is null then
    if p_expected_updated_at is not null then
      raise exception using errcode = '40001', message = 'status_message_conflict';
    end if;
    if v_normalized is null then
      return jsonb_build_object('message', null, 'updatedAt', null);
    end if;
    begin
      insert into public.workspace_member_status_messages (
        workspace_id,
        user_id,
        status_message
      ) values (
        p_workspace_id,
        v_user_id,
        v_normalized
      ) returning * into v_saved;
    exception when unique_violation then
      raise exception using errcode = '40001', message = 'status_message_conflict';
    end;
  else
    if p_expected_updated_at is null or v_existing.updated_at <> p_expected_updated_at then
      raise exception using errcode = '40001', message = 'status_message_conflict';
    end if;
    if v_normalized is null then
      delete from public.workspace_member_status_messages message
       where message.workspace_id = p_workspace_id
         and message.user_id = v_user_id;
      return jsonb_build_object('message', null, 'updatedAt', null);
    end if;
    if v_existing.status_message = v_normalized then
      return jsonb_build_object(
        'message', v_existing.status_message,
        'updatedAt', v_existing.updated_at
      );
    end if;
    update public.workspace_member_status_messages message
       set status_message = v_normalized
     where message.workspace_id = p_workspace_id
       and message.user_id = v_user_id
    returning * into v_saved;
  end if;

  return jsonb_build_object(
    'message', v_saved.status_message,
    'updatedAt', v_saved.updated_at
  );
end;
$$;

revoke all on function public.clair_set_my_workspace_status_message(
  text,
  text,
  timestamptz
) from public, anon;
grant execute on function public.clair_set_my_workspace_status_message(
  text,
  text,
  timestamptz
) to authenticated;
