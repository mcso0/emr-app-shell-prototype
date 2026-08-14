-- HOSPITAL-ADMIN-LIVE-PR-021: workspace-scoped hospital profile and contact.

create table public.workspace_hospital_profiles (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  representative_name text
    check (representative_name is null or (
      representative_name = btrim(representative_name)
      and char_length(representative_name) between 1 and 200
    )),
  address text
    check (address is null or (
      address = btrim(address)
      and char_length(address) between 1 and 500
    )),
  country_code text not null default 'KR'
    check (country_code ~ '^[A-Z]{2}$'),
  representative_phone text
    check (representative_phone is null or (
      representative_phone = btrim(representative_phone)
      and char_length(representative_phone) between 1 and 50
    )),
  fax text
    check (fax is null or (
      fax = btrim(fax)
      and char_length(fax) between 1 and 50
    )),
  homepage_url text
    check (homepage_url is null or (
      homepage_url = btrim(homepage_url)
      and char_length(homepage_url) between 1 and 200
      and homepage_url ~* '^https?://'
    )),
  instagram_handle text
    check (instagram_handle is null or (
      instagram_handle = btrim(instagram_handle)
      and char_length(instagram_handle) between 1 and 100
    )),
  customer_guide_memo text
    check (customer_guide_memo is null or (
      customer_guide_memo = btrim(customer_guide_memo)
      and char_length(customer_guide_memo) between 1 and 300
    )),
  logo_storage_path text,
  revision bigint not null default 1 check (revision > 0),
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_hospital_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  requested_by_user_id uuid not null references public.users(id) on delete restrict,
  requested_fields text[] not null check (
    cardinality(requested_fields) between 1 and 3
    and requested_fields <@ array[
      'hospital_name',
      'representative_name',
      'address'
    ]::text[]
  ),
  detail text not null check (
    detail = btrim(detail)
    and char_length(detail) between 1 and 2000
  ),
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users(id) on delete set null
);

create index workspace_hospital_profile_change_requests_workspace_status_created_idx
  on public.workspace_hospital_profile_change_requests (
    workspace_id,
    status,
    created_at desc
  );

insert into public.workspace_hospital_profiles (workspace_id)
select workspace.id
from public.workspaces workspace
on conflict (workspace_id) do nothing;

create or replace function private.clair_create_workspace_hospital_profile()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.workspace_hospital_profiles (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

revoke all on function private.clair_create_workspace_hospital_profile()
  from public, anon, authenticated;

drop trigger if exists create_workspace_hospital_profile on public.workspaces;
create trigger create_workspace_hospital_profile
after insert on public.workspaces
for each row execute function private.clair_create_workspace_hospital_profile();

alter table public.workspace_hospital_profiles enable row level security;
alter table public.workspace_hospital_profile_change_requests enable row level security;

create policy workspace_hospital_profiles_member_select
on public.workspace_hospital_profiles
for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

create policy workspace_hospital_profile_change_requests_admin_select
on public.workspace_hospital_profile_change_requests
for select to authenticated
using (private.clair_is_workspace_admin(workspace_id));

revoke all privileges on table public.workspace_hospital_profiles
  from public, anon, authenticated;
revoke all privileges on table public.workspace_hospital_profile_change_requests
  from public, anon, authenticated;
grant select on table public.workspace_hospital_profiles to authenticated;
grant select on table public.workspace_hospital_profile_change_requests to authenticated;

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
    'hospital.profile_contact_updated','hospital.profile_change_requested'
  ));

