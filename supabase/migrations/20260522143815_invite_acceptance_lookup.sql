create or replace function public.clair_get_workspace_invitation_for_acceptance(
  p_workspace_id text,
  p_invitation_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_invitation public.workspace_invitations%rowtype;
  v_workspace public.workspaces%rowtype;
  v_email extensions.citext := lower(trim(p_email))::extensions.citext;
  v_status text;
begin
  if p_workspace_id is null or p_workspace_id = '' or p_invitation_id is null or v_email is null then
    return jsonb_build_object('status', 'missing');
  end if;

  select *
  into v_invitation
  from public.workspace_invitations
  where id = p_invitation_id
    and workspace_id = p_workspace_id
    and email = v_email;

  if v_invitation.id is null then
    return jsonb_build_object('status', 'missing');
  end if;

  select *
  into v_workspace
  from public.workspaces
  where id = v_invitation.workspace_id;

  if v_workspace.id is null then
    return jsonb_build_object('status', 'missing');
  end if;

  v_status := case
    when v_invitation.status = 'pending'
      and v_invitation.expires_at is not null
      and v_invitation.expires_at <= now()
      then 'expired'
    else v_invitation.status
  end;

  return jsonb_build_object(
    'status', v_status,
    'workspace', jsonb_build_object(
      'id', v_workspace.id,
      'displayName', v_workspace.display_name,
      'createdBySessionId', coalesce(v_workspace.created_by_user_id::text, ''),
      'createdAt', v_workspace.created_at
    ),
    'invitation', jsonb_build_object(
      'id', v_invitation.id::text,
      'workspaceId', v_invitation.workspace_id,
      'email', v_invitation.email,
      'invitedRoles', to_jsonb(v_invitation.invited_roles),
      'title', v_invitation.title,
      'department', v_invitation.department,
      'status', v_status,
      'invitedBySessionId', coalesce(v_invitation.invited_by_user_id::text, ''),
      'acceptedBySessionId', v_invitation.accepted_by_user_id::text,
      'expiresAt', v_invitation.expires_at,
      'acceptedAt', v_invitation.accepted_at,
      'canceledAt', v_invitation.canceled_at,
      'resentAt', v_invitation.resent_at,
      'resendCount', v_invitation.resend_count,
      'createdAt', v_invitation.created_at,
      'updatedAt', v_invitation.updated_at
    )
  );
end;
$$;

revoke all on function public.clair_get_workspace_invitation_for_acceptance(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.clair_get_workspace_invitation_for_acceptance(text, uuid, text)
  to anon, authenticated;

comment on function public.clair_get_workspace_invitation_for_acceptance(text, uuid, text) is
  'Returns minimal invitation acceptance metadata only when workspace id, invitation id, and invite email all match.';
