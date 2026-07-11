-- Workspace membership archive lifecycle.
-- The record remains auditable and can be restored to inactive access.

alter table public.user_memberships
  drop constraint if exists user_memberships_status_check;

alter table public.user_memberships
  add constraint user_memberships_status_check
  check (status in ('pending', 'active', 'inactive', 'soft_deleted'));

alter table public.user_memberships
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists deleted_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id uuid references public.users(id) on delete set null;

create index if not exists user_memberships_workspace_deleted_at_idx
  on public.user_memberships (workspace_id, deleted_at desc)
  where status = 'soft_deleted';

-- Existing membership trigger protection raises last_active_workspace_owner_protected
-- before an archive operation can remove the final active owner.

create or replace function private.clair_membership_mutation_json(
  p_membership public.user_memberships
)
returns jsonb
language sql
stable
set search_path = public, private, extensions
as $$
  select jsonb_build_object(
    'id', p_membership.id::text,
    'workspaceId', p_membership.workspace_id,
    'userSessionId', p_membership.user_id::text,
    'roles', to_jsonb(p_membership.roles),
    'status', p_membership.status,
    'title', p_membership.title,
    'department', p_membership.department,
    'createdAt', p_membership.created_at,
    'activatedAt', p_membership.activated_at,
    'deactivatedAt', p_membership.deactivated_at,
    'deletedAt', p_membership.deleted_at,
    'deletedByUserId', p_membership.deleted_by_user_id::text,
    'deletedReason', p_membership.deleted_reason,
    'restoredAt', p_membership.restored_at,
    'restoredByUserId', p_membership.restored_by_user_id::text
  );
$$;

create or replace function private.archive_workspace_membership(
  p_workspace_id text,
  p_membership_id uuid,
  p_action text,
  p_deleted_reason text default null
)
returns public.user_memberships
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_membership public.user_memberships%rowtype;
  v_reason text := nullif(btrim(coalesce(p_deleted_reason, '')), '');
begin
  select *
    into v_membership
    from public.user_memberships
   where workspace_id = p_workspace_id
     and id = p_membership_id
   for update;

  if v_membership.id is null then
    raise exception 'workspace_membership_missing';
  end if;

  if v_membership.user_id = auth.uid() then
    raise exception 'self_action_protected';
  end if;

  if p_action = 'soft_delete' then
    if v_reason is null then
      raise exception 'invalid_deleted_reason';
    end if;

    if v_membership.status not in ('active', 'inactive') then
      raise exception 'membership_not_archivable';
    end if;

    update public.user_memberships
       set status = 'soft_deleted',
           deactivated_at = coalesce(v_membership.deactivated_at, now()),
           deleted_at = now(),
           deleted_by_user_id = auth.uid(),
           deleted_reason = v_reason,
           restored_at = null,
           restored_by_user_id = null
     where id = v_membership.id
     returning * into v_membership;
  elsif p_action = 'restore' then
    if v_membership.status <> 'soft_deleted' then
      raise exception 'membership_not_restorable';
    end if;

    update public.user_memberships
       set status = 'inactive',
           restored_at = now(),
           restored_by_user_id = auth.uid()
     where id = v_membership.id
     returning * into v_membership;
  else
    raise exception 'invalid_archive_action';
  end if;

  return v_membership;
end;
$$;

