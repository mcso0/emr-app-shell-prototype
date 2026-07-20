-- Customer profile master-data boundary.
-- Reads remain available to active workspace members. Direct writes and audit
-- reads are limited to owner/admin memberships; the API also enforces the
-- matching fine-grained management permission before reaching PostgREST.

alter table public.customer_profile_change_logs
  add column if not exists request_id text,
  add column if not exists result text not null default 'success'
    check (result in ('success', 'denied', 'failed'));

update public.workspace_permission_roles
set permissions = jsonb_set(
  permissions,
  '{allowed}',
  (
    select jsonb_agg(permission_id order by permission_id)
    from (
      select distinct permission_id
      from jsonb_array_elements_text(
        coalesce(permissions -> 'allowed', '[]'::jsonb) ||
          '["patient_profile:manage","guardian_profile:manage","patient_guardian_relationship:manage"]'::jsonb
      ) as permission_ids(permission_id)
    ) unique_permission_ids
  ),
  true
)
where role_type = 'admin';

drop policy if exists guardians_workspace_member_select on public.guardians;
create policy guardians_workspace_member_select
on public.guardians for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists guardians_workspace_admin_update on public.guardians;
create policy guardians_workspace_admin_update
on public.guardians for update to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists patients_workspace_member_select on public.patients;
create policy patients_workspace_member_select
on public.patients for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists patients_workspace_admin_update on public.patients;
create policy patients_workspace_admin_update
on public.patients for update to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists patient_guardians_workspace_member_select on public.patient_guardians;
create policy patient_guardians_workspace_member_select
on public.patient_guardians for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists patient_guardians_workspace_admin_insert on public.patient_guardians;
create policy patient_guardians_workspace_admin_insert
on public.patient_guardians for insert to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists consents_workspace_member_select on public.consents;
create policy consents_workspace_member_select
on public.consents for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists guardian_referral_sources_workspace_member_select
on public.guardian_referral_sources;
create policy guardian_referral_sources_workspace_member_select
on public.guardian_referral_sources for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists patient_guardians_workspace_admin_update on public.patient_guardians;
create policy patient_guardians_workspace_admin_update
on public.patient_guardians for update to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists customer_profile_change_logs_workspace_admin_select
on public.customer_profile_change_logs;
create policy customer_profile_change_logs_workspace_admin_select
on public.customer_profile_change_logs for select to authenticated
using (private.clair_is_workspace_admin(workspace_id));

drop policy if exists customer_profile_change_logs_workspace_admin_insert
on public.customer_profile_change_logs;
create policy customer_profile_change_logs_workspace_admin_insert
on public.customer_profile_change_logs for insert to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

create or replace function private.clair_record_customer_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  changed_fields jsonb;
  request_id_value text;
  subject_type_value text;
  change_type_value text := 'update';
begin
  select coalesce(jsonb_agg(field_name order by field_name), '[]'::jsonb)
  into changed_fields
  from (
    select field_name
    from jsonb_object_keys(to_jsonb(new)) as fields(field_name)
    where coalesce(to_jsonb(old), '{}'::jsonb) -> field_name is distinct from to_jsonb(new) -> field_name
      and field_name not in (
        'updated_at',
        'last_updated_by_user_id',
        'linked_by_user_id',
        'primary_changed_by_user_id',
        'unlinked_by_user_id'
      )
  ) changed;

  begin
    request_id_value := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id';
  exception when others then
    request_id_value := null;
  end;
  request_id_value := coalesce(request_id_value, 'tx-' || txid_current()::text);

  if tg_table_name = 'patients' then
    subject_type_value := 'patient';
  elsif tg_table_name = 'guardians' then
    subject_type_value := 'guardian';
  else
    subject_type_value := 'patient_guardian';
    if tg_op = 'INSERT' then
      change_type_value := 'create';
    elsif old.is_primary is distinct from new.is_primary then
      change_type_value := 'primary_change';
    elsif old.unlinked_at is null and new.unlinked_at is not null then
      change_type_value := 'unlink';
    end if;
  end if;

  insert into public.customer_profile_change_logs (
    workspace_id,
    subject_type,
    subject_id,
    change_type,
    changed_by_user_id,
    before_value,
    after_value,
    reason,
    request_id,
    result
  ) values (
    new.workspace_id,
    subject_type_value,
    new.id,
    change_type_value,
    auth.uid(),
    jsonb_build_object('redactedChangedFields', changed_fields),
    jsonb_build_object('redactedChangedFields', changed_fields),
    'customer profile admin mutation',
    request_id_value,
    'success'
  );

  return new;
