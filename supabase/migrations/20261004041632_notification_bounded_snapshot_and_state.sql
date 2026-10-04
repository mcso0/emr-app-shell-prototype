-- Additive notification API. Keep legacy readers/writers for application rollback.
-- Match the intersection of existing DB visibility and Next role-policy checks;
-- do not change the canonical permission resolver or PR895 event emitter.
create function private.clair_notification_visible_v2(p_event public.notification_events)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  select private.clair_notification_event_visible_to_actor(
    p_event.workspace_id, p_event.recipient_kind, p_event.recipient_id, p_event.domain)
  and exists (
    select 1 from public.user_memberships m
    join public.users u on u.id = m.user_id
    left join public.workspace_membership_permission_role_assignments a
      on a.workspace_id = m.workspace_id and a.membership_id = m.id
    left join public.workspace_permission_roles r
      on r.workspace_id = a.workspace_id and r.id = a.permission_role_id
      and r.role_type in ('owner', 'admin', 'standard', 'custom')
    cross join lateral (select case p_event.domain
      when 'billing' then 'billing:view' when 'reception' then 'reception:view'
      when 'lab' then 'lab:view' when 'imaging' then 'imaging:view'
      when 'dispensing_treatment' then 'dispensing:view'
      when 'chart' then 'chart:view' else null end as permission_id) required
    where m.workspace_id = p_event.workspace_id and m.user_id = auth.uid()
      and m.status = 'active' and u.status = 'active'
      and (m.roles @> array['hospital_admin']::text[] or required.permission_id is null
        or case when r.id is not null then
          coalesce(r.permissions -> 'allowed', '[]'::jsonb) ? '*'
          or coalesce(r.permissions -> 'allowed', '[]'::jsonb) ? required.permission_id
        else exists (
          select 1 from public.permission_policies p
          where p.workspace_id = m.workspace_id and p.scope = 'role'
            and p.target_role = any(m.roles)
            and (coalesce(p.permissions -> 'allowed', '[]'::jsonb) ? '*'
              or coalesce(p.permissions -> 'allowed', '[]'::jsonb) ? required.permission_id)
        ) end)
  );
$$;

create function private.clair_notification_validate_actor_v2(
  p_workspace_id text, p_actor_user_id uuid, p_state_scope_id text
) returns void language plpgsql stable security definer
set search_path = pg_catalog, public, private, pg_temp
as $$ begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing'; end if;
  if p_actor_user_id is null or p_actor_user_id <> auth.uid()
    or left(trim(coalesce(p_state_scope_id, '')), 180) <> p_actor_user_id::text then
    raise exception 'notification_actor_mismatch'; end if;
end; $$;

create function public.clair_read_notification_snapshot_v2(
  p_workspace_id text, p_actor_user_id uuid, p_state_scope_id text,
  p_event_scope_id text default null, p_filter text default 'all',
  p_limit integer default 20, p_notification_id text default null
) returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare v_result jsonb; v_limit integer;
begin
  perform private.clair_notification_validate_actor_v2(p_workspace_id, p_actor_user_id, p_state_scope_id);
  if p_filter is null or p_filter not in ('all','unread','important','archived','snapshot') then
    raise exception 'invalid_notification_event_payload'; end if;
  -- Zero is an internal count-only read; clients cannot request unbounded bodies.
  v_limit := greatest(0, least(coalesce(p_limit, 20), case when p_filter = 'snapshot' then 100 else 50 end));
  with visible as materialized (
    select e.id, e.notification_id, e.updated_at, e.badge_count, e.requires_action, s.read_at, s.archived_at
    from public.notification_events e
    left join public.notification_user_states s
      on s.workspace_id = e.workspace_id and s.actor_user_id = p_actor_user_id
      and s.state_scope_id = left(trim(p_state_scope_id), 180) and s.notification_id = e.notification_id
    where e.workspace_id = p_workspace_id
      and (e.event_scope_id = '' or (private.clair_notification_scope_id(p_event_scope_id) <> ''
        and e.event_scope_id = private.clair_notification_scope_id(p_event_scope_id)))
      and private.clair_notification_visible_v2(e)
  ), totals as (
    select jsonb_build_object(
      'badge', count(*) filter (where read_at is null and archived_at is null and badge_count),
      'unread', count(*) filter (where read_at is null and archived_at is null),
      'important', count(*) filter (where archived_at is null and requires_action),
      'archived', count(*) filter (where archived_at is not null)) as counts from visible
  ), filtered as (
    select * from visible where (p_notification_id is null or notification_id = p_notification_id)
      and case p_filter when 'snapshot' then true when 'archived' then archived_at is not null
        when 'unread' then archived_at is null and read_at is null
        when 'important' then archived_at is null and requires_action
        else archived_at is null end
  ), page as materialized (
    select * from filtered order by updated_at desc,
      notification_id collate "C", id limit v_limit
  )
  select jsonb_build_object('ok', true, 'status', 200, 'counts', totals.counts,
    'notifications', coalesce((select jsonb_agg(
      private.clair_notification_event_json(e) - array['read_state_key','archive_state_key','unread','archived']
      order by page.updated_at desc, page.notification_id collate "C", page.id) from page
      join public.notification_events e on e.id = page.id), '[]'::jsonb),
    'states', coalesce((select jsonb_agg(jsonb_build_object('notificationId', notification_id,
      'readAt', read_at, 'archivedAt', archived_at)) from page where read_at is not null or archived_at is not null), '[]'::jsonb),
    'nextCursor', case when p_notification_id is null and v_limit > 0 and (select count(*) from filtered) > v_limit
      then (select updated_at from page order by updated_at asc,
        notification_id collate "C" desc, id desc limit 1) else null end)
  into v_result from totals;
  return v_result;
