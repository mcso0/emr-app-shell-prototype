-- DEN-70: local-first chart completion persistence RPC boundary.
-- Created manually because the Supabase CLI is not installed in this workspace.
-- Remote Supabase application remains approval-gated.

alter table public.encounters
  add column if not exists chart_completed_at timestamptz,
  add column if not exists chart_completed_by_user_id uuid references public.users(id) on delete set null;

create index if not exists encounters_workspace_chart_completed_idx
  on public.encounters (workspace_id, chart_completed_at desc)
  where chart_completed_at is not null;

create or replace function public.clair_get_chart_completion(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_completion_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select jsonb_build_object(
    'encounterId', e.id::text,
    'workspaceId', e.workspace_id,
    'status', e.status,
    'chartCompletedAt', e.chart_completed_at,
    'chartCompletedByUserId', e.chart_completed_by_user_id::text,
    'updatedAt', e.updated_at
  )
    into v_completion_row
  from public.encounters e
  where e.workspace_id = p_workspace_id
    and e.id = p_encounter_id
    and e.status <> 'cancelled';

  if v_completion_row is null then
    raise exception 'encounter_unavailable';
  end if;

  return v_completion_row;
end;
$$;

create or replace function public.clair_complete_chart(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_completion_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;

  update public.encounters
  set
    status = case
      when status in ('waiting', 'in_consultation', 'ordered') then 'ready_for_billing'
      else status
    end,
    started_at = coalesce(started_at, v_now),
    chart_completed_at = coalesce(chart_completed_at, v_now),
    chart_completed_by_user_id = coalesce(chart_completed_by_user_id, v_actor_user_id),
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled';

  update public.soap_notes
  set
    status = case when status in ('draft', 'autosaved') then 'signed' else status end,
    signed_at = case when status in ('draft', 'autosaved') then coalesce(signed_at, v_now) else signed_at end,
    updated_at = v_now
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and status in ('draft', 'autosaved');

  update public.waiting_queue_entries
  set
    status = 'done',
    finished_at = coalesce(finished_at, v_now)
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and queue_type = 'consultation'
    and status <> 'done';

  insert into public.waiting_queue_entries (
    workspace_id,
    encounter_id,
    queue_type,
    status,
    priority,
    entered_at
  )
  values (
    p_workspace_id,
    p_encounter_id,
    'billing',
    'waiting',
    'normal',
    v_now
  )
  on conflict (encounter_id, queue_type) do update
  set
    status = case when public.waiting_queue_entries.status = 'cancelled' then 'waiting' else public.waiting_queue_entries.status end,
    entered_at = coalesce(public.waiting_queue_entries.entered_at, excluded.entered_at);

  select public.clair_get_chart_completion(p_workspace_id, p_encounter_id)
    into v_completion_row;

  return v_completion_row;
end;
$$;

revoke all on function public.clair_get_chart_completion(text, uuid) from public;
revoke all on function public.clair_complete_chart(text, text, uuid) from public;
grant execute on function public.clair_get_chart_completion(text, uuid) to authenticated;
grant execute on function public.clair_complete_chart(text, text, uuid) to authenticated;

comment on function public.clair_get_chart_completion(text, uuid) is
  'DEN-70 local-first route-owned chart completion reader scoped by active workspace membership and encounter workspace.';
comment on function public.clair_complete_chart(text, text, uuid) is
  'DEN-70 local-first route-owned chart completion writer. Moves clinical work to ready_for_billing without marking invoice/payment completed.';
