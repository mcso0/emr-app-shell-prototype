-- Preserve actor validation, workspace/event scope, recipient/domain permissions,
-- counts, ordering, limits, existing security mode and function grants.
create or replace function public.clair_read_notification_snapshot_v2(
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
  -- Visibility depends only on workspace, recipient kind/id and domain.
  -- Evaluate the existing predicate once per target, within this request.
  with targets as materialized (
    select distinct on (e.recipient_kind, e.recipient_id, e.domain) e as event
    from public.notification_events e
    where e.workspace_id = p_workspace_id
      and (e.event_scope_id = '' or (private.clair_notification_scope_id(p_event_scope_id) <> ''
        and e.event_scope_id = private.clair_notification_scope_id(p_event_scope_id)))
    order by e.recipient_kind, e.recipient_id, e.domain, e.id
  ), allowed_targets as materialized (
    select (t.event).recipient_kind, (t.event).recipient_id, (t.event).domain
    from targets t where private.clair_notification_visible_v2(t.event)
  ), visible as materialized (
    select e.id, e.notification_id, e.updated_at, e.badge_count, e.requires_action, s.read_at, s.archived_at
    from public.notification_events e
    left join public.notification_user_states s
      on s.workspace_id = e.workspace_id and s.actor_user_id = p_actor_user_id
      and s.state_scope_id = left(trim(p_state_scope_id), 180) and s.notification_id = e.notification_id
    where e.workspace_id = p_workspace_id
      and (e.event_scope_id = '' or (private.clair_notification_scope_id(p_event_scope_id) <> ''
        and e.event_scope_id = private.clair_notification_scope_id(p_event_scope_id)))
      and exists (
        select 1 from allowed_targets t
        where t.recipient_kind is not distinct from e.recipient_kind
          and t.recipient_id is not distinct from e.recipient_id
          and t.domain is not distinct from e.domain
      )
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

