-- The historical applied SQL supplies the compromised value without committing
-- another copy. Fresh replays use random credentials and have nothing to rotate.
do $rotate$
declare
  v_published text[];
  v_affected uuid[];
begin
  select array_agg(distinct captured[1]) into v_published
  from supabase_migrations.schema_migrations h
  cross join lateral unnest(h.statements) statement
  cross join lateral regexp_matches(
    statement, 'extensions[.]crypt\(''([^'']+)''', 'g'
  ) captured
  where h.version in ('20260702142317', '20260702152054');

  select array_agg(u.id) into v_affected
  from auth.users u
  where u.email ~ '@[^@]*[.]local$'
    and exists (
      select 1 from unnest(v_published) exposed(password)
      where extensions.crypt(exposed.password, u.encrypted_password) = u.encrypted_password
    );

  if coalesce(cardinality(v_published), 0) = 0 then return; end if;

  -- Applied migration history distinguishes first cleanup after manual password
  -- changes from a replay that must preserve newly established sessions.
  if coalesce(cardinality(v_affected), 0) = 0 and exists (
    select 1 from supabase_migrations.schema_migrations
    where name = 'rotate_published_demo_credentials'
  ) then return; end if;

  -- Keep a usable administrator before rotating shared demo credentials.
  if coalesce(cardinality(v_affected), 0) > 0 and not exists (
    select 1 from public.user_memberships m
    join auth.users u on u.id = m.user_id
    where m.status = 'active' and not (u.id = any(v_affected))
      and coalesce(u.encrypted_password, '') <> ''
      and (
        'hospital_admin' = any(m.roles)
        or exists (
          select 1 from public.workspace_membership_permission_role_assignments a
          join public.workspace_permission_roles r
            on r.id = a.permission_role_id and r.workspace_id = a.workspace_id
          where a.membership_id = m.id and a.workspace_id = m.workspace_id
            and r.status = 'active' and r.role_type in ('owner', 'admin')
        )
      )
  ) then
    raise exception 'rotation_requires_unexposed_admin' using errcode = '55000';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(
        encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')
      ), updated_at = now()
  where id = any(v_affected);

  -- Also revoke old sessions for the demo administrator whose password was
  -- changed interactively, without touching personal accounts or clinical data.
  delete from auth.sessions s using auth.users u
  where s.user_id = u.id and u.email ~ '@[^@]*[.]local$'
    and (u.id = any(v_affected)
      or u.id::text like '00000000-0000-4000-8000-%'
      or u.id::text like '49110000-%');
  delete from auth.refresh_tokens r using auth.users u
  where r.user_id = u.id::text and u.email ~ '@[^@]*[.]local$'
    and (u.id = any(v_affected)
      or u.id::text like '00000000-0000-4000-8000-%'
      or u.id::text like '49110000-%');
end
$rotate$;
