begin;
set local role authenticated;

select jsonb_build_object(
  'permissionMatrix', (
    select (
      select jsonb_object_agg(target_role, permissions order by target_role)
      from public.permission_policies
      where actor_context.jwt_sub is not null
        and workspace_id = 'clair-demo'
        and scope = 'role'
    )
    from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true) as jwt_sub) actor_context
  ),
  'rlsActorChecks', jsonb_build_array(
    (
      select jsonb_build_object(
        'actor', 'clair-demo hospital_admin',
        'actorUserId', auth.uid(),
        'visibleWorkspaces', (
          select coalesce(jsonb_agg(id order by id), '[]'::jsonb)
          from public.workspaces
        ),
        'visibleMembershipWorkspaces', (
          select coalesce(jsonb_agg(distinct workspace_id order by workspace_id), '[]'::jsonb)
          from public.user_memberships
        ),
        'canSeeForeignWorkspace', exists (
          select 1 from public.workspaces where id = 'clair-foreign-demo'
        ),
        'canSeeForeignMembership', exists (
          select 1 from public.user_memberships where workspace_id = 'clair-foreign-demo'
        ),
        'canSeeOwnPermissionPolicies', exists (
          select 1 from public.permission_policies where workspace_id = 'clair-demo'
        ),
        'canSeeForeignPermissionPolicies', exists (
          select 1 from public.permission_policies where workspace_id = 'clair-foreign-demo'
        )
      )
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true)) actor_context
    ),
    (
      select jsonb_build_object(
        'actor', 'foreign hospital_admin',
        'actorUserId', auth.uid(),
        'visibleWorkspaces', (
          select coalesce(jsonb_agg(id order by id), '[]'::jsonb)
          from public.workspaces
        ),
        'visibleMembershipWorkspaces', (
          select coalesce(jsonb_agg(distinct workspace_id order by workspace_id), '[]'::jsonb)
          from public.user_memberships
        ),
        'canSeeClairDemoWorkspace', exists (
          select 1 from public.workspaces where id = 'clair-demo'
        ),
        'canSeeClairDemoMembership', exists (
          select 1 from public.user_memberships where workspace_id = 'clair-demo'
        ),
        'canSeeOwnPermissionPolicies', exists (
          select 1 from public.permission_policies where workspace_id = 'clair-foreign-demo'
        ),
        'canSeeClairDemoPermissionPolicies', exists (
          select 1 from public.permission_policies where workspace_id = 'clair-demo'
        )
      )
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true)) actor_context
    ),
    (
      select jsonb_build_object(
        'actor', 'clair-demo inactive front_desk',
        'actorUserId', auth.uid(),
        'visibleWorkspaces', (
          select coalesce(jsonb_agg(id order by id), '[]'::jsonb)
          from public.workspaces
        ),
        'visibleMembershipCount', (
          select count(*)::int from public.user_memberships
        ),
        'canSeeClairDemoWorkspace', exists (
          select 1 from public.workspaces where id = 'clair-demo'
        ),
        'canSeePermissionPolicies', exists (
          select 1 from public.permission_policies where workspace_id = 'clair-demo'
        )
      )
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', true)) actor_context
    ),
    (
      select jsonb_build_object(
        'actor', 'no-membership user',
        'actorUserId', auth.uid(),
        'visibleWorkspaces', (
          select coalesce(jsonb_agg(id order by id), '[]'::jsonb)
          from public.workspaces
        ),
        'visibleMembershipCount', (
          select count(*)::int from public.user_memberships
        ),
        'canSeeAnyWorkspace', exists (
          select 1 from public.workspaces
        ),
        'canSeePermissionPolicies', exists (
          select 1 from public.permission_policies
        )
      )
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', true)) actor_context
    )
  ),
  'auditCoverage', (
    select jsonb_object_agg(event_type, count order by event_type)
    from (
      select event.value->>'eventType' as event_type, count(*)::int as count
      from (
        select public.clair_list_audit_events('clair-demo', null, null, 100)->'events' as events
        from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true)) actor_context
      ) audit_review
      cross join lateral jsonb_array_elements(audit_review.events) as event(value)
      where event.value->>'id' like 'den-194-audit-%'
      group by event.value->>'eventType'
    ) audit_counts
  ),
  'unsafeAuditPayloadChecks', jsonb_build_object(
    'serviceRoleMentions', (
      select count(*)::int
      from (
        select public.clair_list_audit_events('clair-demo', null, null, 100)->'events' as events
        from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true)) actor_context
      ) audit_review
      cross join lateral jsonb_array_elements(audit_review.events) as event(value)
      where event.value->>'id' like 'den-194-audit-%'
        and (
          (event.value->'metadata')::text ~* 'service[_-]?role'
          or (event.value->'before')::text ~* 'service[_-]?role'
          or (event.value->'after')::text ~* 'service[_-]?role'
          or event.value->>'reason' ~* 'service[_-]?role'
        )
    ),
    'secretMentions', (
      select count(*)::int
      from (
        select public.clair_list_audit_events('clair-demo', null, null, 100)->'events' as events
        from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true)) actor_context
      ) audit_review
      cross join lateral jsonb_array_elements(audit_review.events) as event(value)
      where event.value->>'id' like 'den-194-audit-%'
        and (
          (event.value->'metadata')::text ~* '(secret|token|password|db_password)'
          or (event.value->'before')::text ~* '(secret|token|password|db_password)'
          or (event.value->'after')::text ~* '(secret|token|password|db_password)'
          or event.value->>'reason' ~* '(secret|token|password|db_password)'
        )
    )
  ),
  'seedIsolationFixtures', jsonb_build_object(
    'foreignWorkspaceHiddenFromClairAdmin', not exists (
      select 1
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true) as jwt_sub) actor_context
      cross join lateral (
        select id from public.workspaces where id = 'clair-foreign-demo'
      ) workspace_row
    ),
    'foreignWorkspaceVisibleToForeignAdmin', exists (
      select 1
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true) as jwt_sub) actor_context
      cross join lateral (
        select id
        from public.workspaces
        where actor_context.jwt_sub is not null
          and id = 'clair-foreign-demo'
      ) workspace_row
    ),
    'inactiveMemberExists', exists (
      select 1
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true) as jwt_sub) actor_context
      cross join lateral (
        select id
        from public.user_memberships
        where actor_context.jwt_sub is not null
          and workspace_id = 'clair-demo'
          and user_id = '00000000-0000-4000-8000-000000000013'
          and status = 'inactive'
      ) membership_row
    ),
    'noMembershipActorExists', exists (
      select 1
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', true) as jwt_sub) actor_context
      cross join lateral (
        select id
        from public.users
        where actor_context.jwt_sub is not null
          and id = '00000000-0000-4000-8000-000000000014'
          and status = 'active'
      ) user_row
    ),
    'noMembershipActorHasNoMembership', not exists (
      select 1
      from (select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', true) as jwt_sub) actor_context
      cross join lateral (
        select id
        from public.user_memberships
        where actor_context.jwt_sub is not null
          and user_id = '00000000-0000-4000-8000-000000000014'
      ) membership_row
    )
  )
) as den197_role_audit_summary;

rollback;
