-- OPERATOR CANDIDATE ONLY: run only with explicit authorization for this target.
-- Keep the chart-aware application deployed. Preserve every record and RPC
-- needed to list, read, save, sign, assess, execute, and bill existing charts.
begin;
revoke execute on function public.clair_create_encounter_chart(text,text,uuid,uuid,timestamptz)
  from public,anon,authenticated,service_role;
select has_function_privilege('authenticated',
  'public.clair_create_encounter_chart(text,text,uuid,uuid,timestamptz)','EXECUTE') as creation_enabled;
commit;
-- Recovery after a reviewed fix: GRANT EXECUTE on the same function TO authenticated.
-- Never recreate the old encounter-wide SOAP unique index or delete later notes.