create or replace function public.clair_get_workspace_hospital_profile(
  p_workspace_id text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_profile public.workspace_hospital_profiles%rowtype;
  v_workspace public.workspaces%rowtype;
  v_request public.workspace_hospital_profile_change_requests%rowtype;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'workspace_membership_missing';
  end if;

  select workspace.* into v_workspace
  from public.workspaces workspace
  where workspace.id = p_workspace_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'workspace_not_found';
  end if;

  select profile.* into v_profile
  from public.workspace_hospital_profiles profile
  where profile.workspace_id = p_workspace_id;

  select request.* into v_request
  from public.workspace_hospital_profile_change_requests request
  where request.workspace_id = p_workspace_id
    and request.status in ('pending', 'reviewing')
  order by request.created_at desc
  limit 1;

  return jsonb_build_object(
    'workspaceId', v_workspace.id,
    'name', v_workspace.display_name,
    'representativeName', v_profile.representative_name,
    'address', v_profile.address,
    'countryCode', v_profile.country_code,
    'timezone', v_workspace.timezone,
    'contact', jsonb_build_object(
      'phone', coalesce(v_profile.representative_phone, ''),
      'fax', coalesce(v_profile.fax, ''),
      'homepage', coalesce(v_profile.homepage_url, ''),
      'instagram', coalesce(v_profile.instagram_handle, ''),
      'customerGuideMemo', coalesce(v_profile.customer_guide_memo, '')
    ),
    'logo', jsonb_build_object(
      'hasCustomLogo', v_profile.logo_storage_path is not null,
      'url', null
    ),
    'logoStoragePath', v_profile.logo_storage_path,
    'revision', v_profile.revision,
    'profileComplete', (
      nullif(v_workspace.display_name, '') is not null
      and v_profile.representative_name is not null
      and v_profile.address is not null
      and v_profile.representative_phone is not null
    ),
    'pendingChangeRequest', case
      when v_request.id is null then null
      else jsonb_build_object(
        'id', v_request.id,
        'fields', v_request.requested_fields,
        'createdAt', v_request.created_at,
        'status', v_request.status
      )
    end
  );
end;
$$;

create or replace function public.clair_update_workspace_hospital_contact(
  p_workspace_id text,
  p_actor_user_id text,
  p_expected_revision bigint,
  p_contact jsonb,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor uuid := nullif(p_actor_user_id, '')::uuid;
  v_actor_membership_id uuid;
  v_current public.workspace_hospital_profiles%rowtype;
  v_phone text := nullif(btrim(p_contact->>'phone'), '');
  v_fax text := nullif(btrim(p_contact->>'fax'), '');
  v_homepage text := nullif(btrim(p_contact->>'homepage'), '');
  v_instagram text := nullif(btrim(p_contact->>'instagram'), '');
  v_memo text := nullif(btrim(p_contact->>'customerGuideMemo'), '');
  v_changed_fields text[] := array[]::text[];
begin
  if v_actor is null or v_actor <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'actor_mismatch';
  end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'permission_missing';
  end if;
  if jsonb_typeof(p_contact) <> 'object'
    or not (p_contact ?& array['phone','fax','homepage','instagram','customerGuideMemo'])
    or v_phone is null
    or char_length(v_phone) > 50
    or (v_fax is not null and char_length(v_fax) > 50)
    or (v_homepage is not null and (
      char_length(v_homepage) > 200 or v_homepage !~* '^https?://'
    ))
    or (v_instagram is not null and char_length(v_instagram) > 100)
    or (v_memo is not null and char_length(v_memo) > 300)
  then
    raise exception using errcode = '22023', message = 'invalid_input';
  end if;

  select profile.* into v_current
  from public.workspace_hospital_profiles profile
  where profile.workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'hospital_profile_not_found';
  end if;
  if v_current.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'hospital_profile_stale';
  end if;

  if v_current.representative_phone is distinct from v_phone then
    v_changed_fields := array_append(v_changed_fields, 'phone');
  end if;
  if v_current.fax is distinct from v_fax then
    v_changed_fields := array_append(v_changed_fields, 'fax');
  end if;
  if v_current.homepage_url is distinct from v_homepage then
    v_changed_fields := array_append(v_changed_fields, 'homepage');
  end if;
  if v_current.instagram_handle is distinct from v_instagram then
    v_changed_fields := array_append(v_changed_fields, 'instagram');
  end if;
  if v_current.customer_guide_memo is distinct from v_memo then
    v_changed_fields := array_append(v_changed_fields, 'customerGuideMemo');
  end if;

  update public.workspace_hospital_profiles profile
  set representative_phone = v_phone,
      fax = v_fax,
      homepage_url = v_homepage,
      instagram_handle = v_instagram,
      customer_guide_memo = v_memo,
      revision = revision + 1,
      updated_by_user_id = v_actor,
      updated_at = now()
  where profile.workspace_id = p_workspace_id;

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_actor
    and membership.status = 'active';

  perform public.clair_append_audit_event(
    'hospital-profile-' || gen_random_uuid()::text,
    p_workspace_id,
    v_actor,
    v_actor_membership_id,
    'hospital.profile_contact_updated',
    'workspace_hospital_profile',
    p_workspace_id,
    p_request_id => nullif(btrim(p_request_id), ''),
    p_before_snapshot => jsonb_build_object('revision', v_current.revision),
    p_after_snapshot => jsonb_build_object('revision', v_current.revision + 1),
    p_metadata => jsonb_build_object('changedFields', v_changed_fields)
  );

  return public.clair_get_workspace_hospital_profile(p_workspace_id);
end;
$$;

create or replace function public.clair_create_workspace_hospital_profile_change_request(
  p_workspace_id text,
  p_actor_user_id text,
  p_fields text[],
  p_detail text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor uuid := nullif(p_actor_user_id, '')::uuid;
  v_actor_membership_id uuid;
  v_request public.workspace_hospital_profile_change_requests%rowtype;
  v_fields text[] := array(select distinct field from unnest(p_fields) field order by field);
  v_detail text := btrim(coalesce(p_detail, ''));
begin
  if v_actor is null or v_actor <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'actor_mismatch';
  end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception using errcode = '42501', message = 'permission_missing';
  end if;
  if cardinality(v_fields) not between 1 and 3
    or not (v_fields <@ array['hospital_name','representative_name','address']::text[])
    or char_length(v_detail) not between 1 and 2000
  then
    raise exception using errcode = '22023', message = 'invalid_input';
  end if;

  insert into public.workspace_hospital_profile_change_requests (
    workspace_id,
    requested_by_user_id,
    requested_fields,
    detail
  ) values (
    p_workspace_id,
    v_actor,
    v_fields,
    v_detail
  )
  returning * into v_request;

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_actor
    and membership.status = 'active';

  perform public.clair_append_audit_event(
    'hospital-profile-request-' || gen_random_uuid()::text,
    p_workspace_id,
    v_actor,
    v_actor_membership_id,
    'hospital.profile_change_requested',
    'workspace_hospital_profile_change_request',
    v_request.id::text,
    p_request_id => nullif(btrim(p_request_id), ''),
    p_after_snapshot => jsonb_build_object(
      'id', v_request.id,
      'fields', v_request.requested_fields,
      'status', v_request.status
    )
  );

  return jsonb_build_object(
    'id', v_request.id,
    'fields', v_request.requested_fields,
    'createdAt', v_request.created_at,
    'status', v_request.status
  );
end;
$$;

revoke all on function public.clair_get_workspace_hospital_profile(text)
  from public, anon;
revoke all on function public.clair_update_workspace_hospital_contact(
  text, text, bigint, jsonb, text
) from public, anon;
revoke all on function public.clair_create_workspace_hospital_profile_change_request(
  text, text, text[], text, text
) from public, anon;

grant execute on function public.clair_get_workspace_hospital_profile(text)
  to authenticated;
grant execute on function public.clair_update_workspace_hospital_contact(
  text, text, bigint, jsonb, text
) to authenticated;
grant execute on function public.clair_create_workspace_hospital_profile_change_request(
  text, text, text[], text, text
) to authenticated;

comment on table public.workspace_hospital_profiles is
  'One hospital identity/contact/logo pointer row per workspace.';
comment on table public.workspace_hospital_profile_change_requests is
  'Registered hospital-information change requests; detail is excluded from audit payloads.';