create or replace function public.clair_archive_workspace_membership(
  p_workspace_id text,
  p_membership_id uuid,
  p_action text,
  p_deleted_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_membership public.user_memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:manage required';
  end if;

  v_membership := private.archive_workspace_membership(
    p_workspace_id,
    p_membership_id,
    p_action,
    p_deleted_reason
  );

  return private.clair_membership_mutation_json(v_membership);
end;
$$;

revoke all on function private.archive_workspace_membership(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.clair_archive_workspace_membership(text, uuid, text, text)
  from public, anon;
grant execute on function public.clair_archive_workspace_membership(text, uuid, text, text)
  to authenticated;

drop function if exists public.clair_list_workspace_member_statuses(text);

create function public.clair_list_workspace_member_statuses(
  p_workspace_id text,
  p_include_deleted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:view required';
  end if;

  return jsonb_build_object(
    'memberships',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', membership.id::text,
              'workspaceId', membership.workspace_id,
              'userSessionId', membership.user_id::text,
              'displayName', app_user.display_name,
              'email', app_user.email::text,
              'roles', to_jsonb(membership.roles),
              'permissionRoleKey', permission_role.role_key,
              'jobPositionKey', job_position.position_key,
              'status', membership.status,
              'title', membership.title,
              'department', membership.department,
              'createdAt', membership.created_at,
              'activatedAt', membership.activated_at,
              'deactivatedAt', membership.deactivated_at,
              'deletedAt', membership.deleted_at,
              'deletedByUserId', membership.deleted_by_user_id::text,
              'deletedReason', membership.deleted_reason,
              'restoredAt', membership.restored_at,
              'restoredByUserId', membership.restored_by_user_id::text,
              'lastLoginAt', auth_user.last_sign_in_at
            )
            order by app_user.email
          )
          from public.user_memberships membership
          join public.users app_user on app_user.id = membership.user_id
          left join auth.users auth_user on auth_user.id = membership.user_id
          left join public.workspace_membership_permission_role_assignments permission_assignment
            on permission_assignment.workspace_id = membership.workspace_id
            and permission_assignment.membership_id = membership.id
          left join public.workspace_permission_roles permission_role
            on permission_role.workspace_id = permission_assignment.workspace_id
            and permission_role.id = permission_assignment.permission_role_id
          left join public.workspace_membership_job_position_assignments job_assignment
            on job_assignment.workspace_id = membership.workspace_id
            and job_assignment.membership_id = membership.id
          left join public.workspace_job_positions job_position
            on job_position.workspace_id = job_assignment.workspace_id
            and job_position.id = job_assignment.job_position_id
          where membership.workspace_id = p_workspace_id
            and (p_include_deleted or membership.status <> 'soft_deleted')
        ),
        '[]'::jsonb
      ),
    'invitations',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', invitation.id::text,
              'workspaceId', invitation.workspace_id,
              'email', invitation.email::text,
              'invitedRoles', to_jsonb(invitation.invited_roles),
              'title', invitation.title,
              'department', invitation.department,
              'status', invitation.status,
              'invitedBySessionId', invitation.invited_by_user_id::text,
              'acceptedBySessionId', invitation.accepted_by_user_id::text,
              'expiresAt', invitation.expires_at,
              'acceptedAt', invitation.accepted_at,
              'canceledAt', invitation.canceled_at,
              'resentAt', invitation.resent_at,
              'resendCount', invitation.resend_count,
              'createdAt', invitation.created_at,
              'updatedAt', invitation.updated_at
            )
            order by invitation.email
          )
          from public.workspace_invitations invitation
          where invitation.workspace_id = p_workspace_id
        ),
        '[]'::jsonb
      )
  );
end;
$$;

revoke all on function public.clair_list_workspace_member_statuses(text, boolean) from public, anon;
grant execute on function public.clair_list_workspace_member_statuses(text, boolean) to authenticated;

alter table public.audit_events
  drop constraint if exists audit_events_event_type_check;

alter table public.audit_events
  add constraint audit_events_event_type_check check (event_type in (
    'workspace.created',
    'workspace.invitation_created',
    'workspace.invitation_resent',
    'workspace.invitation_canceled',
    'workspace.invitation_accepted',
    'workspace.membership_roles_changed',
    'workspace.membership_status_changed',
    'workspace.membership_soft_deleted',
    'workspace.membership_restored',
    'workspace.last_admin_change_blocked',
    'user.profile_updated',
    'reception.patient_guardian_registered',
    'reception.walk_in_created',
    'reception.appointment_created',
    'reception.appointment_checked_in',
    'reception.appointment_restored',
    'reception.encounter_cancelled',
    'reception.encounter_restored',
    'reception.encounter_updated',
    'reception.queue_status_changed',
    'chart.patient_called',
    'chart.consultation_started',
    'chart.consultation_returned_to_waiting',
    'chart.soap_saved',
    'chart.completed',
    'diagnosis.changed',
    'order.draft_changed',
    'order.confirmed',
    'order.billing_candidate_requested',
    'order.status_changed',
    'order_catalog.created',
    'order_catalog.updated',
    'order_catalog.paused',
    'billing.invoice_candidate_generated',
    'billing.invoice_line_changed',
    'billing.invoice_issued',
    'billing.payment_state_changed',
    'billing.refund_requested'
  ));

alter table if exists public.live_audit_events
  drop constraint if exists live_audit_events_event_type_check;

alter table if exists public.live_audit_events
  add constraint live_audit_events_event_type_check
  check (event_type = any(array[
    'auth.login',
    'workspace.membership_soft_deleted',
    'workspace.membership_restored',
    'chart.order_created',
    'chart.patient_called',
    'chart.consultation_started',
    'chart.consultation_returned_to_waiting',
    'chart.soap_saved',
    'chart.completed',
    'diagnosis.changed',
    'order.draft_changed',
    'order.confirmed',
    'order.billing_candidate_requested',
    'order.status_changed',
    'fulfillment.status_changed',
    'billing.invoice_created',
    'billing.payment_recorded',
    'billing.payment_state_changed',
    'customer.profile_updated',
    'reception.walk_in_created',
    'reception.appointment_created',
    'reception.appointment_checked_in',
    'reception.appointment_restored',
    'reception.encounter_cancelled',
    'reception.encounter_restored',
    'reception.encounter_updated',
    'reception.patient_guardian_registered'
  ]));

comment on function public.clair_archive_workspace_membership(text, uuid, text, text) is
  'Authorized membership archive/restore lifecycle. Restore returns inactive access.';
