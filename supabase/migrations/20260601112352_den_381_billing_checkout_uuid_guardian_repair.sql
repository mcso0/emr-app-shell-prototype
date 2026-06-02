-- DEN-381: repair guardian checkout staging replay blocker.
-- Postgres does not provide min(uuid); keep the guardian snapshot selection
-- deterministic by comparing the uuid text representation.

do $$
declare
  v_function_sql text;
begin
  select replace(
    pg_get_functiondef(
      'public.clair_prepare_billing_checkout_session(text, uuid, uuid[], text, jsonb, text)'::regprocedure
    ),
    'select count(*), min(i.guardian_id)',
    'select count(*), min(i.guardian_id::text)::uuid'
  )
  into v_function_sql;

  execute v_function_sql;
end $$;
