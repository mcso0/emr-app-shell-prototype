-- Run against a disposable database after the SOAP V1/V2 and PR-039 migrations:
-- psql -v ON_ERROR_STOP=1 -d <disposable-db> -f tests/sql/chart_soap_private_attachment_compatibility.sql
-- No patient data or credentials are needed. Assertions are read-only.
do $check$
declare
  v_table jsonb := $table${
    "id":"table-1","type":"table","props":{"textColor":"default"},"children":[],
    "content":{"type":"tableContent","columnWidths":[null,null],"rows":[
      {"cells":[
        {"type":"tableCell","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","colspan":1,"rowspan":1},"content":[{"type":"text","text":"검사","styles":{}}]},
        {"type":"tableCell","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","colspan":1,"rowspan":1},"content":[{"type":"text","text":"정상","styles":{}}]}
      ]}
    ]}}
  $table$::jsonb;
  v_invalid jsonb;
  v_doc jsonb;
begin
  if not pg_catalog.has_table_privilege('authenticated', 'public.chart_soap_attachments', 'SELECT')
    or not pg_catalog.has_table_privilege('authenticated', 'public.chart_soap_attachments', 'INSERT')
    or pg_catalog.has_table_privilege('authenticated', 'public.chart_soap_attachments', 'UPDATE')
    or pg_catalog.has_table_privilege('authenticated', 'public.chart_soap_attachments', 'DELETE')
    or pg_catalog.has_table_privilege('authenticated', 'public.chart_soap_attachments', 'TRUNCATE')
    or pg_catalog.has_table_privilege('anon', 'public.chart_soap_attachments', 'SELECT')
    or pg_catalog.has_table_privilege('anon', 'public.chart_soap_attachments', 'INSERT')
    or not pg_catalog.has_table_privilege('service_role', 'public.chart_soap_attachments', 'SELECT')
    or not pg_catalog.has_table_privilege('service_role', 'public.chart_soap_attachments', 'INSERT')
    or not pg_catalog.has_table_privilege('service_role', 'public.chart_soap_attachments', 'UPDATE')
    or not pg_catalog.has_table_privilege('service_role', 'public.chart_soap_attachments', 'DELETE')
  then raise exception 'attachment table privileges differ from private storage contract'; end if;
  v_doc := pg_catalog.jsonb_build_object('schemaVersion',1,'blocks',pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('id','section-1','type','soapSection',
      'props',pg_catalog.jsonb_build_object('kind','objective','scope','default','label','객관적','systemLabel','기본 SOAP'),
      'children',pg_catalog.jsonb_build_array(v_table))));
  if private.clair_soap_table_text(v_table) is distinct from E'검사\t정상'
    or private.clair_soap_v1_document_is_valid(v_doc) is distinct from true
    or private.clair_soap_blocks_text(pg_catalog.jsonb_build_array(v_table)) is distinct from E'검사\t정상'
  then raise exception 'valid native table was rejected or projected incorrectly'; end if;
  if private.clair_soap_document_is_valid(pg_catalog.jsonb_build_object(
    'schemaVersion',2,'scopes',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'scopeKey','default','scope','default','systemLabel','기본 SOAP','blocks',v_doc->'blocks')))) is distinct from true
  then raise exception 'valid V2 native table was rejected'; end if;

  -- Required keys, numeric types, spans, dimensions, and unknown props must
  -- match the TypeScript validator even when JSONB represents null explicitly.
  for v_invalid in
    select value from pg_catalog.jsonb_array_elements(pg_catalog.jsonb_build_array(
      v_table #- '{content,type}',
      pg_catalog.jsonb_set(v_table,'{content,type}','null'::jsonb),
      pg_catalog.jsonb_set(v_table,'{content,headerRows}','"1"'::jsonb),
      pg_catalog.jsonb_set(v_table,'{content,headerCols}','null'::jsonb),
      pg_catalog.jsonb_set(v_table,'{content,rows,0,cells,0,type}','null'::jsonb),
      v_table #- '{content,rows,0,cells,0,props,textAlignment}',
      pg_catalog.jsonb_set(v_table,'{content,rows,0,cells,0,props,colspan}','"1"'::jsonb),
      pg_catalog.jsonb_set(v_table,'{content,rows,0,cells,0,props,rowspan}','2'::jsonb),
      pg_catalog.jsonb_set(v_table,'{content,columnWidths}','[null,null,null]'::jsonb),
      pg_catalog.jsonb_set(v_table,'{content,rows,0,cells,0,props,unknown}','true'::jsonb)
    )) item(value)
  loop
    if private.clair_soap_table_text(v_invalid) is not null
      or private.clair_soap_v1_document_is_valid(pg_catalog.jsonb_set(v_doc,'{blocks,0,children,0}',v_invalid)) is distinct from false
    then raise exception 'invalid native table was accepted: %', v_invalid; end if;
  end loop;
end;
$check$;
