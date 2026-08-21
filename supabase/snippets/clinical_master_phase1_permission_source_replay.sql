-- Local-only Phase 1 permission-source regression replay.
-- Run after `npx supabase db reset --local` as the local database owner:
--
--   psql --dbname "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/snippets/clinical_master_phase1_permission_source_replay.sql
--
-- Every fixture row is synthetic and the transaction is rolled back.  The
-- assertions switch to the authenticated role before invoking the private
-- helper, Order Set RLS, and the authenticated Order Set SELECT RPC.

\set ON_ERROR_STOP on

begin;

do $fixture$
declare
  v_actor uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_owner uuid := '00000000-0000-4000-8000-000000000002'::uuid;
  v_workspace text := 'phase1-permission-main';
  v_other_workspace text := 'phase1-permission-other';
begin
  if exists (
    select 1
    from public.workspaces
    where id in (v_workspace, v_other_workspace)
  ) then
    raise exception 'clinical_master_phase1_permission_replay_fixture_already_exists';
  end if;
  if not exists (
    select 1
    from public.users
    where id = v_actor and status = 'active'
  ) then
    raise exception 'clinical_master_phase1_permission_replay_actor_missing';
  end if;

  insert into public.workspaces(id, display_name, status, created_by_user_id)
  values
    (v_workspace, 'Phase 1 permission source replay', 'active', v_owner),
    (v_other_workspace, 'Phase 1 permission source other workspace', 'active', v_owner);

  insert into public.user_memberships(
    id, workspace_id, user_id, roles, status, activated_at
  )
  values (
    'a1000000-0000-4000-8000-000000000001'::uuid,
    v_workspace,
    v_actor,
    array['vet']::text[],
    'active',
    now()
  ), (
    'a1000000-0000-4000-8000-000000000002'::uuid,
    v_workspace,
    v_owner,
    array['hospital_admin']::text[],
    'active',
    now()
  );

  insert into public.workspace_permission_roles(
    id,
    workspace_id,
    role_key,
    label,
    role_type,
    permissions,
    is_system,
    is_assignable,
    status,
    created_by_user_id
  )
  values
    (
      'a2000000-0000-4000-8000-000000000001'::uuid,
      v_workspace,
      'phase1_general',
      'Phase 1 general',
      'standard',
      '{"allowed":["service_catalog:view"]}'::jsonb,
      false,
      true,
      'active',
      v_actor
    ),
    (
      'a2000000-0000-4000-8000-000000000002'::uuid,
      v_workspace,
      'phase1_custom',
      'Phase 1 custom view',
      'custom',
      '{"allowed":["service_catalog:view"]}'::jsonb,
      false,
      true,
      'active',
      v_actor
    ),
    (
      'a2000000-0000-4000-8000-000000000003'::uuid,
      v_workspace,
      'phase1_missing',
      'Phase 1 missing view',
      'custom',
      '{"allowed":["chart:view"]}'::jsonb,
      false,
      true,
      'active',
      v_actor
    ),
    (
      'a2000000-0000-4000-8000-000000000004'::uuid,
      v_workspace,
      'phase1_wildcard',
      'Phase 1 wildcard',
      'admin',
      '{"allowed":["*"]}'::jsonb,
      false,
      false,
      'active',
      v_actor
    ),
    (
      'a2000000-0000-4000-8000-000000000005'::uuid,
      v_workspace,
      'phase1_empty',
      'Phase 1 empty',
      'standard',
      '{"allowed":[]}'::jsonb,
      false,
      true,
      'active',
      v_actor
    ),
    (
      'a2000000-0000-4000-8000-000000000006'::uuid,
      v_workspace,
      'phase1_inactive',
      'Phase 1 inactive',
      'custom',
      '{"allowed":["service_catalog:view"]}'::jsonb,
      false,
      false,
      'inactive',
      v_actor
    ),
    (
      'a2000000-0000-4000-8000-000000000007'::uuid,
      v_other_workspace,
      'phase1_other',
      'Phase 1 other workspace',
      'standard',
      '{"allowed":["service_catalog:view"]}'::jsonb,
      false,
      true,
      'active',
      v_actor
    );

  insert into public.workspace_membership_permission_role_assignments(
    workspace_id, membership_id, permission_role_id, assigned_by_user_id
  )
  values (
    v_workspace,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000001'::uuid,
    v_actor
  )
  on conflict (membership_id) do update
  set workspace_id = excluded.workspace_id,
      permission_role_id = excluded.permission_role_id,
      assigned_by_user_id = excluded.assigned_by_user_id;

  insert into public.permission_policies(
    workspace_id, name, scope, target_role, target_user_id, permissions
  )
  values
    (
      v_workspace,
      'Phase 1 legacy role view',
      'role',
      'vet',
      null,
      '{"allowed":["service_catalog:view"]}'::jsonb
    ),
    (
      v_workspace,
      'Phase 1 legacy user manage',
      'user',
      null,
      v_actor,
      '{"allowed":["service_catalog:manage"]}'::jsonb
    );

  -- The pending source projection is sufficient to exercise the protected
  -- Order Set SELECT surface without creating a second revision fixture.
  perform set_config('clinical_master.b2_internal_write', 'on', true);
  insert into public.order_sets(
    id,
    workspace_id,
    source_set_version,
    set_category,
    set_name,
    billing_name,
    availability_status,
    amount_basis,
    set_price_krw,
    sales_unit,
    billing_reflection_enabled,
    target_species,
    range_price_ranges,
    tax_type,
    created_by_user_id,
    updated_by_user_id
  )
  values
    (
      'phase1-permission-order-set',
      v_workspace,
      'order-set-pending',
      'Phase 1 permission replay',
      'Phase 1 permission Order Set',
      'Phase 1 permission Order Set billing',
      'active',
      'included_order_sum',
      null,
      'per_each',
      false,
      array['dog','cat','other']::text[],
      '[]'::jsonb,
      'derived',
      v_actor,
      v_actor
    ),
    (
      'phase1-permission-other-order-set',
      v_other_workspace,
      'order-set-pending',
      'Phase 1 other replay',
      'Phase 1 other Order Set',
      'Phase 1 other Order Set billing',
      'active',
      'included_order_sum',
      null,
      'per_each',
      false,
      array['dog','cat','other']::text[],
      '[]'::jsonb,
      'derived',
      v_actor,
      v_actor
    );
  perform set_config('clinical_master.b2_internal_write', 'off', true);
