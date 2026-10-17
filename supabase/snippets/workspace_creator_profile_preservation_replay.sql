\set ON_ERROR_STOP on
-- Local-only rollback replay for the additive creator-profile preservation RPC.
-- Reset the local database first, then run this file as the local database owner:
--   psql --dbname "$LOCAL_DATABASE_URL" --file supabase/snippets/workspace_creator_profile_preservation_replay.sql
-- The direct migration reapply and every synthetic workspace/profile row are
-- rolled back at the end of this file.

begin;

-- Exercise direct reapplication against the migration chain already present in
-- the local database. Re-running CREATE OR REPLACE plus the same ACL statements
-- must be safe inside the rollback-only transaction.
\ir ../migrations/20260823140000_workspace_creation_creator_profile_preservation.sql

do $replay$
declare
  v_existing_actor uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_new_actor uuid := '00000000-0000-4000-8000-0000000000a1'::uuid;
  v_inactive_actor uuid := '00000000-0000-4000-8000-0000000000a2'::uuid;
  v_mismatch_actor uuid := '00000000-0000-4000-8000-0000000000a3'::uuid;
  v_existing_user_before jsonb;
  v_existing_user_after jsonb;
  v_existing_profile_before jsonb;
  v_existing_profile_after jsonb;
  v_new_user jsonb;
  v_result jsonb;
  v_error_message text;
  v_prosecdef boolean;
  v_proconfig text[];
  v_function regprocedure := 'public.clair_create_workspace_with_creator(text,text,text,text,text)'::regprocedure;
  v_rejected boolean;
  v_workspace_count integer;
  v_membership_count integer;
  v_user_count integer;
  v_profile_count integer;
