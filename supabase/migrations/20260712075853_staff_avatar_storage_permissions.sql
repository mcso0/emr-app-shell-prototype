-- The trusted avatar seed workflow updates only the profile reference after
-- uploading the object. Keep this grant scoped to the server-side service role.
grant select, update on public.user_profiles to service_role;
