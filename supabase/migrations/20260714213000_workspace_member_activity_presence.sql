-- RECEPTION-PR-009: workspace-scoped member activity and private Presence.
-- Online state remains ephemeral in Realtime Presence. This table stores only
-- a throttled last-seen timestamp for the authenticated member.

create table if not exists public.workspace_member_activity (
  workspace_id text not null,
  user_id uuid not null,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_member_activity_membership_fkey
    foreign key (workspace_id, user_id)
    references public.user_memberships (workspace_id, user_id)
    on delete cascade
);

comment on table public.workspace_member_activity is
  'Workspace-scoped, throttled member last-seen timestamps. Online state is held only in Realtime Presence.';
comment on column public.workspace_member_activity.last_seen_at is
  'Most recent accepted heartbeat. Writes within 60 seconds are intentionally ignored.';

alter table public.workspace_member_activity enable row level security;

revoke all on table public.workspace_member_activity from public, anon;
grant select on table public.workspace_member_activity to authenticated;

drop policy if exists workspace_member_activity_select_active_member
  on public.workspace_member_activity;
create policy workspace_member_activity_select_active_member
on public.workspace_member_activity
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

create or replace function public.clair_touch_workspace_member_activity(
  p_workspace_id text
) returns timestamptz
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_seen_at timestamptz;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'workspace_member_activity_authentication_required';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'workspace_member_activity_active_membership_required';
  end if;

  insert into public.workspace_member_activity as activity (
    workspace_id,
    user_id,
    last_seen_at,
    updated_at
  ) values (
    p_workspace_id,
    v_user_id,
    now(),
    now()
  )
  on conflict (workspace_id, user_id) do update
    set last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    where activity.last_seen_at <= now() - interval '60 seconds'
  returning last_seen_at into v_last_seen_at;

  if v_last_seen_at is null then
    select activity.last_seen_at
      into v_last_seen_at
      from public.workspace_member_activity activity
     where activity.workspace_id = p_workspace_id
       and activity.user_id = v_user_id;
  end if;

  return v_last_seen_at;
end;
$$;

revoke all on function public.clair_touch_workspace_member_activity(text)
  from public, anon;
grant execute on function public.clair_touch_workspace_member_activity(text)
  to authenticated;

create or replace function private.clair_staff_presence_workspace_from_topic(
  p_topic text
) returns text
language sql
stable
as $$
  select substring(p_topic from '^workspace:([^:]+):staff-presence$')
$$;

revoke all on function private.clair_staff_presence_workspace_from_topic(text)
  from public, anon;
grant execute on function private.clair_staff_presence_workspace_from_topic(text)
  to authenticated;

drop policy if exists clair_staff_presence_receive on realtime.messages;
create policy clair_staff_presence_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and private.clair_staff_presence_workspace_from_topic(
    (select realtime.topic())
  ) is not null
  and private.clair_is_active_workspace_member(
    private.clair_staff_presence_workspace_from_topic(
      (select realtime.topic())
    )
  )
);

drop policy if exists clair_staff_presence_track on realtime.messages;
create policy clair_staff_presence_track
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and private.clair_staff_presence_workspace_from_topic(
    (select realtime.topic())
  ) is not null
  and private.clair_is_active_workspace_member(
    private.clair_staff_presence_workspace_from_topic(
      (select realtime.topic())
    )
  )
);