end;
$fixture$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $general_assignment$
declare
  v_allowed boolean;
  v_count integer;
  v_cross_workspace_denied boolean := false;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from true then
    raise exception 'clinical_master_phase1_permission_assigned_general_view_denied';
  end if;

  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:manage'
  ) into v_allowed;
  if v_allowed is distinct from false then
    raise exception 'clinical_master_phase1_permission_general_manage_allowed';
  end if;

  select count(*) into v_count
  from public.order_sets
  where workspace_id = 'phase1-permission-main';
  if v_count <> 1 then
    raise exception 'clinical_master_phase1_permission_order_set_select_count:%', v_count;
  end if;

  select count(*) into v_count
  from public.order_sets
  where workspace_id = 'phase1-permission-other';
  if v_count <> 0 then
    raise exception 'clinical_master_phase1_permission_order_set_cross_workspace_visible:%', v_count;
  end if;

  select count(*) into v_count
  from public.clair_list_order_sets('phase1-permission-main', null);
  if v_count <> 1 then
    raise exception 'clinical_master_phase1_permission_order_set_rpc_select_count:%', v_count;
  end if;

  begin
    perform 1
    from public.clair_list_order_sets('phase1-permission-other', null);
  exception when others then
    if sqlerrm like '%permission_missing%' then
      v_cross_workspace_denied := true;
    else
      raise;
    end if;
  end;
  if not v_cross_workspace_denied then
    raise exception 'clinical_master_phase1_permission_order_set_cross_workspace_rpc_allowed';
  end if;
end;
$general_assignment$;

reset role;
update public.workspace_membership_permission_role_assignments
set permission_role_id = 'a2000000-0000-4000-8000-000000000002'::uuid
where workspace_id = 'phase1-permission-main'
  and membership_id = 'a1000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $custom_assignment$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from true then
    raise exception 'clinical_master_phase1_permission_assigned_custom_view_denied';
  end if;
end;
$custom_assignment$;

