-- WP09: bound retained SQL-function contexts during whole-candidate adoption.
-- Preserve the exact scalar SELECT, including SQL NULL and validation errors.
-- No table, publisher, permission, fingerprint or transaction boundary changes.
do $scalar_memory$
declare
  target record; fn regprocedure; source_body text; definition text; metadata jsonb;
begin
  for target in select * from (values
    ('private.clair_execution_field_cell(jsonb,jsonb,text)',
      '06bb21c6434aac047cc44fb0e78a1f9e66fe462f0ef188fdc8eca597af182ef7'),
    ('private.clair_order_field_schema_is_valid(text,integer,jsonb)',
      '659696db5657bd6ee7f8e7585382e53582f7b4631e755f9488db1f6bb60c8928')
  ) expected(signature, body_sha256) loop
    fn := target.signature::regprocedure;
    select prosrc, to_jsonb(p) - array['prosrc','prolang']
      into strict source_body, metadata from pg_proc p where oid=fn;
    if (select l.lanname from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=fn) <> 'sql'
      or encode(extensions.digest(source_body,'sha256'),'hex') <> target.body_sha256 then
      raise exception 'oed_scalar_memory_source_drift: %', target.signature;
    end if;
    definition := pg_get_functiondef(fn);
    definition := replace(definition, 'LANGUAGE sql', 'LANGUAGE plpgsql');
    definition := replace(definition, source_body,
      E'BEGIN\nRETURN (\n' || regexp_replace(source_body, ';[[:space:]]*$', '') || E'\n);\nEND;\n');
    execute definition;
    -- CREATE OR REPLACE retains the OID, owner and ACL. Assert every other
    -- pg_proc attribute too, including definer/invoker, path, strictness and cost.
    if (select to_jsonb(p) - array['prosrc','prolang'] from pg_proc p where oid=fn)
      is distinct from metadata then
      raise exception 'oed_scalar_memory_metadata_drift: %', target.signature;
    end if;
  end loop;
end $scalar_memory$;
