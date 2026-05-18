create or replace function public.clair_list_workspace_member_statuses(
  p_workspace_id text
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

  -- Full status read is currently a hospital-admin surface; equivalent to role_permission:view for membership admin UI.
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
              'displayName', users.display_name,
              'email', users.email::text,
              'roles', to_jsonb(membership.roles),
              'status', membership.status,
              'title', membership.title,
              'department', membership.department,
              'createdAt', membership.created_at,
              'activatedAt', membership.activated_at,
              'deactivatedAt', membership.deactivated_at
            )
            order by users.email
          )
          from public.user_memberships membership
          join public.users users on users.id = membership.user_id
          where membership.workspace_id = p_workspace_id
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

revoke all on function public.clair_list_workspace_member_statuses(text) from public, anon;
grant execute on function public.clair_list_workspace_member_statuses(text) to authenticated;
