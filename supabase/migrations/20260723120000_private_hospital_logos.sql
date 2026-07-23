-- HOSPITAL-ADMIN-LIVE-PR-022: private, workspace-scoped hospital logos.

alter table public.workspace_hospital_profiles
  drop constraint if exists workspace_hospital_profiles_logo_storage_path_check;
alter table public.workspace_hospital_profiles
  add constraint workspace_hospital_profiles_logo_storage_path_check check (
    logo_storage_path is null
    or (
      logo_storage_path ~
        '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]/logos/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
      and split_part(logo_storage_path, '/', 1) = workspace_id
      and split_part(logo_storage_path, '/', 2) = 'logos'
      and array_length(string_to_array(logo_storage_path, '/'), 1) = 3
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hospital-logos',
  'hospital-logos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hospital_logos_select_current_member on storage.objects;
drop policy if exists hospital_logos_select_authorized on storage.objects;
create policy hospital_logos_select_authorized
on storage.objects
for select to authenticated
using (
  bucket_id = 'hospital-logos'
  and (
    (
      owner_id = (select auth.uid()::text)
      and private.clair_is_workspace_admin((storage.foldername(name))[1])
    )
    or exists (
      select 1
      from public.workspace_hospital_profiles profile
      where profile.workspace_id = (storage.foldername(name))[1]
        and profile.logo_storage_path = storage.objects.name
        and private.clair_is_active_workspace_member(profile.workspace_id)
    )
  )
);

drop policy if exists hospital_logos_insert_admin on storage.objects;
drop policy if exists hospital_logos_insert_workspace_admin on storage.objects;
create policy hospital_logos_insert_workspace_admin
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'hospital-logos'
  and owner_id = (select auth.uid()::text)
  and private.clair_is_workspace_admin((storage.foldername(name))[1])
  and (
    (
      (storage.foldername(name))[2] = 'incoming'
      and (storage.foldername(name))[3] = (select auth.uid()::text)
      and array_length(string_to_array(name, '/'), 1) = 4
      and storage.filename(name) ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    or (
      (storage.foldername(name))[2] = 'logos'
      and array_length(string_to_array(name, '/'), 1) = 3
      and storage.filename(name) ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  )
);

drop policy if exists hospital_logos_delete_admin on storage.objects;
drop policy if exists hospital_logos_delete_workspace_admin on storage.objects;
create policy hospital_logos_delete_workspace_admin
on storage.objects
for delete to authenticated
using (
  bucket_id = 'hospital-logos'
  and private.clair_is_workspace_admin((storage.foldername(name))[1])
);

create or replace function private.clair_guard_workspace_hospital_logo_write()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.role() in ('authenticated', 'anon')
    and current_setting('clair.hospital_logo_rpc', true) is distinct from 'allowed'
    and new.logo_storage_path is distinct from old.logo_storage_path
  then
    raise exception using errcode = '42501', message = 'hospital_logo_api_required';
  end if;
  return new;
end;
$$;

revoke all on function private.clair_guard_workspace_hospital_logo_write()
  from public, anon, authenticated;

drop trigger if exists guard_workspace_hospital_logo_write
  on public.workspace_hospital_profiles;
create trigger guard_workspace_hospital_logo_write
before update on public.workspace_hospital_profiles
for each row execute function private.clair_guard_workspace_hospital_logo_write();

alter table public.audit_events
  drop constraint if exists audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check check (event_type in (
    'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
    'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
    'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_archived',
    'workspace.membership_deactivated','workspace.membership_reactivated','workspace.membership_restored',
    'workspace.permission_role_deactivated','workspace.permission_role_reactivated',
    'workspace.permission_role_created','workspace.permission_role_updated',
    'workspace.job_position_deactivated','workspace.job_position_reactivated',
    'workspace.last_admin_change_blocked','user.profile_updated','user.workspace_status_message_updated',
    'reception.patient_guardian_registered','reception.walk_in_created','reception.appointment_created',
    'reception.appointment_checked_in','reception.appointment_restored','reception.encounter_cancelled',
    'reception.encounter_restored','reception.encounter_updated','reception.queue_status_changed',
    'chart.patient_called','chart.consultation_started','chart.consultation_returned_to_waiting',
    'chart.soap_saved','chart.completed','diagnosis.changed','order.draft_changed','order.confirmed',
    'order.billing_candidate_requested','order.status_changed','order_catalog.created',
    'order_catalog.updated','order_catalog.paused','billing.invoice_candidate_generated',
    'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed',
    'billing.refund_requested','hospital.operating_hours_updated','hospital.schedule_revision_published',
    'hospital.schedule_revision_mutated','hospital.vital_settings_updated',
    'hospital.space_category_created','hospital.space_category_renamed',
    'hospital.space_category_archived','hospital.space_created',
    'hospital.space_updated','hospital.space_archived',
    'hospital.profile_contact_updated','hospital.profile_change_requested',
    'hospital.logo_updated','hospital.logo_removed'
  ));

create or replace function public.clair_set_workspace_hospital_logo_state(
  p_workspace_id text,
  p_expected_revision bigint,
  p_expected_storage_path text,
  p_new_storage_path text,
  p_operation text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_membership_id uuid;
  v_current public.workspace_hospital_profiles%rowtype;
  v_saved public.workspace_hospital_profiles%rowtype;
  v_event_type text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'permission_missing';
  end if;
  if p_operation not in ('upload', 'remove', 'restore') then
    raise exception using errcode = '22023', message = 'invalid_logo_operation';
  end if;
  if p_new_storage_path is not null and not (
    split_part(p_new_storage_path, '/', 1) = p_workspace_id
    and split_part(p_new_storage_path, '/', 2) = 'logos'
    and array_length(string_to_array(p_new_storage_path, '/'), 1) = 3
    and split_part(p_new_storage_path, '/', 3) ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_logo_storage_path';
  end if;

  select profile.* into v_current
  from public.workspace_hospital_profiles profile
  where profile.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'hospital_profile_not_found';
  end if;
  if v_current.revision <> p_expected_revision
    or v_current.logo_storage_path is distinct from p_expected_storage_path
  then
    raise exception using errcode = '40001', message = 'hospital_logo_state_conflict';
  end if;

  perform set_config('clair.hospital_logo_rpc', 'allowed', true);
  update public.workspace_hospital_profiles profile
  set logo_storage_path = p_new_storage_path,
      revision = revision + 1,
      updated_by_user_id = v_actor,
      updated_at = now()
  where profile.workspace_id = p_workspace_id
  returning * into v_saved;
  perform set_config('clair.hospital_logo_rpc', '', true);

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_actor
    and membership.status = 'active';

  v_event_type := case
    when p_operation = 'remove' then 'hospital.logo_removed'
    else 'hospital.logo_updated'
  end;
  perform public.clair_append_audit_event(
    'hospital-logo-' || gen_random_uuid()::text,
    p_workspace_id,
    v_actor,
    v_actor_membership_id,
    v_event_type,
    'workspace_hospital_profile',
    p_workspace_id,
    p_request_id => nullif(btrim(p_request_id), ''),
    p_before_snapshot => jsonb_build_object(
      'hasLogo',
      v_current.logo_storage_path is not null,
      'revision',
      v_current.revision
    ),
    p_after_snapshot => jsonb_build_object(
      'hasLogo',
      v_saved.logo_storage_path is not null,
      'revision',
      v_saved.revision
    ),
    p_metadata => jsonb_build_object('operation', p_operation)
  );

  return jsonb_build_object(
    'storagePath', v_saved.logo_storage_path,
    'revision', v_saved.revision
  );
end;
$$;

revoke all on function public.clair_set_workspace_hospital_logo_state(
  text, bigint, text, text, text, text
) from public, anon;
grant execute on function public.clair_set_workspace_hospital_logo_state(
  text, bigint, text, text, text, text
) to authenticated;

comment on function public.clair_set_workspace_hospital_logo_state(
  text, bigint, text, text, text, text
) is 'Admin-only CAS update for the private current hospital logo pointer.';