end; $$;

create function public.clair_mutate_notification_user_state_v2(
  p_workspace_id text, p_actor_user_id uuid, p_state_scope_id text,
  p_action text, p_notification_id text default null, p_event_scope_id text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare v_count integer := 0; v_result jsonb; v_now timestamptz := now();
begin
  perform private.clair_notification_validate_actor_v2(p_workspace_id, p_actor_user_id, p_state_scope_id);
  if p_action not in ('read','archive','restore','read-all') or p_action is null
    or (p_action <> 'read-all' and length(trim(coalesce(p_notification_id,''))) = 0) then
    raise exception 'invalid_notification_event_payload'; end if;
  -- Event -> state lock order matches legacy emitters; deterministic UUID order
  -- prevents overlapping bulk requests from locking the same set in reverse order.
  with locked as materialized (
    select e.id, e.workspace_id, e.notification_id from public.notification_events e
    where e.workspace_id = p_workspace_id
      and (e.event_scope_id = '' or (private.clair_notification_scope_id(p_event_scope_id) <> ''
        and e.event_scope_id = private.clair_notification_scope_id(p_event_scope_id)))
      and (p_action = 'read-all' or e.notification_id = p_notification_id)
      and private.clair_notification_visible_v2(e)
    order by e.id for update
  )
  insert into public.notification_user_states as current_state
    (workspace_id, actor_user_id, state_scope_id, notification_id, read_at, archived_at, created_at, updated_at)
  select distinct p_workspace_id, p_actor_user_id, left(trim(p_state_scope_id),180), e.notification_id,
    case when p_action = 'restore' then null else v_now end,
    case when p_action = 'archive' then v_now else null end, v_now, v_now
  from locked e
  left join public.notification_user_states s on s.workspace_id = e.workspace_id
    and s.actor_user_id = p_actor_user_id and s.state_scope_id = left(trim(p_state_scope_id),180)
    and s.notification_id = e.notification_id
  where p_action <> 'read-all' or (s.read_at is null and s.archived_at is null)
  on conflict (workspace_id, actor_user_id, state_scope_id, notification_id) do update set
    read_at = case when p_action = 'restore' then current_state.read_at
      when p_action = 'archive' then excluded.read_at else coalesce(current_state.read_at, excluded.read_at) end,
    archived_at = case when p_action = 'restore' then null
      when p_action = 'archive' then excluded.archived_at else current_state.archived_at end,
    updated_at = excluded.updated_at
  where p_action <> 'read-all' or (current_state.read_at is null and current_state.archived_at is null);
  get diagnostics v_count = row_count;
  if v_count = 0 and p_action <> 'read-all' then raise exception 'notification_not_found'; end if;
  v_result := public.clair_read_notification_snapshot_v2(p_workspace_id, p_actor_user_id,
    p_state_scope_id, p_event_scope_id, 'snapshot', case when p_action = 'read-all' then 0 else 1 end,
    case when p_action = 'read-all' then null else p_notification_id end);
  return v_result || jsonb_build_object('updatedCount', v_count);
end; $$;

revoke all on function private.clair_notification_visible_v2(public.notification_events) from public, anon, authenticated, service_role;
revoke all on function private.clair_notification_validate_actor_v2(text,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.clair_read_notification_snapshot_v2(text,uuid,text,text,text,integer,text) from public, anon, service_role;
revoke all on function public.clair_mutate_notification_user_state_v2(text,uuid,text,text,text,text) from public, anon, service_role;
grant execute on function public.clair_read_notification_snapshot_v2(text,uuid,text,text,text,integer,text) to authenticated;
grant execute on function public.clair_mutate_notification_user_state_v2(text,uuid,text,text,text,text) to authenticated;
