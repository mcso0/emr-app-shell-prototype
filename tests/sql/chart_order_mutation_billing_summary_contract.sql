\set ON_ERROR_STOP on

begin;
-- PR020_MIGRATION_REAPPLY
-- PR020_MIGRATION_REAPPLY

do $contract$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.clair_save_chart_order_draft(text,text,uuid,jsonb)',
    'public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)',
    'public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'public_wrapper_missing:%', v_signature;
    end if;
    if not has_function_privilege('authenticated', v_signature, 'execute') then
      raise exception 'authenticated_execute_missing:%', v_signature;
    end if;
    if has_function_privilege('anon', v_signature, 'execute') then
      raise exception 'anon_execute_leaked:%', v_signature;
    end if;
    if has_function_privilege('service_role', v_signature, 'execute') then
      raise exception 'service_role_execute_leaked:%', v_signature;
    end if;
    if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) privilege
      where procedure.oid = to_regprocedure(v_signature)
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) then
      raise exception 'public_execute_leaked:%', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)',
    'public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)',
    'public.clair_mutate_chart_order_execution_billing_summary_base(text,uuid,uuid,text,text,integer,jsonb,text)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'revoked_base_missing:%', v_signature;
    end if;
    if has_function_privilege('authenticated', v_signature, 'execute')
      or has_function_privilege('anon', v_signature, 'execute')
      or has_function_privilege('service_role', v_signature, 'execute')
    then
      raise exception 'base_execute_leaked:%', v_signature;
    end if;
    if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) privilege
      where procedure.oid = to_regprocedure(v_signature)
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) then
      raise exception 'base_public_execute_leaked:%', v_signature;
    end if;
  end loop;

  raise notice 'chart_order_mutation_billing_summary_apply_reapply_acl_ok';
end;
$contract$;

insert into public.workspace_permission_roles (
  id,
  workspace_id,
  role_key,
  label,
  role_type,
  permissions,
  is_system,
  is_assignable,
  sort_order,
  created_by_user_id
) values (
  '92000000-0000-4000-8000-000000000020',
  'workspace-clair-cheongdam',
  'pr020_mutation_without_chart_view',
  'PR020 mutation without chart view',
  'custom',
  '{"allowed":["chart:update","order:update","billing:issue"]}'::jsonb,
  false,
  true,
  920,
  '49110000-0000-4000-8000-000000000003'
);

insert into public.workspace_membership_permission_role_assignments (
  membership_id,
  workspace_id,
  permission_role_id,
  assigned_by_user_id
)
select
  membership.id,
  membership.workspace_id,
  '92000000-0000-4000-8000-000000000020',
  '49110000-0000-4000-8000-000000000003'
from public.user_memberships membership
where membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003'
on conflict (membership_id) do update
set permission_role_id = excluded.permission_role_id,
    assigned_by_user_id = excluded.assigned_by_user_id,
    updated_at = now();

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $permission_contract$
declare
  v_denied boolean;
begin
  v_denied := false;
  begin
    perform public.clair_save_chart_order_draft(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '92000000-0000-4000-8000-000000000001',
      '{"rows":[]}'::jsonb
    );
  exception when insufficient_privilege then
    v_denied := position('permission_missing' in sqlerrm) > 0;
  end;
  if not v_denied then
    raise exception 'draft_without_chart_view_accepted';
  end if;

  v_denied := false;
  begin
    perform public.clair_confirm_chart_order_candidates(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '92000000-0000-4000-8000-000000000001',
      array['92000000-0000-4000-8000-000000000002'::uuid],
      '"pr020"',
      'pr020-permission-contract-confirm'
    );
  exception when insufficient_privilege then
    v_denied := position('permission_missing' in sqlerrm) > 0;
  end;
  if not v_denied then
    raise exception 'confirmation_without_chart_view_accepted';
  end if;

  v_denied := false;
  begin
    perform public.clair_mutate_chart_order_execution(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '92000000-0000-4000-8000-000000000002',
      'billing_correct',
      'PR020 permission contract',
      1,
      '{"quantity":1,"unitPrice":1}'::jsonb,
      'pr020-permission-contract-execution'
    );
  exception when insufficient_privilege then
    v_denied := position('permission_missing' in sqlerrm) > 0;
  end;
  if not v_denied then
    raise exception 'execution_without_chart_view_accepted';
  end if;

  v_denied := false;
  begin
    perform public.clair_save_chart_order_draft(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000004',
      '92000000-0000-4000-8000-000000000001',
      '{"rows":[]}'::jsonb
    );
  exception when insufficient_privilege then
    v_denied := position('actor_mismatch' in sqlerrm) > 0;
  end;
  if not v_denied then
    raise exception 'actor_mismatch_accepted';
  end if;

  v_denied := false;
  begin
    perform public.clair_save_chart_order_draft(
      'workspace-phase5-other',
      '49110000-0000-4000-8000-000000000003',
      '92000000-0000-4000-8000-000000000001',
      '{"rows":[]}'::jsonb
    );
  exception when insufficient_privilege then
    v_denied := position('workspace_membership_missing' in sqlerrm) > 0;
  end;
  if not v_denied then
    raise exception 'cross_workspace_mutation_accepted';
  end if;

  raise notice 'chart_order_mutation_billing_summary_permission_boundary_ok';
end;
$permission_contract$;

rollback;

do $rollback_contract$
begin
  if to_regprocedure(
    'public.clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)'
  ) is not null
    or to_regprocedure(
      'public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)'
    ) is not null
    or to_regprocedure(
      'public.clair_mutate_chart_order_execution_billing_summary_base(text,uuid,uuid,text,text,integer,jsonb,text)'
    ) is not null
  then
    raise exception 'rollback_residual_base_function';
  end if;

  if to_regprocedure(
    'public.clair_save_chart_order_draft(text,text,uuid,jsonb)'
  ) is null
    or to_regprocedure(
      'public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)'
    ) is null
    or to_regprocedure(
      'public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)'
    ) is null
  then
    raise exception 'rollback_did_not_restore_public_function';
  end if;

  raise notice 'chart_order_mutation_billing_summary_rollback_zero_residual_ok';
end;
$rollback_contract$;
