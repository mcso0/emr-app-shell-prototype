-- RECEPTION-LIVE-PR-015: private, self-service profile avatars.
-- Existing synthetic seed avatars remain in the legacy public bucket. New
-- uploads use a separate private bucket and a short-lived signed read URL.

alter table public.user_profiles
  add column if not exists avatar_storage_path text,
  add column if not exists avatar_legacy_hidden boolean not null default false;

alter table public.user_profiles
  drop constraint if exists user_profiles_avatar_storage_path_check;
alter table public.user_profiles
  add constraint user_profiles_avatar_storage_path_check check (
    avatar_storage_path is null
    or (
      array_length(string_to_array(avatar_storage_path, '/'), 1) = 3
      and split_part(avatar_storage_path, '/', 1) = user_id::text
      and split_part(avatar_storage_path, '/', 2) = 'avatars'
      and split_part(avatar_storage_path, '/', 3) ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  );

comment on column public.user_profiles.avatar_storage_path is
  'Authenticated-owner-derived object path in the private profile-avatars bucket.';
comment on column public.user_profiles.avatar_legacy_hidden is
  'When true, the legacy public avatar_url is not used as an application fallback.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_select_authorized
  on storage.objects;
create policy profile_avatars_select_authorized
on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    (
      owner_id = (select auth.uid()::text)
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and exists (
        select 1
          from public.user_memberships actor_membership
          join public.users actor_user
            on actor_user.id = actor_membership.user_id
           and actor_user.status = 'active'
         where actor_membership.user_id = (select auth.uid())
           and actor_membership.status = 'active'
      )
    )
    or exists (
      select 1
        from public.user_profiles target_profile
        join public.user_memberships target_membership
          on target_membership.user_id = target_profile.user_id
         and target_membership.status = 'active'
        join public.users target_user
          on target_user.id = target_membership.user_id
         and target_user.status = 'active'
        join public.user_memberships actor_membership
          on target_membership.workspace_id = actor_membership.workspace_id
         and actor_membership.user_id = (select auth.uid())
         and actor_membership.status = 'active'
        join public.users actor_user
          on actor_user.id = actor_membership.user_id
         and actor_user.status = 'active'
       where target_profile.avatar_storage_path = storage.objects.name
    )
  )
);

drop policy if exists profile_avatars_insert_owned
  on storage.objects;
create policy profile_avatars_insert_owned
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] in ('incoming', 'avatars')
  and array_length(string_to_array(name, '/'), 1) = 3
  and (
    (
      (storage.foldername(name))[2] = 'incoming'
      and storage.filename(name) ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    or (
      (storage.foldername(name))[2] = 'avatars'
      and storage.filename(name) ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  )
  and exists (
    select 1
      from public.user_memberships actor_membership
      join public.users actor_user
        on actor_user.id = actor_membership.user_id
       and actor_user.status = 'active'
     where actor_membership.user_id = (select auth.uid())
       and actor_membership.status = 'active'
  )
);

drop policy if exists profile_avatars_delete_owned
  on storage.objects;
create policy profile_avatars_delete_owned
on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
      from public.user_memberships actor_membership
      join public.users actor_user
        on actor_user.id = actor_membership.user_id
       and actor_user.status = 'active'
     where actor_membership.user_id = (select auth.uid())
       and actor_membership.status = 'active'
  )
);

create or replace function private.clair_guard_profile_avatar_state_write()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.role() in ('authenticated', 'anon')
     and current_setting('clair.avatar_state_rpc', true) is distinct from 'allowed'
     and (
    (tg_op = 'INSERT' and (
      new.avatar_storage_path is not null
      or new.avatar_legacy_hidden
    ))
    or (tg_op = 'UPDATE' and (
      new.avatar_storage_path is distinct from old.avatar_storage_path
      or new.avatar_legacy_hidden is distinct from old.avatar_legacy_hidden
      or new.avatar_url is distinct from old.avatar_url
    ))
  ) then
    raise exception using errcode = '42501', message = 'avatar_state_api_required';
  end if;
  return new;
end;
$$;

revoke all on function private.clair_guard_profile_avatar_state_write()
  from public, anon, authenticated;

drop trigger if exists guard_profile_avatar_state_write
  on public.user_profiles;
create trigger guard_profile_avatar_state_write
before insert or update on public.user_profiles
for each row execute function private.clair_guard_profile_avatar_state_write();

create or replace function public.clair_set_my_profile_avatar_state(
  p_workspace_id text,
  p_expected_storage_path text,
  p_expected_legacy_hidden boolean,
  p_new_storage_path text,
  p_new_legacy_hidden boolean,
  p_operation text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_membership_id uuid;
  v_current public.user_profiles%rowtype;
  v_saved public.user_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  select membership.id
    into v_actor_membership_id
    from public.user_memberships membership
    join public.users actor_user
      on actor_user.id = membership.user_id
   where membership.workspace_id = p_workspace_id
     and membership.user_id = v_user_id
     and membership.status = 'active'
     and actor_user.status = 'active';
  if v_actor_membership_id is null
     or not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using errcode = '42501', message = 'workspace_membership_missing';
  end if;
  if p_operation not in ('upload', 'remove', 'restore') then
    raise exception using errcode = '22023', message = 'invalid_avatar_operation';
  end if;
  if p_new_storage_path is not null and not (
    split_part(p_new_storage_path, '/', 1) = v_user_id::text
    and split_part(p_new_storage_path, '/', 2) = 'avatars'
    and array_length(string_to_array(p_new_storage_path, '/'), 1) = 3
    and split_part(p_new_storage_path, '/', 3) ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_avatar_storage_path';
  end if;

  insert into public.user_profiles (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select profile.*
    into v_current
    from public.user_profiles profile
   where profile.user_id = v_user_id
   for update;

  if v_current.avatar_storage_path is distinct from p_expected_storage_path
     or v_current.avatar_legacy_hidden is distinct from p_expected_legacy_hidden then
    raise exception using errcode = '40001', message = 'avatar_state_conflict';
  end if;

  perform set_config('clair.avatar_state_rpc', 'allowed', true);
  update public.user_profiles profile
     set avatar_storage_path = p_new_storage_path,
         avatar_legacy_hidden = p_new_legacy_hidden,
         updated_at = now()
   where profile.user_id = v_user_id
  returning * into v_saved;
  perform set_config('clair.avatar_state_rpc', '', true);

  perform public.clair_append_audit_event(
    'profile-avatar-' || gen_random_uuid()::text,
    p_workspace_id,
    v_user_id,
    v_actor_membership_id,
    'user.profile_updated',
    'user_profile',
    v_user_id::text,
    p_before_snapshot => jsonb_build_object(
      'hasPrivateAvatar', v_current.avatar_storage_path is not null,
      'legacyHidden', v_current.avatar_legacy_hidden
    ),
    p_after_snapshot => jsonb_build_object(
      'hasPrivateAvatar', v_saved.avatar_storage_path is not null,
      'legacyHidden', v_saved.avatar_legacy_hidden
    ),
    p_metadata => jsonb_build_object('operation', p_operation)
  );

  return jsonb_build_object(
    'storagePath', v_saved.avatar_storage_path,
    'legacyHidden', v_saved.avatar_legacy_hidden
  );
end;
$$;

revoke all on function public.clair_set_my_profile_avatar_state(
  text,
  text,
  boolean,
  text,
  boolean,
  text
) from public, anon;
grant execute on function public.clair_set_my_profile_avatar_state(
  text,
  text,
  boolean,
  text,
  boolean,
  text
) to authenticated;