begin
  -- The default local seed supplies v_existing_actor. Add only isolated auth
  -- identities for the new/rejection cases; the surrounding transaction rolls
  -- these rows back with the rest of the replay.
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      v_new_actor,
      'authenticated',
      'authenticated',
      'workspace-creator-new@clair.local',
      extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"New Creator"}'::jsonb,
      now(),
      now()
    ),
    (
      v_inactive_actor,
      'authenticated',
      'authenticated',
      'workspace-creator-inactive@clair.local',
      extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Inactive Creator"}'::jsonb,
      now(),
      now()
    ),
    (
      v_mismatch_actor,
      'authenticated',
      'authenticated',
      'workspace-creator-mismatch@clair.local',
      extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Stored Creator"}'::jsonb,
      now(),
      now()
    )
  on conflict (id) do nothing;

  insert into public.user_profiles (
    user_id,
    avatar_url,
    notification_preferences,
    locale,
    timezone
  )
  values (
    v_existing_actor,
    'existing-creator-avatar',
    '{"workspaceCreation":true,"email":false}'::jsonb,
    'ko-KR',
    'Asia/Seoul'
  )
  on conflict (user_id) do nothing;

  insert into public.users (id, display_name, initial, email, phone, status)
  values
    (v_inactive_actor, 'Inactive Creator', 'IC', 'inactive-before@clair.local', '010-1000-0002', 'inactive'),
    (v_mismatch_actor, 'Stored Creator', 'SC', 'stored-before@clair.local', '010-1000-0003', 'active')
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    initial = excluded.initial,
    email = excluded.email,
    phone = excluded.phone,
    status = excluded.status;

  select jsonb_build_object(
    'id', app_user.id,
    'display_name', app_user.display_name,
    'initial', app_user.initial,
    'email', app_user.email::text,
    'phone', app_user.phone,
    'status', app_user.status,
    'created_at', app_user.created_at
  )
    into v_existing_user_before
  from public.users app_user
  where app_user.id = v_existing_actor;

  select to_jsonb(profile)
    into v_existing_profile_before
  from public.user_profiles profile
  where profile.user_id = v_existing_actor;

  perform set_config('request.jwt.claim.sub', v_existing_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.clair_create_workspace_with_creator(
    'workspace-creator-existing',
    'Existing Creator Hospital',
    ' 송민재 ',
    null,
    null
  );

  if v_result->'membership'->'roles' @> '["hospital_admin"]'::jsonb is not true
    or v_result->'membership'->>'status' <> 'active'
    or v_result->'workspace'->>'contactEmail' <> 'admin@clair.local'
    or v_result->'workspace'->>'contactPhone' <> '010-0000-0001' then
    raise exception 'workspace_creator_profile_preservation_existing_result_failed';
  end if;

  select jsonb_build_object(
    'id', app_user.id,
    'display_name', app_user.display_name,
    'initial', app_user.initial,
    'email', app_user.email::text,
    'phone', app_user.phone,
    'status', app_user.status,
    'created_at', app_user.created_at
  )
    into v_existing_user_after
  from public.users app_user
  where app_user.id = v_existing_actor;

  select to_jsonb(profile)
    into v_existing_profile_after
  from public.user_profiles profile
  where profile.user_id = v_existing_actor;

  if v_existing_user_after is distinct from v_existing_user_before then
    raise exception 'workspace_creator_profile_preservation_existing_users_fingerprint_failed';
  end if;
  if v_existing_profile_after is distinct from v_existing_profile_before then
    raise exception 'workspace_creator_profile_preservation_existing_user_profiles_fingerprint_failed';
  end if;
  if not exists (
    select 1
    from public.user_memberships membership
    where membership.workspace_id = 'workspace-creator-existing'
      and membership.user_id = v_existing_actor
      and membership.roles @> array['hospital_admin']::text[]
      and membership.status = 'active'
  ) then
    raise exception 'workspace_creator_profile_preservation_existing_membership_failed';
  end if;
  raise notice 'workspace_creator_profile_preservation_existing_user_ok';

  perform set_config('request.jwt.claim.sub', v_new_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.clair_create_workspace_with_creator(
    'workspace-creator-new',
    'New Creator Hospital',
    'New Creator',
    'new-creator@clair.local',
    '010-2000-0001'
  );

  select jsonb_build_object(
    'display_name', app_user.display_name,
    'initial', app_user.initial,
    'email', app_user.email::text,
    'phone', app_user.phone,
    'status', app_user.status
  )
    into v_new_user
  from public.users app_user
  where app_user.id = v_new_actor;

  if v_new_user is distinct from jsonb_build_object(
    'display_name', 'New Creator',
    'initial', 'N',
    'email', 'new-creator@clair.local',
    'phone', '010-2000-0001',
    'status', 'active'
  )
    or v_result->'membership'->'roles' @> '["hospital_admin"]'::jsonb is not true
    or v_result->'membership'->>'status' <> 'active' then
    raise exception 'workspace_creator_profile_preservation_new_actor_regression_failed';
  end if;
  raise notice 'workspace_creator_profile_preservation_new_actor_ok';

  perform set_config('request.jwt.claim.sub', v_inactive_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_rejected := false;
  begin
    perform public.clair_create_workspace_with_creator(
      'workspace-creator-inactive',
      'Inactive Creator Hospital',
      'Inactive Creator',
      null,
      null
    );
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_error_message = message_text;
    if v_error_message not like '%workspace_creator_inactive%' then
      raise exception 'workspace_creator_profile_preservation_inactive_error_failed:%', v_error_message;
    end if;
  end;
  if not v_rejected
    or exists (select 1 from public.workspaces where id = 'workspace-creator-inactive')
    or exists (select 1 from public.user_memberships where workspace_id = 'workspace-creator-inactive') then
    raise exception 'workspace_creator_profile_preservation_inactive_not_atomic';
  end if;
  raise notice 'workspace_creator_profile_preservation_inactive_rejection_ok';

  perform set_config('request.jwt.claim.sub', v_mismatch_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_rejected := false;
  begin
    perform public.clair_create_workspace_with_creator(
      'workspace-creator-mismatch',
      'Mismatch Creator Hospital',
      'Other Creator',
      null,
      null
    );
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_error_message = message_text;
    if v_error_message not like '%workspace_creator_display_name_mismatch%' then
      raise exception 'workspace_creator_profile_preservation_name_error_failed:%', v_error_message;
    end if;
  end;
  if not v_rejected
    or exists (select 1 from public.workspaces where id = 'workspace-creator-mismatch')
    or exists (select 1 from public.user_memberships where workspace_id = 'workspace-creator-mismatch') then
    raise exception 'workspace_creator_profile_preservation_name_not_atomic';
  end if;
  raise notice 'workspace_creator_profile_preservation_name_rejection_ok';

  -- Duplicate workspace rejection must not mutate even the existing creator
  -- profile or any workspace/membership row.
  select count(*) into v_workspace_count from public.workspaces;
  select count(*) into v_membership_count from public.user_memberships;
  select count(*) into v_user_count from public.users;
  select count(*) into v_profile_count from public.user_profiles;
  select jsonb_build_object(
    'id', app_user.id,
    'display_name', app_user.display_name,
    'initial', app_user.initial,
    'email', app_user.email::text,
    'phone', app_user.phone,
    'status', app_user.status,
    'created_at', app_user.created_at
  )
    into v_existing_user_before
  from public.users app_user
  where app_user.id = v_existing_actor;
  select to_jsonb(profile)
    into v_existing_profile_before
  from public.user_profiles profile
  where profile.user_id = v_existing_actor;

  perform set_config('request.jwt.claim.sub', v_existing_actor::text, true);
  v_rejected := false;
  begin
    perform public.clair_create_workspace_with_creator(
      'workspace-creator-existing',
      'Duplicate Existing Creator Hospital',
      '송민재',
      'mutating-contact@clair.local',
      '010-9999-9999'
    );
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_error_message = message_text;
    if v_error_message not like '%workspace_already_exists%' then
      raise exception 'workspace_creator_profile_preservation_duplicate_error_failed:%', v_error_message;
    end if;
  end;
  if not v_rejected
    or (select count(*) from public.workspaces) <> v_workspace_count
    or (select count(*) from public.user_memberships) <> v_membership_count
    or (select count(*) from public.users) <> v_user_count
    or (select count(*) from public.user_profiles) <> v_profile_count then
    raise exception 'workspace_creator_profile_preservation_duplicate_not_atomic';
  end if;
  select jsonb_build_object(
    'id', app_user.id,
    'display_name', app_user.display_name,
    'initial', app_user.initial,
    'email', app_user.email::text,
    'phone', app_user.phone,
    'status', app_user.status,
    'created_at', app_user.created_at
  )
    into v_existing_user_after
  from public.users app_user
  where app_user.id = v_existing_actor;
  select to_jsonb(profile)
    into v_existing_profile_after
  from public.user_profiles profile
  where profile.user_id = v_existing_actor;
  if v_existing_user_after is distinct from v_existing_user_before
    or v_existing_profile_after is distinct from v_existing_profile_before then
    raise exception 'workspace_creator_profile_preservation_duplicate_profile_mutation';
  end if;
  raise notice 'workspace_creator_profile_preservation_duplicate_rollback_ok';

  -- Exact SECURITY DEFINER/search_path/ACL contract must remain unchanged.
  select routine.prosecdef, routine.proconfig
    into v_prosecdef, v_proconfig
  from pg_proc routine
  join pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'public'
    and routine.oid = v_function;
  if v_prosecdef is distinct from true
    or v_proconfig is distinct from array['search_path=public, extensions, pg_temp']::text[] then
    raise exception 'workspace_creator_profile_preservation_security_contract_failed';
  end if;
  if not has_function_privilege('authenticated', v_function, 'EXECUTE')
    or has_function_privilege('anon', v_function, 'EXECUTE')
    or has_function_privilege('public', v_function, 'EXECUTE')
    or has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'workspace_creator_profile_preservation_acl_failed';
  end if;
  raise notice 'workspace_creator_profile_preservation_acl_search_path_ok';
end;
$replay$;

rollback;
