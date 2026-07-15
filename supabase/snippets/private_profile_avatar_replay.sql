-- RECEPTION-LIVE-PR-015 local-only transactional replay.
-- Verifies the self-only RPC boundary and private Storage policies, then rolls back.
\set ON_ERROR_STOP on

begin;

insert into public.user_profiles (
  user_id,
  avatar_storage_path,
  avatar_legacy_hidden
)
values
  ('49110000-0000-4000-8000-000000000003', null, false),
  (
    '49110000-0000-4000-8000-000000000004',
    '49110000-0000-4000-8000-000000000004/avatars/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
    true
  ),
  ('49110000-0000-4000-8000-000000000005', null, false)
on conflict (user_id) do update
set
  avatar_storage_path = excluded.avatar_storage_path,
  avatar_legacy_hidden = excluded.avatar_legacy_hidden;

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values
  (
    'profile-avatars',
    '49110000-0000-4000-8000-000000000003/avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
    '49110000-0000-4000-8000-000000000003',
    '49110000-0000-4000-8000-000000000003',
    '{"mimetype":"image/webp"}'::jsonb
  ),
  (
    'profile-avatars',
    '49110000-0000-4000-8000-000000000004/avatars/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
    '49110000-0000-4000-8000-000000000004',
    '49110000-0000-4000-8000-000000000004',
    '{"mimetype":"image/webp"}'::jsonb
  ),
  (
    'profile-avatars',
    '49110000-0000-4000-8000-000000000005/avatars/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp',
    '49110000-0000-4000-8000-000000000005',
    '49110000-0000-4000-8000-000000000005',
    '{"mimetype":"image/webp"}'::jsonb
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from storage.objects
   where bucket_id = 'profile-avatars'
     and name =
       '49110000-0000-4000-8000-000000000003/avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
  if v_count <> 1 then
    raise exception 'owner_unpointed_final_read_denied';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000004',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from storage.objects
   where bucket_id = 'profile-avatars'
     and name =
       '49110000-0000-4000-8000-000000000003/avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
  if v_count <> 0 then
    raise exception 'peer_unpointed_final_read_unexpectedly_succeeded';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.clair_set_my_profile_avatar_state(
  'workspace-clair-cheongdam',
  null,
  false,
  '49110000-0000-4000-8000-000000000003/avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
  true,
  'upload'
);

do $$
begin
  begin
    update public.user_profiles
       set avatar_storage_path =
         '49110000-0000-4000-8000-000000000003/avatars/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.webp'
     where user_id = '49110000-0000-4000-8000-000000000003';
    raise exception 'direct_avatar_write_unexpectedly_succeeded';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'avatar_state_api_required' then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_updated integer;
begin
  update public.user_profiles
     set avatar_legacy_hidden = false
   where user_id = '49110000-0000-4000-8000-000000000004';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'other_user_avatar_write_unexpectedly_succeeded';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.clair_set_my_profile_avatar_state(
      'workspace-that-does-not-exist',
      '49110000-0000-4000-8000-000000000003/avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      true,
      null,
      true,
      'remove'
    );
    raise exception 'cross_workspace_rpc_unexpectedly_succeeded';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'workspace_membership_missing' then
        raise;
      end if;
  end;
end;
$$;

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'profile-avatars',
  '49110000-0000-4000-8000-000000000003/incoming/dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '49110000-0000-4000-8000-000000000003',
  '49110000-0000-4000-8000-000000000003',
  '{"mimetype":"image/png"}'::jsonb
);

do $$
begin
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values (
      'profile-avatars',
      '49110000-0000-4000-8000-000000000004/incoming/ffffffff-ffff-4fff-8fff-ffffffffffff',
      '49110000-0000-4000-8000-000000000003',
      '49110000-0000-4000-8000-000000000003',
      '{"mimetype":"image/png"}'::jsonb
    );
    raise exception 'foreign_storage_insert_unexpectedly_succeeded';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

do $$
declare
  v_visible_names text[];
begin
  select array_agg(name order by name)
    into v_visible_names
    from storage.objects
   where bucket_id = 'profile-avatars';

  if not (
    v_visible_names @> array[
      '49110000-0000-4000-8000-000000000003/avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      '49110000-0000-4000-8000-000000000004/avatars/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
      '49110000-0000-4000-8000-000000000003/incoming/dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ]::text[]
  ) or v_visible_names @> array[
    '49110000-0000-4000-8000-000000000005/avatars/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp'
  ]::text[] then
    raise exception 'private_avatar_read_policy_mismatch: %', v_visible_names;
  end if;
end;
$$;

reset role;
update public.users
   set status = 'inactive'
 where id = '49110000-0000-4000-8000-000000000006';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000006',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    perform public.clair_set_my_profile_avatar_state(
      'workspace-clair-cheongdam',
      null,
      false,
      null,
      true,
      'remove'
    );
    raise exception 'inactive_member_rpc_unexpectedly_succeeded';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'workspace_membership_missing' then
        raise;
      end if;
  end;
end;
$$;

select jsonb_build_object(
  'rpcSelfWrite', true,
  'directWriteDenied', true,
  'otherUserDenied', true,
  'crossWorkspaceDenied', true,
  'inactiveMemberDenied', true,
  'ownerUnpointedFinalRead', true,
  'peerUnpointedFinalDenied', true,
  'privateStorageReadBoundary', true,
  'ownedStorageWriteBoundary', true,
  'rollback', true
) as private_profile_avatar_replay;

rollback;
