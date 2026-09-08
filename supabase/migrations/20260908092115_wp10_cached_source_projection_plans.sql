-- Reuse plans for repeated source projections without changing their SELECTs.
-- Preserve SQL-function first-row/null semantics, OID, owner, ACL and attributes.
do $projection_plans$
declare target record; fn regprocedure; source_body text; definition text; metadata jsonb; replacement text;
begin
  for target in select * from (values
    ('private.clinical_master_order_source_projection_before_taxonomy(uuid)',
      '57b3a17f19735b01f105d6fe755e8426b4d047da694f5e556a53b82f56a7f50c'),
    ('private.clinical_master_order_source_projection(uuid)',
      'd15e868ce55dcf1b30b9f9f130dd6a4410d0c0d3382be76a205c99691e55b64d')
  ) expected(signature,body_sha256) loop
    fn:=target.signature::regprocedure;
    select prosrc,to_jsonb(p)-array['prosrc','prolang'] into strict source_body,metadata from pg_proc p where oid=fn;
    if (select l.lanname from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=fn)<>'sql'
      or encode(extensions.digest(source_body,'sha256'),'hex')<>target.body_sha256 then
      raise exception 'wp10_projection_source_drift:%',target.signature; end if;
    replacement:=E'DECLARE projected jsonb;\nBEGIN\nSELECT * INTO projected FROM (\n'
      ||regexp_replace(source_body,';[[:space:]]*$','')||E'\n) wp10_source;\nRETURN projected;\nEND;\n';
    definition:=replace(pg_get_functiondef(fn),'LANGUAGE sql','LANGUAGE plpgsql');
    execute replace(definition,source_body,replacement);
    if (select to_jsonb(p)-array['prosrc','prolang'] from pg_proc p where oid=fn) is distinct from metadata then
      raise exception 'wp10_projection_metadata_drift:%',target.signature; end if;
  end loop;
end $projection_plans$;
