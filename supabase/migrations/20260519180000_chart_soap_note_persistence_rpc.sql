-- DEN-69: local-first SOAP note read/save RPC boundary.
-- Created manually because the Supabase CLI is not installed in this workspace.
-- Remote Supabase application remains approval-gated.

create or replace function public.clair_get_chart_soap_note(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_note_row jsonb;
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
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select jsonb_build_object(
    'id', s.id::text,
    'encounterId', s.encounter_id::text,
    'authorUserId', s.author_user_id::text,
    'subjective', s.subjective,
    'objective', s.objective,
    'assessment', s.assessment,
    'plan', s.plan,
    'status', s.status,
    'autosavedAt', s.autosaved_at,
    'signedAt', s.signed_at,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at
  )
    into v_note_row
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.encounter_id = p_encounter_id
    and s.status <> 'voided'
  order by s.updated_at desc
  limit 1;

  return v_note_row;
end;
$$;

create or replace function public.clair_save_chart_soap_note(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_note jsonb,
  p_mode text default 'autosave'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_existing_id uuid;
  v_now timestamptz := now();
  v_status text := case when p_mode = 'manual_save' then 'draft' else 'autosaved' end;
  v_note_row jsonb;
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
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select s.id
    into v_existing_id
  from public.soap_notes s
  where s.workspace_id = p_workspace_id
    and s.encounter_id = p_encounter_id
    and s.status <> 'voided'
  order by s.updated_at desc
  limit 1;

  if v_existing_id is null then
    insert into public.soap_notes (
      workspace_id,
      encounter_id,
      author_user_id,
      subjective,
      objective,
      assessment,
      plan,
      status,
      autosaved_at,
      created_at,
      updated_at
    )
    values (
      p_workspace_id,
      p_encounter_id,
      v_actor_user_id,
      nullif(btrim(p_note->>'subjective'), ''),
      nullif(btrim(p_note->>'objective'), ''),
      nullif(btrim(p_note->>'assessment'), ''),
      nullif(btrim(p_note->>'plan'), ''),
      v_status,
      case when p_mode = 'autosave' then v_now else null end,
      v_now,
      v_now
    )
    returning id into v_existing_id;
  else
    update public.soap_notes
    set
      author_user_id = coalesce(author_user_id, v_actor_user_id),
      subjective = nullif(btrim(p_note->>'subjective'), ''),
      objective = nullif(btrim(p_note->>'objective'), ''),
      assessment = nullif(btrim(p_note->>'assessment'), ''),
      plan = nullif(btrim(p_note->>'plan'), ''),
      status = v_status,
      autosaved_at = case when p_mode = 'autosave' then v_now else autosaved_at end,
      updated_at = v_now
    where id = v_existing_id
      and workspace_id = p_workspace_id;
  end if;

  update public.encounters
  set
    status = case when status = 'waiting' then 'in_consultation' else status end,
    started_at = case when status = 'waiting' then coalesce(started_at, v_now) else started_at end,
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status = 'waiting';

  select public.clair_get_chart_soap_note(p_workspace_id, p_encounter_id)
    into v_note_row;

  return v_note_row;
end;
$$;

revoke all on function public.clair_get_chart_soap_note(text, uuid) from public;
revoke all on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, text) from public;
grant execute on function public.clair_get_chart_soap_note(text, uuid) to authenticated;
grant execute on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, text) to authenticated;

comment on function public.clair_get_chart_soap_note(text, uuid) is
  'DEN-69 local-first route-owned SOAP note reader scoped by active workspace membership and encounter workspace.';
comment on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, text) is
  'DEN-69 local-first route-owned SOAP note save/autosave writer. Remote Supabase application remains approval-gated.';
