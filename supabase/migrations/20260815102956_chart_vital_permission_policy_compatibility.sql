-- Keep the legacy permission-policy resolver used by database RPCs aligned
-- with the workspace permission-role model used by server authorization.
--
-- The clinical role check inside both vital writers remains authoritative, so
-- front-desk members stay denied even when a broad general role includes the
-- permission in the newer role model.
update public.permission_policies
set
  permissions = pg_catalog.jsonb_set(
    permissions,
    '{allowed}',
    coalesce(permissions->'allowed', '[]'::jsonb) || '["vital:write"]'::jsonb
  ),
  updated_at = pg_catalog.now()
where scope = 'role'
  and target_role in ('hospital_admin', 'vet', 'technician')
  and not (
    coalesce(permissions->'allowed', '[]'::jsonb) ? 'vital:write'
  );
