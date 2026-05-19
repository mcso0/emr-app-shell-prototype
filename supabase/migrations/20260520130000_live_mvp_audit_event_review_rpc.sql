create or replace function public.clair_list_audit_events(
  p_workspace_id text,
  p_event_type text default null,
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'role_permission:view required';
  end if;

  return jsonb_build_object(
    'events',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', event.id,
              'workspaceId', event.workspace_id,
              'actorUserId', event.actor_user_id::text,
              'actorMembershipId', event.actor_membership_id::text,
              'eventType', event.event_type,
              'targetType', event.target_type,
              'targetId', event.target_id,
              'encounterId', event.encounter_id::text,
              'patientId', event.patient_id::text,
              'guardianId', event.guardian_id::text,
              'requestId', event.request_id,
              'reason', event.reason,
              'before', event.before_snapshot,
              'after', event.after_snapshot,
              'metadata', event.metadata,
              'occurredAt', event.occurred_at,
              'createdAt', event.created_at
            )
            order by event.occurred_at desc, event.id desc
          )
          from (
            select *
            from public.audit_events audit_event
            where audit_event.workspace_id = p_workspace_id
              and (p_event_type is null or audit_event.event_type = p_event_type)
              and (
                v_query is null
                or audit_event.event_type ilike '%' || v_query || '%'
                or audit_event.target_type ilike '%' || v_query || '%'
                or audit_event.target_id ilike '%' || v_query || '%'
                or audit_event.actor_user_id::text ilike '%' || v_query || '%'
                or audit_event.encounter_id::text ilike '%' || v_query || '%'
              )
            order by audit_event.occurred_at desc, audit_event.id desc
            limit v_limit
          ) event
        ),
        '[]'::jsonb
      )
  );
end;
$$;

revoke all on function public.clair_list_audit_events(text, text, text, integer) from public, anon;
grant execute on function public.clair_list_audit_events(text, text, text, integer) to authenticated;

comment on function public.clair_list_audit_events(text, text, text, integer) is
  'Hospital-admin-only audit review reader for the local-first MVP review surface. Returns workspace-scoped safe audit summaries only.';