end;
$$;

drop trigger if exists audit_customer_patient_profile_update on public.patients;
create trigger audit_customer_patient_profile_update
after update on public.patients
for each row execute function private.clair_record_customer_profile_change();

drop trigger if exists audit_customer_guardian_profile_update on public.guardians;
create trigger audit_customer_guardian_profile_update
after update on public.guardians
for each row execute function private.clair_record_customer_profile_change();

drop trigger if exists audit_customer_patient_guardian_update on public.patient_guardians;
create trigger audit_customer_patient_guardian_update
after insert or update on public.patient_guardians
for each row execute function private.clair_record_customer_profile_change();

revoke all on function private.clair_record_customer_profile_change() from public, anon, authenticated;

create or replace function public.clair_manage_patient_guardian_relationship(
  p_workspace_id text,
  p_action text,
  p_patient_id uuid,
  p_guardian_id uuid,
  p_relationship text default null
)
returns setof public.patient_guardians
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  active_relationship public.patient_guardians%rowtype;
  active_count integer;
begin
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'patient_guardian_relationship:manage required';
  end if;

  if not exists (
    select 1 from public.patients
    where workspace_id = p_workspace_id and id = p_patient_id
  ) then
    raise exception 'patient_unavailable';
  end if;

  if not exists (
    select 1 from public.guardians
    where workspace_id = p_workspace_id and id = p_guardian_id
  ) then
    raise exception 'guardian_unavailable';
  end if;

  select * into active_relationship
  from public.patient_guardians
  where workspace_id = p_workspace_id
    and patient_id = p_patient_id
    and guardian_id = p_guardian_id
    and unlinked_at is null
  for update;

  select count(*) into active_count
  from public.patient_guardians
  where workspace_id = p_workspace_id
    and patient_id = p_patient_id
    and unlinked_at is null;

  if p_action = 'link' then
    if active_relationship.id is not null then raise exception 'duplicate_relationship'; end if;
    insert into public.patient_guardians (
      workspace_id, patient_id, guardian_id, relationship, relationship_label,
      is_primary, can_receive_messages, linked_by_user_id
    ) values (
      p_workspace_id, p_patient_id, p_guardian_id,
      coalesce(nullif(trim(p_relationship), ''), 'additional'),
      coalesce(nullif(trim(p_relationship), ''), 'additional'),
      active_count = 0, true, auth.uid()
    );
  elsif p_action = 'set_primary' then
    if active_relationship.id is null then raise exception 'relationship_unavailable'; end if;
    update public.patient_guardians
    set is_primary = false,
        primary_changed_at = now(),
        primary_changed_by_user_id = auth.uid()
    where workspace_id = p_workspace_id
      and patient_id = p_patient_id
      and unlinked_at is null
      and is_primary = true;
    update public.patient_guardians
    set is_primary = true,
        primary_changed_at = now(),
        primary_changed_by_user_id = auth.uid()
    where id = active_relationship.id;
  elsif p_action = 'unlink' then
    if active_relationship.id is null then raise exception 'relationship_unavailable'; end if;
    if active_relationship.is_primary or active_count <= 1 then
      raise exception 'primary_unlink_blocked';
    end if;
    update public.patient_guardians
    set unlinked_at = now(), unlinked_by_user_id = auth.uid()
    where id = active_relationship.id;
  else
    raise exception 'relationship_unavailable';
  end if;

  return query
  select * from public.patient_guardians
  where workspace_id = p_workspace_id
    and patient_id = p_patient_id
    and unlinked_at is null
  order by is_primary desc, sort_order, created_at;
end;
$$;

revoke all on function public.clair_manage_patient_guardian_relationship(text, text, uuid, uuid, text)
from public, anon;
grant execute on function public.clair_manage_patient_guardian_relationship(text, text, uuid, uuid, text)
to authenticated;

grant select on table public.guardians, public.patients, public.patient_guardians,
  public.consents, public.guardian_referral_sources to authenticated;
grant update on table public.guardians, public.patients to authenticated;
grant insert, update on table public.patient_guardians to authenticated;
grant select, insert on table public.customer_profile_change_logs to authenticated;

comment on column public.customer_profile_change_logs.request_id is
  'Request correlation id. Never store credentials or raw personal identifiers.';
comment on column public.customer_profile_change_logs.result is
  'Mutation outcome for customer profile audit review.';
