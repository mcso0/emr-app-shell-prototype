\set ON_ERROR_STOP on
begin;

insert into public.workspaces (id, display_name, status)
values ('hospital-profile-replay-other', 'Replay Other Workspace', 'active')
on conflict (id) do nothing;

set local role authenticated;

-- Unauthenticated and cross-workspace reads are rejected.
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  perform public.clair_get_workspace_hospital_profile('clair-demo');
  raise exception 'expected workspace_membership_missing';
exception
  when others then
    if sqlerrm <> 'workspace_membership_missing' then raise; end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
do $$
begin
  perform public.clair_get_workspace_hospital_profile(
    'hospital-profile-replay-other'
  );
  raise exception 'expected cross-workspace denial';
exception
  when others then
    if sqlerrm <> 'workspace_membership_missing' then raise; end if;
end;
$$;

-- An active member may read, but cannot mutate.
select public.clair_get_workspace_hospital_profile('clair-demo');
do $$
declare
  v_profile jsonb := public.clair_get_workspace_hospital_profile('clair-demo');
begin
  perform public.clair_update_workspace_hospital_contact(
    'clair-demo',
    '00000000-0000-4000-8000-000000000004',
    (v_profile->>'revision')::bigint,
    jsonb_build_object(
      'phone', '02-0000-0004',
      'fax', '',
      'homepage', '',
      'instagram', '',
      'customerGuideMemo', ''
    ),
    'hospital-profile-replay-non-admin'
  );
  raise exception 'expected permission_missing';
exception
  when others then
    if sqlerrm <> 'permission_missing' then raise; end if;
end;
$$;

-- The workspace admin can update with CAS and receives readback.
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
do $$
declare
  v_before jsonb := public.clair_get_workspace_hospital_profile('clair-demo');
  v_after jsonb;
begin
  v_after := public.clair_update_workspace_hospital_contact(
    'clair-demo',
    '00000000-0000-4000-8000-000000000001',
    (v_before->>'revision')::bigint,
    jsonb_build_object(
      'phone', '02-0000-0001',
      'fax', '',
      'homepage', 'https://example.invalid',
      'instagram', '@replay',
      'customerGuideMemo', 'Synthetic replay memo'
    ),
    'hospital-profile-replay-admin'
  );
  if (v_after->>'revision')::bigint <> (v_before->>'revision')::bigint + 1 then
    raise exception 'profile revision did not advance';
  end if;

  begin
    perform public.clair_update_workspace_hospital_contact(
      'clair-demo',
      '00000000-0000-4000-8000-000000000001',
      (v_before->>'revision')::bigint,
      v_after->'contact',
      'hospital-profile-replay-stale'
    );
    raise exception 'expected hospital_profile_stale';
  exception
    when others then
      if sqlerrm <> 'hospital_profile_stale' then raise; end if;
  end;
end;
$$;

-- The field set is constrained and request detail is not copied to audit JSON.
do $$
begin
  perform public.clair_create_workspace_hospital_profile_change_request(
    'clair-demo',
    '00000000-0000-4000-8000-000000000001',
    array['status'],
    'Synthetic invalid field',
    'hospital-profile-replay-invalid-request'
  );
  raise exception 'expected invalid_input';
exception
  when others then
    if sqlerrm <> 'invalid_input' then raise; end if;
end;
$$;

select public.clair_create_workspace_hospital_profile_change_request(
  'clair-demo',
  '00000000-0000-4000-8000-000000000001',
  array['hospital_name', 'address'],
  'Synthetic confidential replay detail',
  'hospital-profile-replay-change-request'
);

reset role;

do $$
begin
  if (
    select count(*)
    from public.audit_events event
    where event.request_id in (
      'hospital-profile-replay-admin',
      'hospital-profile-replay-change-request'
    )
  ) <> 2 then
    raise exception 'hospital profile audit request ids missing';
  end if;

  if exists (
    select 1
    from public.audit_events event
    where event.request_id in (
      'hospital-profile-replay-admin',
      'hospital-profile-replay-change-request'
    )
      and (
        event.before_snapshot::text ilike '%02-0000-0001%'
        or event.after_snapshot::text ilike '%02-0000-0001%'
        or event.metadata::text ilike '%Synthetic confidential replay detail%'
      )
  ) then
    raise exception 'confidential hospital profile value leaked to audit';
  end if;
end;
$$;

rollback;