reset role;
update public.workspace_membership_permission_role_assignments
set permission_role_id = 'a2000000-0000-4000-8000-000000000003'::uuid
where workspace_id = 'phase1-permission-main'
  and membership_id = 'a1000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $missing_assignment$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from false then
    raise exception 'clinical_master_phase1_permission_assigned_missing_permission_allowed';
  end if;
end;
$missing_assignment$;

reset role;
update public.workspace_membership_permission_role_assignments
set permission_role_id = 'a2000000-0000-4000-8000-000000000004'::uuid
where workspace_id = 'phase1-permission-main'
  and membership_id = 'a1000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $wildcard_assignment$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'workspace_data:dangerous_delete'
  ) into v_allowed;
  if v_allowed is distinct from true then
    raise exception 'clinical_master_phase1_permission_assigned_wildcard_denied';
  end if;
end;
$wildcard_assignment$;

reset role;
update public.workspace_membership_permission_role_assignments
set permission_role_id = 'a2000000-0000-4000-8000-000000000005'::uuid
where workspace_id = 'phase1-permission-main'
  and membership_id = 'a1000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $empty_assignment$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from false then
    raise exception 'clinical_master_phase1_permission_empty_assignment_fell_back';
  end if;
end;
$empty_assignment$;

reset role;
update public.workspace_membership_permission_role_assignments
set permission_role_id = 'a2000000-0000-4000-8000-000000000006'::uuid
where workspace_id = 'phase1-permission-main'
  and membership_id = 'a1000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $inactive_assignment$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from false then
    raise exception 'clinical_master_phase1_permission_inactive_assignment_allowed';
  end if;
end;
$inactive_assignment$;

reset role;
delete from public.workspace_membership_permission_role_assignments
where workspace_id = 'phase1-permission-main'
  and membership_id = 'a1000000-0000-4000-8000-000000000001'::uuid;
update public.user_memberships
set roles = array['vet']::text[]
where workspace_id = 'phase1-permission-main'
  and id = 'a1000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $legacy_fallback$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from true then
    raise exception 'clinical_master_phase1_permission_legacy_role_fallback_denied';
  end if;

  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:manage'
  ) into v_allowed;
  if v_allowed is distinct from true then
    raise exception 'clinical_master_phase1_permission_legacy_user_fallback_denied';
  end if;
end;
$legacy_fallback$;

reset role;
delete from public.permission_policies
where workspace_id = 'phase1-permission-main';
update public.user_memberships
set roles = array['hospital_admin']::text[]
where workspace_id = 'phase1-permission-main'
  and id = 'a1000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $legacy_admin$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'workspace_data:dangerous_delete'
  ) into v_allowed;
  if v_allowed is distinct from true then
    raise exception 'clinical_master_phase1_permission_legacy_hospital_admin_denied';
  end if;
end;
$legacy_admin$;

reset role;
select set_config('clair.membership_status_rpc', 'on', true);
update public.user_memberships
set roles = array['vet']::text[], status = 'inactive'
where workspace_id = 'phase1-permission-main'
  and id = 'a1000000-0000-4000-8000-000000000001'::uuid;
select set_config('clair.membership_status_rpc', 'off', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $inactive_membership$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from false then
    raise exception 'clinical_master_phase1_permission_inactive_membership_allowed';
  end if;
end;
$inactive_membership$;

reset role;
select set_config('clair.membership_status_rpc', 'on', true);
update public.user_memberships
set status = 'active'
where workspace_id = 'phase1-permission-main'
  and id = 'a1000000-0000-4000-8000-000000000001'::uuid;
select set_config('clair.membership_status_rpc', 'off', true);
update public.users
set status = 'inactive'
where id = '00000000-0000-4000-8000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $inactive_user$
declare
  v_allowed boolean;
begin
  select private.clair_current_user_has_workspace_permission(
    'phase1-permission-main', 'service_catalog:view'
  ) into v_allowed;
  if v_allowed is distinct from false then
    raise exception 'clinical_master_phase1_permission_inactive_user_allowed';
  end if;
end;
$inactive_user$;

reset role;
update public.users
set status = 'active'
where id = '00000000-0000-4000-8000-000000000001'::uuid;

rollback;
select 'clinical_master_phase1_permission_source_replay_ok' as result;
