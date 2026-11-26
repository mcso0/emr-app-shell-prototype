-- Additive workspace-scoped storage for an explicitly reviewed fictional history
-- batch. Creating the schema does not publish or insert any history.
create table private.clair_cheongdam_demo_history_batches (
  workspace_id text not null,
  batch_key text primary key,
  payload jsonb not null,
  -- Store the verified caller id without imposing a new lifecycle constraint on users.
  imported_by uuid not null,
  imported_at timestamptz not null default clock_timestamp(),
  retired_by uuid,
  retired_at timestamptz,
  constraint cheongdam_demo_history_workspace check (workspace_id = 'workspace-clair-cheongdam'),
  constraint cheongdam_demo_history_batch check (batch_key = 'cheongdam-2026-11-24-v1'),
  constraint cheongdam_demo_history_payload check (jsonb_typeof(payload) = 'array' and jsonb_array_length(payload) = 18),
  constraint cheongdam_demo_history_retirement check ((retired_by is null) = (retired_at is null))
);
alter table private.clair_cheongdam_demo_history_batches enable row level security;
revoke all on private.clair_cheongdam_demo_history_batches from public, anon, authenticated;

create function private.clair_can_manage_cheongdam_demo_history()
returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.user_memberships m
    join public.users u on u.id = m.user_id
    join public.workspace_membership_permission_role_assignments a
      on a.workspace_id = m.workspace_id and a.membership_id = m.id
    join public.workspace_permission_roles r
      on r.workspace_id = a.workspace_id and r.id = a.permission_role_id
    where m.workspace_id = 'workspace-clair-cheongdam'
      and m.user_id = auth.uid() and m.status = 'active' and u.status = 'active'
      and r.role_key = 'owner' and r.role_type = 'owner' and r.is_system and r.status = 'active'
      and a.owner_source in ('explicit', 'legacy_creator')
  );
$$;
revoke all on function private.clair_can_manage_cheongdam_demo_history() from public, anon, authenticated;

create function public.clair_activate_cheongdam_demo_history(p_workspace_id text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare batch constant text := 'cheongdam-2026-11-24-v1';
declare expected constant text := 'f2f658d4cdf834cb5bab9eb3006c5663519340d959a08add97a59a190cc62fa8';
declare changed integer;
begin
  if p_workspace_id is distinct from 'workspace-clair-cheongdam'
    or not private.clair_can_manage_cheongdam_demo_history() then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  if p_payload is null or encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex') <> expected then
    raise exception 'unapproved_demo_manifest' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(batch, 0));
  if exists (
    select 1 from private.clair_cheongdam_demo_history_batches b where b.batch_key = batch and b.retired_at is not null
  ) then
    raise exception 'demo_batch_retired' using errcode = '22023';
  end if;
  if exists (
    select 1 from private.clair_cheongdam_demo_history_batches b where b.batch_key = batch
  ) then
    return jsonb_build_object('batch', batch, 'added', 0, 'active', 18);
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload) i
    where not exists (
      select 1 from public.patients p where p.workspace_id = p_workspace_id
        and p.id = (i->>'patientId')::uuid and p.status = 'active' and p.name = i->>'patient'
        and p.patient_no in ('CD-P-002', 'CD-P-004', 'CD-P-007', 'CD-P-008', 'CD-P-010', 'CD-P-020')
        and p.id::text = '49121000-0000-4000-8000-000000000' || right(p.patient_no, 3)
    )
  ) then
    raise exception 'demo_seed_patient_mismatch' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_payload) i, lateral jsonb_array_elements(i->'orders') o
    where not exists (
      select 1 from public.order_catalog_items c where c.workspace_id = p_workspace_id
        and c.id = o->>'catalogId' and c.availability_status = 'active'
        and c.default_destination_module = o->>'module'
    )
  ) then
    raise exception 'demo_catalog_mismatch' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_payload) i
    join public.encounters e on e.workspace_id = p_workspace_id and e.patient_id = (i->>'patientId')::uuid
      and (e.checked_in_at at time zone 'Asia/Seoul')::date = (((i->>'visitAt')::timestamptz) at time zone 'Asia/Seoul')::date
  ) then
    raise exception 'demo_encounter_date_conflict' using errcode = '22023';
  end if;

  insert into private.clair_cheongdam_demo_history_batches (workspace_id, batch_key, payload, imported_by)
  values (p_workspace_id, batch, p_payload, auth.uid()) on conflict (batch_key) do nothing;
  get diagnostics changed = row_count;
  return jsonb_build_object('batch', batch, 'added', changed * 18, 'active', 18);
end;
$$;
revoke all on function public.clair_activate_cheongdam_demo_history(text, jsonb) from public, anon, authenticated;
grant execute on function public.clair_activate_cheongdam_demo_history(text, jsonb) to authenticated;

create function public.clair_retire_cheongdam_demo_history(p_workspace_id text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare batch constant text := 'cheongdam-2026-11-24-v1';
declare changed integer;
begin
  if p_workspace_id is distinct from 'workspace-clair-cheongdam'
    or not private.clair_can_manage_cheongdam_demo_history() then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(batch, 0));
  update private.clair_cheongdam_demo_history_batches b
    set retired_at = clock_timestamp(), retired_by = auth.uid()
    where b.workspace_id = p_workspace_id and b.batch_key = batch and b.retired_at is null;
  get diagnostics changed = row_count;
  return jsonb_build_object('batch', batch, 'retired', changed * 18);
end;
$$;
revoke all on function public.clair_retire_cheongdam_demo_history(text) from public, anon, authenticated;
grant execute on function public.clair_retire_cheongdam_demo_history(text) to authenticated;

create function public.clair_read_cheongdam_demo_history(p_workspace_id text, p_patient_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare show_lab boolean;
begin
  if p_workspace_id is distinct from 'workspace-clair-cheongdam' then
    return '[]'::jsonb;
  end if;
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  show_lab := private.clair_current_user_has_workspace_permission(p_workspace_id, 'lab:view');
  return coalesce((
    select jsonb_agg((i-'orders') || jsonb_build_object('orders', coalesce((
      select jsonb_agg(o)
      from jsonb_array_elements(i->'orders') o
      where show_lab or o->>'module' <> 'lab'
    ), '[]'::jsonb)) order by i->>'visitAt' desc, i->>'id')
    from private.clair_cheongdam_demo_history_batches b
    cross join lateral jsonb_array_elements(b.payload) i
    join public.patients p on p.workspace_id = b.workspace_id and p.id = (i->>'patientId')::uuid
    where b.workspace_id = p_workspace_id and b.retired_at is null and p.status = 'active'
      and p.name = i->>'patient' and p.patient_no in ('CD-P-002', 'CD-P-004', 'CD-P-007', 'CD-P-008', 'CD-P-010', 'CD-P-020')
      and p.id::text = '49121000-0000-4000-8000-000000000' || right(p.patient_no, 3)
      and (p_patient_id is null or p.id = p_patient_id)
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.clair_read_cheongdam_demo_history(text, uuid) from public, anon, authenticated;
grant execute on function public.clair_read_cheongdam_demo_history(text, uuid) to authenticated;
