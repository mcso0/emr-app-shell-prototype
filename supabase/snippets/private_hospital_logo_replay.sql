-- HOSPITAL-ADMIN-LIVE-PR-022 local-only transactional replay.
-- Verifies workspace-admin CAS writes and private Storage policies, then rolls back.
\set ON_ERROR_STOP on

begin;

update public.workspace_hospital_profiles
set logo_storage_path = null
where workspace_id = 'workspace-clair-cheongdam';

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values
  (
    'hospital-logos',
    'workspace-clair-cheongdam/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
    '49110000-0000-4000-8000-000000000001',
    '49110000-0000-4000-8000-000000000001',
    '{"mimetype":"image/webp"}'::jsonb
  ),
  (
    'hospital-logos',
    'workspace-clair-cheongdam/logos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
    '49110000-0000-4000-8000-000000000001',
    '49110000-0000-4000-8000-000000000001',
    '{"mimetype":"image/webp"}'::jsonb
  ),
  (
    'hospital-logos',
    'workspace-clair-cheongdam/incoming/49110000-0000-4000-8000-000000000001/cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '49110000-0000-4000-8000-000000000001',
    '49110000-0000-4000-8000-000000000001',
    '{"mimetype":"image/png"}'::jsonb
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible
  from storage.objects
  where bucket_id = 'hospital-logos'
    and name in (
      'workspace-clair-cheongdam/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      'workspace-clair-cheongdam/logos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
      'workspace-clair-cheongdam/incoming/49110000-0000-4000-8000-000000000001/cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    );
  if v_visible <> 3 then
    raise exception 'admin_owned_unpointed_read_policy_mismatch: %', v_visible;
  end if;
end;
$$;

do $$
begin
  begin
    update public.workspace_hospital_profiles
    set logo_storage_path =
      'workspace-clair-cheongdam/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'
    where workspace_id = 'workspace-clair-cheongdam';
    raise exception 'direct_logo_pointer_write_unexpectedly_succeeded';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'hospital_logo_api_required'
        and sqlerrm not like 'permission denied for table %'
      then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_revision bigint;
  v_result jsonb;
begin
  select revision into v_revision
  from public.workspace_hospital_profiles
  where workspace_id = 'workspace-clair-cheongdam';

  v_result := public.clair_set_workspace_hospital_logo_state(
    'workspace-clair-cheongdam',
    v_revision,
    null,
    'workspace-clair-cheongdam/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
    'upload',
    'hospital-logo-replay-upload'
  );
  if (v_result->>'storagePath') is distinct from
    'workspace-clair-cheongdam/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'
  then
    raise exception 'logo_pointer_upload_mismatch: %', v_result;
  end if;

  begin
    perform public.clair_set_workspace_hospital_logo_state(
      'workspace-clair-cheongdam',
      v_revision,
      null,
      'workspace-clair-cheongdam/logos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
      'upload',
      'hospital-logo-replay-stale'
    );
    raise exception 'stale_logo_pointer_write_unexpectedly_succeeded';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'hospital_logo_state_conflict' then
        raise;
      end if;
  end;
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

do $$
declare
  v_current integer;
  v_unpointed integer;
begin
  select count(*) into v_current
  from storage.objects
  where bucket_id = 'hospital-logos'
    and name =
      'workspace-clair-cheongdam/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
  select count(*) into v_unpointed
  from storage.objects
  where bucket_id = 'hospital-logos'
    and name in (
      'workspace-clair-cheongdam/logos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
      'workspace-clair-cheongdam/incoming/49110000-0000-4000-8000-000000000001/cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    );
  if v_current <> 1 or v_unpointed <> 0 then
    raise exception
      'member_logo_read_policy_mismatch: current %, unpointed %',
      v_current,
      v_unpointed;
  end if;
end;
$$;

do $$
declare
  v_revision bigint;
begin
  select revision into v_revision
  from public.workspace_hospital_profiles
  where workspace_id = 'workspace-clair-cheongdam';
  begin
    perform public.clair_set_workspace_hospital_logo_state(
      'workspace-clair-cheongdam',
      v_revision,
      'workspace-clair-cheongdam/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      null,
      'remove',
      'hospital-logo-replay-member'
    );
    raise exception 'member_logo_pointer_write_unexpectedly_succeeded';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'permission_missing' then
        raise;
      end if;
  end;
end;
$$;

reset role;

do $$
declare
  v_event public.audit_events%rowtype;
begin
  select event.* into v_event
  from public.audit_events event
  where event.request_id = 'hospital-logo-replay-upload';
  if not found
    or v_event.event_type <> 'hospital.logo_updated'
    or v_event.before_snapshot ? 'storagePath'
    or v_event.after_snapshot ? 'storagePath'
  then
    raise exception 'hospital_logo_audit_redaction_mismatch';
  end if;
end;
$$;

select jsonb_build_object(
  'adminOwnedUnpointedRead', true,
  'directPointerWriteDenied', true,
  'casConflictDenied', true,
  'memberCurrentRead', true,
  'memberUnpointedReadDenied', true,
  'memberPointerWriteDenied', true,
  'auditPathRedacted', true,
  'rollback', true
) as private_hospital_logo_replay;

rollback;
